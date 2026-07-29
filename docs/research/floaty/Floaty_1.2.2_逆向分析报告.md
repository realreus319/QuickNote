# Floaty for Sticky Notes 1.2.2 APK 静态逆向分析报告

## 1. 分析对象与结论范围

分析文件：`Floaty+for+Sticky+Notes_1.2.2_apkcombo.com.apk`

- 包名：`com.editoy.memo.floaty`
- 版本：`1.2.2`
- Version Code：`122`
- APK SHA-256：`34b4a54f9d8c2d5a0d2b6d790e0e6522ad0f027208c6193a6ff19405b432d352`
- 最低 Android：API 21
- Target SDK：32
- DEX：2 个

本报告基于 APK 清单、资源、DEX/Smali、字符串、调用链和签名证书的静态分析。没有使用真实微软账户执行动态登录、代理抓包或服务端响应重放，因此“实际运行时返回值”和“不同微软账户类型的兼容差异”未做动态验证；但接口、请求方法、主要请求体、数据库结构和同步算法均能从代码中直接还原。

## 2. 核心结论

Floaty 1.2.2 的微软便签同步不是 `/beta/me/notes`，也不是 OneNote 页面接口，而是：

```text
Microsoft OAuth / MSAL
        ↓
Microsoft Graph v1.0
        ↓
/me/mailFolders/Notes/messages
        ↓
Exchange 邮箱中的 Sticky Notes 特殊消息
```

关键实现：

1. 申请 `User.Read` 和 `Mail.ReadWrite` 委派权限。
2. 使用 Graph Mail Folder 的 Delta 接口拉取增量变化。
3. 本地使用 SQLite 保存便签和同步状态。
4. 新建便签时不直接 POST 普通 Message，而是复制一条已有的真实 Sticky Note，再 PATCH 副本。
5. 多端冲突不只是“最后写入覆盖”，而是用 diff-match-patch 做“尽量不删除文字”的增量合并。
6. 未使用 ETag、`If-Match`、`changeKey` 或 Immutable ID。
7. 未发现 Floaty 自建的便签同步服务器；便签业务流量直接访问 Microsoft Graph。

## 3. APK 签名

签名证书：

- Subject/Issuer：`CN=Android, OU=Android, O=Google Inc., L=Mountain View, ST=California, C=US`
- SHA-1：`A4:CA:2C:51:96:43:19:D1:76:38:63:6F:EA:E4:9C:CA:04:7E:E4:92`
- SHA-256：`A5:DD:D1:3C:D0:1E:9B:F9:18:58:C3:DD:3F:34:F1:EE:42:32:2A:0F:E1:FC:65:AC:57:E7:E7:09:45:DB:70:66`
- 算法：SHA256withRSA，4096-bit RSA
- 有效期：2020-02-20 至 2050-02-20

该签名指纹与公开应用分发信息一致，说明上传文件大概率是官方签名构建，而不是随意重签的修改版。

## 4. Microsoft Entra / MSAL 登录配置

APK 内置 `res/raw/msal_config.json`：

```json
{
  "client_id": "dc720dc5-91b3-4901-bb02-5e550ea4093f",
  "redirect_uri": "msauth://com.editoy.memo.floaty/callback",
  "broker_redirect_uri_registered": false,
  "account_mode": "SINGLE",
  "authorities": [
    {
      "type": "AAD",
      "audience": {
        "type": "AzureADandPersonalMicrosoftAccount"
      },
      "default": true
    }
  ]
}
```

精确权限：

```text
User.Read
Mail.ReadWrite
```

登录实现：

- 使用 `ISingleAccountPublicClientApplication`。
- 交互登录：`signIn(Activity, null, scopes, callback)`。
- 静默续期：`acquireTokenSilentAsync(scopes, defaultAuthorityURL, callback)`。
- 支持微软个人账户和组织账户。
- Access Token 只在应用静态内存状态中传给 Graph Auth Provider；持久令牌缓存由 MSAL 自己管理。
- Graph 请求头：

```http
Authorization: Bearer <access_token>
```

