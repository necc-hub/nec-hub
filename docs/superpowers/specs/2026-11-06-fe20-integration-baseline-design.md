# FE-20 第一阶段：可信上架与权限基线设计

> 日期：2026-11-06
> 状态：已获方案 A 确认，按继续执行指令进入实施
> 依据：`docs/团队AI中台PRD_V2.1.md` §15、`docs/APP互联互通规范_V1.0.md`

## 1. 背景与目标

FE-20 要求应用达到“入口可达、身份一致、权限一致、数据同源、流程闭环”，并禁止仅登记链接、嵌入 iframe 或隐藏前端按钮就宣称完成集成。

当前主要差距是：

- `AppEntry`、内置应用 manifest 和上架工具没有 P/I/B/D、负责人、权威数据源、业务 ID、缓存时效与验收证据。
- 应用广场无法区分未声明、待验收、部分验证和生产已验收。
- MCP 在未配置 `MCP_TOKEN` 时会把只读调用上下文误标为管理端；配置 Token 后又会阻断独立的 `user_token` 路径。
- `task-schedule` 仍使用 `localStorage`，CLA 仍允许匿名签署，均不能满足其目标集成等级。
- K1 已明确静态预览边界，应保持 P 级，不提前实现 D 级。

第一阶段目标是建立可信的声明、发布、展示和 MCP 权限基线，使后续逐应用业务闭环有统一的数据与验收载体。

## 2. 范围

### 2.1 本阶段交付

1. 统一的 `AppIntegration` 类型、运行时校验和证据规则。
2. 仓内内置应用逐应用声明，构建时校验并进入 `/api/apps` 合并视图。
3. `deploy_app`、`register_app`、`sync_vercel` 的上架声明门槛。
4. 应用广场的等级、验收状态、静态边界和废弃标识。
5. MCP 匿名、用户、管理三类身份的统一处理及财务数据权限回归。
6. 发布 Prompt、README 与 PRD 进展同步。
7. 覆盖声明、无副作用失败、manifest、MCP 权限矩阵和展示语义的测试。

### 2.2 明确不在本阶段交付

- 不迁移 `task-schedule` 的 `localStorage` 到服务端。
- 不禁止 CLA 匿名签署，不新增 GitHub OAuth 或第二套成员账号。
- 不批量改造所有应用的共享登录、深链和业务闭环。
- 不迁移审批底表到其他数据平台，不处理 KV 单号、Outbox 等独立架构议题。
- 不实现 K1 实时中继、设备控制或 D 级验收。
- 不把自动化测试、截图或 README 单独当成生产验收证据。

这些未达标应用保留入口并如实标为待验收或部分验证，不能标记为已打通。

## 3. 方案选择

采用分阶段方案，而非全量大改或仅补文档：

- 第一阶段先保证“声明可信、状态可信、权限可信”。
- 第二阶段处理核心应用共享登录、深链与导航。
- 第三阶段分别完成报销、图纸评审等跨应用端到端闭环。
- 任务排期数据迁移和 CLA 外部贡献者身份方案分别独立评审，避免在本阶段引入高风险行为变更。

## 4. 集成声明模型

新增共享类型 `AppIntegration`，字段定义如下：

```ts
type IntegrationLevel = "P" | "I" | "B" | "D"
type IntegrationStatus = "declared" | "partial" | "verified"
type IntegrationEvidenceType = "test" | "document" | "production"

interface IntegrationEvidence {
  type: IntegrationEvidenceType
  ref: string
  date: string
  summary?: string
}

interface AppIntegration {
  level: IntegrationLevel
  owner: string
  dataSource: string
  businessId?: string
  apis: string[]
  cacheTtl: string
  status: IntegrationStatus
  evidence: IntegrationEvidence[]
  notes?: string
  deprecated?: boolean
}
```

字段语义固定为：

- `owner`：真实负责人或职能组；没有个人信息时使用团队/职能组，不虚构个人。
- `dataSource`：当前实际权威来源，而不是目标来源。例如任务排期必须写 `localStorage`。
- `businessId`：I/B/D 必须提供稳定 ID；纯 P 级静态应用可省略。
- `apis`：实际依赖 API；纯静态 P 应用允许空数组。
- `cacheTtl`：使用人类可读但明确的时效，如 `无缓存`、`5 分钟`、`静态构建产物`。
- `status`：
  - `declared`：只有声明，尚未形成有效验收证据。
  - `partial`：至少有一条 `test` 或 `production` 证据，但生产验收未闭环。
  - `verified`：由负责人显式声明生产验收完成，并至少有一条对应应用的 `production` 证据。
- `evidence.ref`：仓库相对路径或可访问 URL；证据必须可定位，不接受空字符串。
- `evidence.date`：ISO `YYYY-MM-DD`。
- `evidence.summary`：`production` 证据必填，记录生产环境、角色和实际验收场景，供人工复核；代码不自动判断证据真实性。
- `deprecated`：独立于验收状态；旧 `drawing` 标记废弃，不因历史测试而重新标为已打通。

校验规则：

