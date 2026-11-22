# PRD：审批通知卡片化

| 项目 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 创建日期 | 2026-11-02 |
| 状态 | P1-1～P1-3 已实现（2026-11-02，538 测试全绿）；P1-4 灰度待开启 |
| 适用平台 | nec-hub Worker（hub.newenergycoder.club）+ 飞书群自定义机器人 |
| 需求来源 | 审批通知为纯文本，无按钮、无 @ 人，审批靠复制链接跳转，申请人难以在群里定位结果通知 |

---

## 1. 背景与问题

审批引擎现有 7 条流程（reimburse / compliance / drawing_review / hardware_review / contract / 已停用的 drawing、hardware），通知能力现状：

- 群自定义机器人 **纯文本** webhook（`src/feishu/bot.ts` 的 `sendFeishuBotText`），审批处理靠文案尾部「去处理：链接」；
- 审批结果双通道（群机器人 + 邮件，`src/notify.ts` 的 `notifyApprovalResult`）；
- 按流程分群（`FEISHU_BOT_WEBHOOK_<FLOW>` 密钥 + 主群回退）。

问题：

- 文本消息无结构化展示，关键字段（单号/金额/状态）混在纯文本里；
- 无按钮，手机端跳转体验差；
- 不能 @ 人，申请人需要自己在群里翻结果通知；会签场景（contract）中间态进度无人被定向提醒。

## 2. 目标

- 提交通知与结果通知升级为**消息卡片**（标题 + 关键字段 + 状态 + 按钮）；
- 结果通知 **@ 申请人**，提交通知可配置 **@ 指定审批人**；
- 全程兼容降级：卡片发送失败回退纯文本；未开启配置的流程行为完全不变。

### 2.1 成功指标

| 指标 | 目标值 |
|---|---|
| 卡片发送失败自动回退文本率 | 100%（不丢通知） |
| 结果通知 @ 申请人覆盖率（有 open_id 的单据） | 100% |
| 存量流程行为回归 | 全量测试通过，未开启流程零变化 |

## 3. 技术约束核实（官方文档结论）

### 3.1 自定义机器人卡片不支持请求回调交互

