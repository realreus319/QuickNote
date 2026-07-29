# Floaty 逆向结论与 QuickNote 落地映射

本目录保存 `Floaty for Sticky Notes 1.2.2` 的静态逆向资料，以及 QuickNote 对这些结论的取舍。分析对象仅用于兼容性研究，不包含原 APK。

## 资料

- `Floaty_1.2.2_逆向分析报告.md`：APK、MSAL、Graph、SQLite、编辑器、附件和同步流程的完整静态分析。
- `Floaty_1.2.2_接口与数据结构.json`：便于后续程序化检索的结构化结论。
- `implementation-decisions.md`：QuickNote 本次改造的代码映射、保留项和拒绝照抄项。

## 最重要的已验证结论

1. Floaty 使用 Microsoft Graph Mail API，而不是 `/beta/me/notes`。
2. 下行使用 `/me/mailFolders/Notes/messages/delta` 并保存 `@odata.deltaLink`。
3. 新便签优先复制一个无附件的真实 Sticky Note，再 PATCH 副本。
4. 编辑器维护“编辑器态、HTML 持久态、纯文本投影”三层表示。
5. 本地先保存，停止输入约 5 秒后落盘，页面离开时强制保存。
6. 同步顺序是 Delta 下行、合并本地、上传本地脏数据、等待服务端回显。
7. Floaty 没有 ETag/If-Match、显式 Outbox、账户隔离和严格三方合并；QuickNote 不照抄这些弱点。

## 结论可信度

接口字符串、请求方法、数据库字段和主要调用链均来自静态代码证据。由于未使用真实 Microsoft 账户做动态抓包，不把运行时服务端差异、租户策略和不同账户类型兼容性写成已动态验证事实。