1. 所有等级均要求非空 `level/owner/dataSource/cacheTtl` 和合法 `apis/evidence` 数组。
2. I/B/D 要求非空 `businessId`；B 在 `partial/verified` 时至少声明一个实际业务 API，`declared` 允许 `apis` 为空但必须在 `notes` 写明未接入原因。
3. `partial` 必须至少有一条 `test` 或 `production` 证据。
4. `verified` 必须至少有一条带 `summary` 的 `production` 证据；`document` 和 `test` 不能单独满足。
5. 未知字段不参与判定并在读取时原样透传；上述必填字段和枚举必须严格校验。
6. 代码和构建只校验结构与证据规则，不自动把任何应用升级为 `verified`。

## 5. 内置应用声明与构建

每个仓内应用增加 `web/apps/<name>/integration.json`。Vite 构建 manifest 时读取并调用同一共享校验模块：

- 缺文件、JSON 损坏或字段不合法时构建失败，并指出具体应用和字段。
- 合法声明写入 `public/apps/builtin.json`，再由 `readBuiltinManifest` 和 `listPortalApps` 透传。
- `BUILTIN_APP_META` 继续负责标题、图标、描述和分组，不再承担集成验收语义。
- K1 等纯静态 HTML 应用同样提供声明，无需为了声明改成 Vue 应用。

初始等级和状态固定如下：

| 应用 | 等级 | 初始状态 | 证据或缺口 |
| --- | --- | --- | --- |
| `drawing-review` | B | partial | `src/__tests__/drawing-review-e2e.test.ts`；不自动记生产验收 |
| `hardware-review` | B | partial | `src/__tests__/hardware-review.test.ts` 与通知测试；真实硬件流程待验收 |
| `contract-signing` | B | partial | `src/contract-approval/__tests__/contract-approval.test.ts` |
| `reimburse` | B | partial | `src/__tests__/erp-reimburse.test.ts`；生产报销闭环待验收 |
| `compliance` | B | declared | 暂无足够的独立业务闭环证据 |
| `season-goals` | B | partial | `src/season-goals/__tests__/season-goals.test.ts`；目标与任务稳定 ID 关联仍是缺口 |
| `task-schedule` | B | declared | 当前权威数据为 `localStorage`，`apis` 为空并在 notes 说明未接任务服务 |
| `domains` | I | partial | `src/__tests__/domains.test.ts`；生产申请一单不自动生成证据 |
| `cla-sign` | I | declared | 匿名签署与目标等级冲突写入 notes |
| `scoring` | P | declared | 静态数据边界，无生产验收证据 |
| `mech-review-6014` | P | declared | 静态归档边界，无生产验收证据 |
| `ress-solution` | P | declared | `web/src/apps/ress-solution/data.ts` 与本地静态资产；无生产验收证据 |
| `k1` | P | declared | 静态预览，不连接打印机，不宣称 D 级 |
| `drawing` | B（旧轻审批） | declared + deprecated | `deprecated: true`，仅保留兼容入口 |

上述 `partial` 均只表示存在对应的自动化测试证据，不表示生产业务闭环已经完成。

## 6. 外部应用上架门槛

### 6.1 `deploy_app` 与 `register_app`

- MCP schema 增加必填 `integration` 对象。
- 新上架和覆盖更新都必须提供完整声明。
- 校验在任何 R2 上传、缓存失效或 KV 写入之前完成；失败时不产生副作用。
- 已存在但没有声明的历史 KV 记录继续可读，不强制离线迁移；其更新必须补声明。
- 返回文案区分“已上架”与“已验收”，上架成功不等于业务打通。

### 6.2 `sync_vercel`

- 增加按应用名提供的 `integrations` 映射。
- dry-run 输出每个新项目的声明缺失或校验错误。
- `confirm=true` 时先验证全部待新增项目；任一缺失或非法则整批不写，避免半批合规、半批未声明。
- 已存在且本轮跳过的项目不重复强制更新；后续单独更新时仍需补声明。

### 6.3 历史应用

`AppEntry.integration` 对历史数据保持可选。`/api/apps` 对缺失声明返回 `integration: null`，前端显示“未声明”，不阻断原入口，也不伪造默认 P 级。

## 7. 应用广场展示

新增轻量 `IntegrationBadge` 展示组件，并复用到核心、独立和社区应用卡片：

- 等级：`P 公开/只读`、`I 身份`、`B 业务`、`D 设备`。
- `declared`：待验收。
- `partial`：部分验证。
- `verified`：生产已验收。
- 缺失声明：未声明。
- `deprecated`：已废弃，验收徽章不再暗示可用性升级。

卡片同时保留现有 `shadows` 双版本提示。K1 页面增加明确的“P 级静态预览”文字，保留现有不连接打印机、不创建内网 WebSocket、不提供远程控制的边界。

本阶段不增加新的前端框架、iframe 集成或复杂详情页。

## 8. MCP 身份与权限设计

### 8.1 统一语义

`hasMcpToken` 只能在 Bearer 与已配置 `MCP_TOKEN` 成功匹配时为 `true`，不再表示“允许只读降级”。

