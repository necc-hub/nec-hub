# K1 Dashboard — NEC Hub 应用入口

- 公网地址：`/apps/k1/`
- 页面性质：静态项目预览与局域网入口导航，不连接打印机。
- 实时版源码：`~/.openclaw/workspace/projects/k1-central/`
- 当前实时入口：`http://192.168.8.58:8081/native.html`（Mac DHCP 变化后需同步更新）
- 预览图来源：`projects/k1-central/qa/browser/overview-desktop.png`，为 2026-11-03 真实只读验收截图。

## 发布边界

公网页面不得直接创建 `ws://` 内网连接，也不提供打印控制。后续如需自定义域名和跨网络实时数据，应单独设计鉴权、只读中继与安全域名，不做 K1 端口公网映射。

更新入口或截图后，运行 `npm run build:web`，再按 nec-hub 正常流程提交、推送和 `npx wrangler deploy`。