安全含义：`Mail.ReadWrite` 在权限层面允许读写整个邮箱，不仅是 Notes 文件夹。Floaty 的代码目前只访问 Notes 文件夹，不代表微软权限系统对其进行了文件夹级隔离。

## 5. 精确 Graph 接口

默认服务根：

```text
https://graph.microsoft.com/v1.0
```

### 5.1 账号资料

```http
GET /v1.0/me
```

读取：

- `displayName`
- `mail`
- `userPrincipalName`（`mail` 为空时作为回退）

本地偏好键：

- `msusername`
- `msemail`

### 5.2 头像

```http
GET /beta/me/photo/$value
```

头像请求时临时把 Graph 根切换到 beta，完成后恢复 v1.0。头像保存为应用私有文件：

```text
profilepicture
```

### 5.3 首次同步

```http
GET /v1.0/me/mailFolders/Notes/messages/delta
```

### 5.4 后续增量同步

Floaty 保存服务端返回的完整 `@odata.deltaLink`，之后直接使用该 URL 请求下一批变化。

本地偏好键：

```text
deltalink
```

分页逻辑：

- 当前页有 `nextLink`：继续抓取下一页。
- 当前页出现最终 `deltaLink`：保存并结束下行同步。

### 5.5 读取附件

```http
GET /v1.0/me/mailFolders/Notes/messages/{messageId}/attachments
```

读取字段：

- `name`
- `contentBytes`

### 5.6 更新便签

```http
PATCH /v1.0/me/mailFolders/Notes/messages/{messageId}
```

主要请求体：

```json
{
  "body": {
    "contentType": "html",
    "content": "<本地 HTML 正文>"
  },
  "subject": "<纯文本前 80 字符>",
  "bodyPreview": "<纯文本前 254 字符>"
}
```

上传前会把：

```html
<br>
```

替换为：

```html
<p><br /></p>
```

代码没有加入：

- `If-Match`
- ETag
- `changeKey`
- `Prefer: IdType="ImmutableId"`

### 5.7 删除便签

```http
DELETE /v1.0/me/mailFolders/Notes/messages/{messageId}
```

### 5.8 新建便签：复制模板，而不是直接 POST

这是 Floaty 兼容性最关键的实现。

Floaty 会先从本地数据库找一条满足以下条件的已有微软便签：

- `owner` 是当前微软账户邮箱；
- 有 `uid`；
- 没有附件。

然后调用：

```http
POST /v1.0/me/mailFolders/Notes/messages/{templateMessageId}/copy
Content-Type: application/json
```

请求体的目标文件夹：

```json
{
  "destinationId": "Notes"
}
```

Graph 返回复制后的新 Message ID，再 PATCH 新副本写入正文。

这意味着 Floaty 不需要自己构造 `IPM.StickyNote`、颜色、坐标、宽高等隐藏 MAPI 属性。复制真实便签会把这些 Sticky Note 元数据原样继承下来。

如果没有可复制的已有便签，应用会提示用户先建立一条真正的微软便签，并引导到：

```text
https://www.onenote.com/stickynotes
```

因此它的“首次同步前最好先在微软便签中创建一条记录”不是偶然，而是创建算法的先决条件。

## 6. Graph 数据字段映射

下行同步直接使用的远端字段：

```text
id
subject
bodyPreview
body.content
lastModifiedDateTime
hasAttachments
@removed
```

附件字段：

```text
name
contentBytes
```

其中：

- `id` → 本地 `uid`
- `body.content` → 本地 `body`
- 由 HTML 提取的纯文本 → 本地 `puretext`
- `lastModifiedDateTime` → 本地 `added`
- 当前账户邮箱 → 本地 `owner`

## 7. HTML 和富文本处理

下载正文后，Floaty 会做有限清洗：

1. 删除 HTML 注释：`<!-- ... -->`
2. 把粗体 span 转成 `<b>`
3. 把下划线 span 转成 `<u>`
4. 把斜体 span 转成 `<i>`
5. 将 HTML 转为 Android 富文本/纯文本

能够较好保留的格式主要是：