身份分为：

- 管理端：有效 Bearer `MCP_TOKEN`。
- 用户端：工具参数中的有效飞书 `user_token`，再按 `open_id` 解析角色。
- 匿名：没有任何有效身份，只允许协议元数据和明确放行的只读入口；不能继承管理权限。

无效 Bearer 必须返回 401，不能回落为用户或匿名身份。

### 8.2 协议方法与工具调用

- `initialize`、`ping`、`notifications/initialized`、`tools/list` 可以公开，只暴露协议元数据，不返回业务记录。
- `tools/call` 在管理端按现有工具边界执行。
- 非管理端只能调用注册表中的 `readOnly` 工具；写工具无论是否配置环境 Token 都保持 fail-closed。
- 工具自身的用户权限检查继续执行，`readOnly` 只描述无副作用，不表示公开或已认证。

### 8.3 `whoami`、`query_bitable` 与 `list_todos`

- `whoami`：管理端返回 admin；有效 `user_token` 返回用户身份；匿名返回身份缺失错误，不再误报 Token 持有者。
- `query_bitable`：非管理调用必须提供有效 `user_token`，且角色解析结果必须 `matched=true` 并不为 `external`；`finance` 额外要求队长/财务。名单缺失、读取失败或无法匹配时返回权限错误，不按普通队员放宽。
- `list_todos`：本阶段继续要求管理端，不借只读降级开放他人待办。

MCP 保持 JSON-RPC 错误形状；工具的 `isError: true` 不得被前端解释为业务成功。

## 9. 错误与兼容策略

- 声明错误：指出应用名和字段，在副作用之前失败。
- 历史缺声明：保留入口并显示未声明，不返回 500。
- 内置声明错误：构建失败，防止不合规 manifest 进入生产。
- MCP 未认证/无权限：按协议返回 401 或工具错误，不返回伪造的管理员或业务数据。
- 未配置上游：沿用现有 503/降级提示，不用静态数据冒充实时结果。
- 现有 API URL、应用入口、KV key、R2 路径保持不变。
- 上架工具新增必填参数属于有意的客户端契约升级，同步修改发布 Prompt、工具描述和 README。

## 10. 测试设计

遵循测试先行，先写失败用例再实现：

1. **声明校验**：P/I/B/D 必填项、业务 ID、API、证据类型、日期和状态升级规则。
2. **上架副作用**：缺声明或非法声明时 R2 put、KV put、缓存删除均为零调用。
3. **批量同步**：dry-run 能报告缺失；confirm 任一非法时整批无写入。
4. **合并视图**：内置声明透传、历史 `integration: null`、shadows 行为不回归。
5. **构建校验**：缺文件/坏 JSON/非法字段阻断构建，合法声明进入 manifest。
6. **MCP 矩阵**：有无环境 Token × 无 Bearer/有效 Bearer/无效 Bearer × 有无 user_token，覆盖 whoami、finance、普通业务表、写工具和协议元数据。
7. **展示语义**：未声明、待验收、部分验证、生产已验收、废弃和 K1 静态边界。
8. **回归**：`npm run check`、`npm run test:ci`、`npm run build:web` 全量执行。

自动化测试只能支持 `partial`，不能自动产生 `production` 证据或将应用升级为 `verified`。

## 11. 文档与交接

- 更新根 README 的应用上架参数、集成声明示例和 MCP 身份边界。
- 更新发布 Prompt，要求 Agent 先识别真实数据源、业务 ID、负责人和证据。
- 保留用户当前对 PRD、`web/apps/README.md` 和互联互通规范的未提交修改，只在相关位置增量补充，不覆盖已有内容。
- PRD 只记录第一阶段实际完成项和仍需生产/应用级验收的缺口，不把 FE-20 整体标记完成。

## 12. 本阶段验收标准

1. 新增或更新外部应用缺少合法声明时，在任何外部副作用前被拒绝。
2. 所有仓内应用均有合法声明，构建产物与 `/api/apps` 能读取相同等级和状态。
3. 历史未声明应用仍可打开，但界面明确显示未声明。
4. 无任何应用仅凭单元测试、截图或 README 被标为生产已验收。
5. MCP 匿名调用不再获得管理员身份或财务记录；有效用户路径可用；无效 Bearer 不能降级。
6. K1 只按 P 级静态预览展示，无实时控制或假实时状态。
7. 后端类型检查、全量测试和前端构建通过，文档与实际行为一致。

## 13. 后续独立项目

1. 核心应用共享登录、401/403/503 引导、深链和返回导航。
2. 报销与图纸评审的“提交—待办—状态回写—结果查询”跨应用验收。
3. `task-schedule` 从本地副本迁移到权威任务服务，并建立稳定关联 ID。
4. CLA 外部贡献者身份方案，在不新建第二套成员账号的前提下满足 I 级。
5. K1 只读中继、安全审计和独立控制授权。

每个后续项目单独评审范围和生产证据，不复用本阶段的 partial 状态冒充完成。
