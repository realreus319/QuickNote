# QuickNote / 轻记

QuickNote 是一个纯前端 PWA 便签与待办应用，面向个人 Microsoft 账户用户。

它提供：

- Microsoft 账户登录
- Outlook Notes / Sticky Notes 同步
- 单一 HTML 富文本便签编辑
- 便签图片附件、截图粘贴、图片预览与复制
- Microsoft To Do 同步
- IndexedDB 本地缓存
- 离线阅读、离线编辑、恢复联网后自动同步
- 移动端优先的便签应用 UI

## 技术栈

- `pnpm`
- `Vite`
- `React`
- `TypeScript`
- `Tailwind CSS v4`
- `shadcn/ui`
- `TanStack Router`
- `TanStack Query`
- `Dexie`
- `@azure/msal-browser`
- `vite-plugin-pwa`

## 安装依赖

```bash
pnpm install
```

## 启动开发环境

```bash
pnpm dev
```

## 构建

```bash
pnpm build
```

## 本地预览

```bash
pnpm preview
```

## 常用脚本

```bash
pnpm lint
pnpm typecheck
pnpm test:run
```

## Microsoft App Registration 配置

应用使用以下 Entra App Registration：

- 应用名称：`QuickNote`
- Client ID：`28ff6548-87cc-47c8-b478-335cdcabde6c`
- Authority：`https://login.microsoftonline.com/consumers`
- Redirect URI：开发环境默认使用当前 origin，例如 `http://localhost:5173`

在 Microsoft Entra 后台中需要确认：

1. `Supported account types` 选择 `Personal Microsoft accounts only`
2. `Authentication` 平台选择 `Single-page application`
3. `Redirect URI` 填写本地 origin，例如 `http://localhost:5173`
4. `API permissions` 添加：
   - `User.Read`
   - `offline_access`
   - `Tasks.ReadWrite`
   - `Mail.ReadWrite`

## PWA 与离线能力

当前实现包含：

- Web App Manifest
- Service Worker 预缓存应用壳
- 离线刷新后重开应用壳
- IndexedDB 中已有便签与待办的离线读取
- 离线编辑写入 pending queue
- 恢复联网后自动尝试同步

注意：

- Service Worker 不缓存 Microsoft Graph 鉴权请求
- Service Worker 不缓存 access token
- 数据缓存统一走 IndexedDB

## Outlook Notes 同步

便签同步使用 Microsoft Graph Mail API 读取 Outlook Notes 文件夹：

- 优先读取 `v1.0/me/mailFolders/notes/messages`
- 如果 well-known `notes` 文件夹不可用，会枚举 `mailFolders` 并查找 `Notes` / `笔记` / `便笺`
- 详情页使用单一 HTML 富文本编辑器，不再拆分单独的 Markdown 预览区
- 便签详情页为独立全屏页面，列表卡片进入详情时会走 View Transition 共享元素动画
- 创建便签时会写入 `IPM.StickyNote` message class
- 图片使用 message inline attachments 同步，正文通过 HTML `cid:` 引用图片
- 小于 3 MB 的图片直接上传，大于 3 MB 的图片走 upload session
- 文字同步会基于 `changeKey` 和上次成功同步基线做三方合并，避免直接粗暴覆盖远端内容
- 图片同步按内联附件增删做 diff，不会在每次更新时整包重传所有图片

图片附件能力：

- 在便签详情页支持直接粘贴截图
- 支持文件选择添加 PNG、JPEG、GIF、BMP
- 支持本地预览、删除、复制回剪贴板
- 单张图片当前上限为 35 MB

应用会在便签同步失败时显示：

- `便签同步失败，可稍后重试`

待办同步失败时会显示：

- `待办同步失败，可稍后重试`

## 项目结构

```text
src/
  auth/
  components/
  db/
  graph/
  query/
  routes/
  sync/
  types/
  utils/
```

OpenSpec 变更文档位于：

```text
openspec/changes/build-quicknote-pwa/
openspec/changes/refine-note-detail-html-editor/
```

## 常见问题

### 登录失败

- 检查应用是否配置为 `Single-page application`
- 检查是否选择了 `Personal Microsoft accounts only`
- 检查浏览器是否阻止了登录跳转

### Redirect URI 不匹配

- 确认后台配置的 URI 与本地开发 origin 完全一致
- 常见情况是端口变化，例如 `5173` 与 `4173` 不一致

### 便签同步需要重新授权

- 当前实现需要 `Mail.ReadWrite`
- 如果之前已经登录过旧版本，请退出登录后重新连接 Microsoft 账户
- 应用会保留本地便签，不会因为远端失败崩溃

### 图片粘贴或复制不可用

- 某些浏览器只支持 `Ctrl/Cmd + V` 粘贴图片，不支持主动读取系统剪贴板
- 某些浏览器不允许网页把图片重新写回系统剪贴板
- 这两种情况下，文件选择添加和本地图片预览仍然可用

### 离线数据没有显示

- 先确认此前至少成功写入过本地 IndexedDB
- 如果刚清空缓存，需要重新登录或重新创建本地内容

### pnpm build 失败

- 先执行 `pnpm install`
- 再执行 `pnpm typecheck`
- 最后执行 `pnpm build`
- 如果是路由生成问题，先执行一次 `pnpm exec tsr generate`