- 粗体
- 斜体
- 下划线
- 基础换行

但复杂 Office HTML、列表、嵌套样式、未知 span 属性可能被简化。发生冲突合并时，算法以纯文本为基础，最终格式损失会更明显。

## 8. 本地数据库

Floaty 自己的便签数据库没有使用 Room，而是直接使用 `SQLiteOpenHelper`。

- 数据库文件名：`data`
- 数据库版本：`11`

建表 SQL：

```sql
CREATE TABLE notes (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  added INT,
  uid TEXT,
  extra TEXT,
  owner TEXT,
  puretext TEXT,
  attachment TEXT
);
```

字段含义：

| 字段 | 含义 |
|---|---|
| `_id` | 本地主键 |
| `body` | HTML 正文 |
| `added` | 本地修改时间；NULL 表示本地回收站 |
| `uid` | Microsoft Graph Message ID |
| `extra` | 遗留字段，本版本未发现重要用途 |
| `owner` | 所属微软账户邮箱；空值也被当作“待上传”标记 |
| `puretext` | 从 HTML 派生的纯文本 |
| `attachment` | 空格分隔的本地附件文件名 |

主要查询：

### 活跃便签

```sql
SELECT ... FROM notes
WHERE added IS NOT NULL
ORDER BY added DESC;
```

### 回收站

```sql
SELECT ... FROM notes
WHERE added IS NULL
ORDER BY _id DESC;
```

### 待上传便签

```sql
SELECT ... FROM notes
WHERE added IS NOT NULL
  AND (
    uid IS NULL OR uid = ''
    OR owner IS NULL OR owner = ''
  );
```

### 创建时选模板

```sql
SELECT uid FROM notes
WHERE owner = '<当前 msemail>'
  AND uid IS NOT NULL
  AND (attachment IS NULL OR attachment = '')
ORDER BY _id DESC
LIMIT 1;
```

### 登出

登出会删除 `owner = 当前账户邮箱` 的云端便签本地副本，并清理：

- `msusername`
- `msemail`
- `deltalink`
- `spareid`
- `profilepicture`

纯本地便签因为 `owner` 为空，可以保留下来。

### 数据库升级风险

通用升级逻辑会：

1. 把旧表重命名为临时表；
2. 创建新表；
3. 只迁移 `_id, body, uid, owner`；
4. 删除临时表。

因此旧版本升级时，`added`、`puretext`、`attachment` 等字段可能丢失。这是一个明显的数据迁移缺陷。

## 9. 本地保存和编辑

编辑器使用 Android 富文本与 HTML 双向转换。

保存行为：

- 输入停止约 5 秒后，本地自动保存；
- Activity `onPause` 时触发同步；
- 已存在便签：更新 `body`、`puretext`、`added=当前时间`，并把 `owner` 清空；
- 新便签：插入 `body`、`puretext`、`added`；
- 原有 `uid` 保留，用于下一次 PATCH。

`owner = ''` 是 Floaty 自己设计的“本地内容待上传”状态，而不只是字面上的所属账户。

## 10. 完整同步链

```text
静默获取 Access Token
        ↓
Graph Delta 下行
        ↓
分页合并全部变化
        ↓
写入/合并本地 SQLite
        ↓
查询本地 dirty 便签
        ↓
已有 uid：PATCH
无 uid：复制模板 → PATCH
        ↓
保存新的 deltaLink
```

触发时机：

- 便签列表 Activity `onStart`
- 用户下拉刷新
- 编辑页面 `onPause`
- 网络恢复/相关生命周期回调

应用用一个全局状态位避免并行同步。

## 11. 冲突合并算法

Floaty 不是简单的全量覆盖，具体逻辑如下。

### 11.1 远端删除

Delta 项中有 `@removed` 时，本地将相同 UID 且已属于云端账户的记录：

```text
added = NULL
uid = NULL
owner = NULL
```

即移动到本地回收站。

### 11.2 远端较新或相同

如果：

```text
本地 added <= 远端 lastModifiedDateTime
```

则远端获胜，直接覆盖本地：