飞书官方文档[《配置卡片交互》](https://open.feishu.cn/document/feishu-cards/configuring-card-interactions?lang=zh-CN)明确：**请求回调交互仅适用于通过应用发送的飞书卡片；卡片绑定自定义机器人用于发送时，不支持请求回调交互**。

推论：

- 自定义机器人卡片的按钮只能做 **URL 跳转**（`behaviors: open_url`），不能做「点击按钮直接在群里完成审批」；
- 卡片内直接审批（`card.action.trigger` 回调）必须由**应用机器人**发卡片，并在开发者后台配置「消息卡片请求网址」。

### 3.2 租户约束决定本期只能走 webhook 路线

- hub 的自建应用（FEISHU_APP_ID/SECRET）在**天合同创**租户；申请人与目标通知群在**常州工学院 NEC** 租户；
- 天合同创的应用机器人未上架、未对 NEC 租户可用，无法进入 NEC 的群发卡片；
- 因此「应用机器人 + 卡片回调」路线需要在 **NEC 租户另建自建应用**并重新走一套凭证/权限配置，成本与运维负担显著，本期不做（见 §7 远期预留）。

**群自定义机器人无此问题**：webhook 是群内实体，任意租户后台服务都能向其 POST，与底表所在租户无关。

### 3.3 @ 人能力

飞书官方文档[《机器人相关 FAQ》](https://open.feishu.cn/document/faq/bot?lang=zh-CN)：自定义机器人**只支持使用 open_id @ 指定人，或 @ 所有人**，不支持 user_id/email。

数据可得性：

- 申请人：引擎提交时已在底表写入 `申请人 open_id` 字段，结果通知可直接读取；
- 审批人：`approvers.roles` 是角色正则，无法解析到具体人，需新增配置项按 open_id 指定（见 §5.3）。

## 4. 方案选型

| 路线 | 能力 | 成本 | 结论 |
|---|---|---|---|
| A. 自定义机器人卡片 + URL 跳转按钮 + @ 人 | 结构化卡片、按钮跳门户/底表、@ 申请人/审批人 | 小，纯 Worker 侧改动，零新增应用 | **本期采用** |
| B. 应用机器人卡片 + 回调直接审批 | 群内点击即审批 | 需 NEC 租户新建应用 + 回调端点 + 权限体系 | 远期预留（§7） |

## 5. 功能需求

### 5.1 卡片发送通道（`src/feishu/bot.ts`）

- 新增低层 `sendFeishuBotCard(webhookUrl: string, card: object, secret?: string)`：`msg_type: "interactive"`，复用现有加签逻辑；
- 新增 `buildApprovalCard(input)` 构造卡片 JSON（卡片 JSON 2.0）：
  - 标题：流程标签 + 单号（如「图纸评审 DR-2026-0001」），按状态着色（待审蓝 / 通过绿 / 驳回红 / 中间态灰）；
  - 字段区：申请人、关键业务字段（沿用 `approvalNotifyContent` 的前 4 个非空字段规则）；
  - 按钮区：「查看单据」（`open_url` = `buildRecordLink` 底表记录链接）+「去审批」（`open_url` = 门户对应页面，带单号参数预填）；
- `notifyFeishu(env, flow, title, content, link?, card?)` 增加可选卡片参数：**卡片发送失败自动回退文本重发**，保留现有重试与 `notify:failed` 留痕。

### 5.2 引擎接入（`src/approvals/engine.ts`、`src/notify.ts`）

- `submitApprovalCore`：提交通知改为卡片（含「去审批」按钮）；
- `runApprovalAction`：状态流转通知改卡片；approve/reject 的 `notifyApprovalResult` 同步携带卡片与 @ 申请人；
- 会签中间态（contract「会签进度 x/y」）保持文本或轻卡片均可，第一版沿用文本。

### 5.3 @ 人

- 结果通知：`notifyApprovalResult` 增加 `applicantOpenId` 入参，engine 从记录的 `申请人 open_id` 字段读取，卡片/文本中插入 `<at user_id=ou_xxx></at>`；
- 提交通知：`flows:config` 每流程新增可选字段 `notifyAt?: string[]`（open_id 数组），配置后提交卡片 @ 这些审批人；未配置不 @ 任何人（不 @ 所有人，避免打扰）。

### 5.4 灰度开关

- `flows:config` 每流程新增 `cards?: boolean`（默认 `false`）：开启后该流程走卡片，未开启保持纯文本现状，可按流程逐个灰度；
- `config_flows` MCP 工具的 set 校验同步支持 `notifyAt` / `cards` 字段。

### 5.5 配置与密钥

- 无新增环境密钥（复用 `FEISHU_BOT_WEBHOOK_<FLOW>` 分流体系）；
- 门户「去审批」落地页按流程映射现有应用页（图纸/硬件/合同评审页、报销 ERP 页），URL 规则在设计评审时逐流程列清单。

## 6. 落地清单

| 阶段 | 内容 | 涉及文件 |
|---|---|---|
| P1-1 | `sendFeishuBotCard` + `buildApprovalCard` + `notifyFeishu` 卡片参数与失败回退 | `src/feishu/bot.ts` + 测试 |
| P1-2 | `cards` / `notifyAt` 配置字段与校验 | `src/approvals/flows.ts`、`src/approvals/handlers.ts` |
| P1-3 | 引擎提交/结果通知接卡片与 @ 人 | `src/approvals/engine.ts`、`src/notify.ts` + 测试 |
| P1-4 | 逐流程灰度开启并线上验证 | `config_flows` 配置 |

测试点：卡片发送失败回退文本；未开启流程零变化；`notifyAt` 空/非法值容错；@ 申请人 open_id 缺失时静默不 @；按钮 URL 与单号拼接正确。

## 7. 远期预留（本期不做）

- **卡片内直接审批**：在 NEC 租户新建自建应用 → 应用机器人进群 → Worker 新增 `/api/feishu/card-action` 回调端点（验签、幂等、点击人身份映射 `runApprovalAction` 守卫）→ 卡片按钮改 `callback` 行为。届时通知分流需同步支持「应用机器人发卡片」通道。
- 临时卡片（仅审批人可见的审批操作区）依赖应用机器人在群内发 ephemeral 卡片，同样归入该路线。

## 8. 风险与开放问题

- 门户「去审批」落地页若不支持单号预填，按钮只能做到跳列表页——评审时逐流程确认；
- 卡片 JSON 2.0 在自定义机器人 webhook 上的字段兼容性需先做一次线上试发验证（P1-1 验收项）；
- 会签场景 @ 下一位 pending 审批人（而非全员）是否要做，留待评审拍板。
