# QuickNote 对 Floaty 逻辑的实现决策

## 1. 编辑与渲染三层模型

QuickNote 保留更强的 Tiptap 编辑器，但数据职责与 Floaty 对齐：

```text
Tiptap / ProseMirror 编辑器态
        ↓ storeEditorNoteHtml
LocalNote.bodyHtml（本地规范 HTML，图片为 quicknote-asset://）
        ↓ derivePlainTextFromStoredHtml
LocalNote.content（纯文本投影，用于搜索、摘要和冲突判断）
        ↓ prepareRemoteNoteHtml
Graph body HTML（图片为 cid:）
```

`bodyHtml` 是本地正文真源；`content` 是与 Floaty `puretext` 对应的派生字段，不能反向覆盖富文本正文。`lastSyncedBodyHtml` 是三方合并共同祖先，Floaty 没有这一层。

## 2. 本地保存策略

编辑器内容仍即时进入 React/Tiptap 内存态，但 IndexedDB 写入改为：

- 停止输入 5 秒后保存；
- 点击返回前强制保存；
- 页面进入后台、`pagehide`、组件卸载时尝试保存；
- 本地实体和 Outbox 操作仍位于同一个 Dexie 事务；
- 保存失败不会把草稿错误标记为已保存。

这与 Floaty 的 5 秒 debounce 和 `onPause` 强制保存一致，同时保留 QuickNote 的 revision/Outbox 安全性。

## 3. 远端新建策略

新增 `createRemoteNoteWithTemplate`：

1. 解析当前账户的 Notes 文件夹；
2. 按最后修改时间扫描最多 50 条消息；
3. 选择第一条没有附件的便签作为模板；
4. 调用 `/v1.0/me/messages/{id}/copy` 复制到 Notes 文件夹；
5. 立即把新远端 ID 写回本地；
6. 使用现有 `updateRemoteNote` PATCH 标题、正文、颜色和图片；
7. 后续失败时重试同一个远端对象，避免重复创建。

当账户中完全没有可复制的便签时，回退到现有的 `IPM.StickyNote` 显式创建逻辑，保证首次使用不被阻塞。

## 4. 同步时序

同步协调器调整为：

```text
获取 Token
  → Notes/Todo 远端下行
  → 重放本地 Outbox
  → 若写入过 Note，再拉一次 Notes Delta 做服务端回显确认
```

远端先行与 Floaty 一致。QuickNote 仍保留：

- `localRevision` / `syncedRevision`；
- 账户作用域；
- 显式 `pending/retry-wait/conflict/dead-letter`；
- Graph 当前快照回读；
- 富文本三方合并；
- 删除 404 幂等；
- 非幂等 POST 不自动重试。

## 5. 明确不照抄的 Floaty 设计

- 不用 `owner = ''` 同时表达多个同步状态；
- 不用纯文本 diff 重新生成 HTML；
- 不在 DELETE 未确认时清除远端 ID；
- 不把附件文件名用空格拼成一个字段；
- 不依赖普通 SQLite 无版本的隐式迁移；
- 不把完整图片 Base64 长期塞在便签行中；
- 不移除 CSP、HTML 白名单、账户隔离和图片大小限制。

## 6. 后续验证重点

- 个人 Microsoft 账户与组织账户的 `copy` 响应是否完全一致；
- 中文、英文和隐藏 Notes 文件夹的解析；
- 模板复制后 MAPI 颜色和 Sticky Notes 桌面表现；
- Graph copy 成功但网络响应丢失时的人工恢复路径；
- 多端同时修改标题、HTML 和图片时的三方合并结果；
- 大量便签首次 Delta 后的内存峰值。