- body
- puretext
- added
- owner

### 11.3 本地较新

如果：

```text
本地 added > 远端 lastModifiedDateTime
```

执行：

1. 以远端纯文本和本地纯文本生成 diff；
2. 删除 diff 中所有“DELETE”操作；
3. 把剩余 patch 应用到远端文本；
4. 得到尽量同时保留两边文字的合并结果；
5. 写入本地，并清空 `owner`，等待重新上传。

其意图是：宁可重复，也不要静默丢字。

但它并不是严格的 CRDT、三方合并或版本向量：

- 删除操作容易被复活；
- 两边同时改同一句可能重复或错序；
- 合并基于纯文本，富文本样式会损失；
- 没有 ETag/`If-Match` 防止 PATCH 期间再次发生远端覆盖。

## 12. 上传成功确认机制

PATCH 成功后，Floaty 并不会立即把本地 `owner` 标记回账户邮箱。

它依赖下一次 Graph Delta 把刚才的服务端变化再次拉回来，再由下行同步写入 `owner`。因此：

```text
PATCH 成功
  ≠ 本地立即完全 synced
下一次 Delta 回传
  → 才形成最终确认
```

这是一个“服务端回显确认”模型。

## 13. 附件结构和限制

下行附件处理：

1. 请求 Message Attachments；
2. 读取 `contentBytes`；
3. Base64 解码；
4. 使用 `BitmapFactory` 解码为图片；
5. 保存到应用私有目录：`images/<attachment.name>`；
6. 本地数据库 `attachment` 字段保存空格分隔的文件名。

局限：

- 未发现本地新增图片上传到 Graph 的代码路径；
- 当前页附件没有明确的后续分页处理；
- 文件名用空格分隔，附件名本身含空格可能导致解析问题；
- 非图片附件或超大图片的失败处理较弱；
- 创建模板刻意选择“无附件”便签，避免复制旧图片。

## 14. 删除流程的可靠性缺陷

用户删除云端便签时：

1. 异步发起 Graph DELETE；
2. 不等待服务端确认，就立刻把本地 `added`、`uid`、`owner` 清空，移入回收站；
3. DELETE 失败时只记录日志。

结果：如果网络失败或 Graph 拒绝删除，本地已经失去远端 UID，无法自动重试；远端便签仍可能存在。这是实际可触发的数据一致性问题。

## 15. 悬浮窗、后台和系统组件

核心权限：

```text
INTERNET
ACCESS_NETWORK_STATE
RECEIVE_BOOT_COMPLETED
WAKE_LOCK
FOREGROUND_SERVICE
SYSTEM_ALERT_WINDOW
BILLING
AD_ID
```

主要组件：

- `NoteEdit`：启动页，同时接收 `SEND text/plain`
- `NoteViewer`
- `SettingsActivity`
- `DonationActivity`
- `RecycleBinViewer`
- `BootReceiver`
- 桌面小组件 Provider
- Quick Settings Tile
- `SimpleWindow` 悬浮窗 Service
- MSAL `BrowserTabActivity`

悬浮窗采用 StandOut 风格框架，在 Android 8+ 使用应用悬浮层权限，实现：

- 便签浮窗
- 拖动
- 缩放
- 前台 Service 常驻
- 开机恢复
- 快速设置入口

## 16. 第三方库和网络面

识别到：

- Microsoft Authentication Library for Android
- Microsoft Graph Java SDK
- Graph Java Core 字符串版本：`1.0.5`
- RxJava
- Google Mobile Ads / AdMob
- Google Play Billing `4.1.0`
- StandOut 类悬浮窗框架
- OpenCSV
- diff-match-patch

APK 包含 WorkManager、Room 等依赖代码，但没有发现 Floaty 自己用 Room 管理便签，也没有发现自定义 WorkManager Worker 承担核心同步；核心数据库是直接 SQLite，核心同步是 Activity/Repository 调用链。

Google Ads App ID：

```text
ca-app-pub-8663027256237159~6360163445
```

便签业务代码中未发现 Floaty 自建的同步 API 域名。网络访问主要分为：

- Microsoft 登录和 Graph
- Google Ads
- Google Play Billing
- OneNote Sticky Notes 网页
- Google Play 商店链接

## 17. 安全与隐私判断

### 相对正面的部分

- 没有申请存储、短信、联系人、位置权限；
- 便签同步直接连接 Microsoft Graph；
- 未发现便签正文上传到 Floaty 自建服务器的调用链；
- Access Token 没有由业务代码明文写入普通 SharedPreferences；
- 业务代码没有发现自定义证书绕过或明显恶意载荷。

### 风险和不足

1. `Mail.ReadWrite` 权限过宽，可读写整个邮箱。
2. 本地 SQLite 和图片文件未做应用层加密。
3. 邮箱、用户名、Delta Link 存在普通 SharedPreferences。
4. 未设置 `allowBackup=false`，数据可能受系统备份策略影响。
5. 未使用 ETag、`If-Match`、`changeKey`、Immutable ID。
6. 未发现证书固定（certificate pinning）。
7. 含广告 SDK 和 AD_ID 权限，会产生与同步无关的第三方网络流量。
8. Target SDK 32，到 2026 年已明显偏旧。
9. 删除失败不可可靠重试。
10. 冲突合并会损伤格式或复活已删除文字。

## 18. 对此前推测的纠正

以 APK 代码为准，以下事项已经可以纠正：

- **此前猜测“新建时手工写 MAPI 扩展属性”不准确。** Floaty 1.2.2 实际通过复制已有 Sticky Note 保留隐藏属性。
- **此前猜测“可能只是最后写入覆盖”不完整。** 它有时间戳判断和 diff-match-patch 加法式合并。
- **此前猜测“可能使用 Room”不准确。** 自有便签数据库是 SQLiteOpenHelper。
- **此前猜测“可能全量刷新”不准确。** 它明确使用 Graph Messages Delta。
- **它没有使用 `If-Match`、ETag、`changeKey` 和 Immutable ID。**
- **它没有使用 `/beta/me/notes`。** 核心一直是 Graph v1.0 的 Notes MailFolder Message。

## 19. 对 QuickNote 的可复用设计

Floaty 最值得复用的部分：

1. Graph Notes MailFolder + Delta。
2. “复制真实 Sticky Note 模板，再 PATCH”的创建策略。
3. 本地优先、编辑不阻塞网络。
4. 服务端 Delta 回显作为最终同步确认。
5. 本地保留纯文本投影，便于搜索和冲突处理。

不应照抄的部分：

1. 不要用 `owner=''` 同时承担所有同步状态，改用明确枚举状态。
2. 不要把附件名用空格拼成字符串，应建附件表。
3. 更新应使用 ETag/`If-Match` 或至少保存 `changeKey`。
4. 删除应先进入 `pending_delete`，服务端成功后再清除 UID。
5. 冲突应保存本地、远端和基准三个版本，允许三方合并或人工恢复。
6. HTML 应作为真源，纯文本只作为索引，不要在冲突时无条件退化格式。
7. 建议尝试 `Prefer: IdType="ImmutableId"`，并对特殊 Notes 文件夹实际验证。
8. 应把 Graph 访问封装在 Repository，不让界面直接依赖 Message 模型。

## 20. 最终评价

Floaty 的“完美同步”核心不是神秘 SDK，而是四个非常实用的工程选择：

```text
MSAL 单账户登录
+ Graph Notes/messages/delta
+ SQLite 本地优先
+ 复制真实便签作为新建模板
```

其中最有价值的逆向发现是“复制模板”。它绕开了 Graph Mail API 对 Sticky Note 隐藏 MAPI 属性支持不完整的问题，比直接 POST 普通 Message 更可靠。

Floaty 的同步体验确实经过了工程打磨，但还不能称为严格无冲突、无损同步：没有 ETag 和 Immutable ID，删除失败恢复薄弱，附件模型简单，冲突合并会损伤富文本。对于个人轻量便签足够好，但不适合作为高一致性企业数据同步范本原样照搬。
