# NEC HUB APP 互联互通使用手册

> 版本：V1.0
> 适用对象：内置应用开发者、静态应用发布者、外部系统接入负责人、设备应用负责人
> 配套文档：[《APP 互联互通规范》](APP互联互通规范_V1.0.md) · [子应用目录与内嵌约定](../web/apps/README.md)

本手册回答“怎样把一个 APP 接入 NEC HUB 并证明已经打通”。应用广场能打开只代表入口已发布；业务应用还需完成统一身份、服务端权限、同源数据和流程闭环验收。

## 1. 先确定集成等级

| 应用情况 | 选择等级 | 需要完成 |
| --- | --- | --- |
| 海报、静态资料、只读归档 | P | 入口、返回导航、公开范围与静态边界声明 |
| 只需识别用户和角色 | I | P + 飞书 `open_id` + 服务端鉴权 + 401/403 处理 |
| 评审、报销、合同、目标、任务等业务系统 | B | I + 同源数据 + 稳定业务 ID + 至少一条真实跨应用流程 |
| K1 等现实设备实时数据或控制 | D | I + 鉴权中继 + 在线/离线/过期状态；控制操作独立授权和审计 |

不确定时按较高等级设计。内置核心业务应用不能自行降为 P/I 来避开业务闭环验收。

## 2. 接入前准备

在应用 README 或上架说明中先写清以下内容：

```text
应用名称（name）：
负责人：
集成等级（P/I/B/D）：
可见范围（all/组别/角色）：
权威数据源：
稳定业务 ID：
依赖 HUB API：
写入与回写方向：
缓存时效：
跨应用流程：
验收日期与证据：
```

同时确认：

- `name` 使用 2–41 位小写字母、数字或连字符，并以字母或数字开头。
- 业务记录已有稳定 ID，不能只用标题或姓名关联。
- 已明确哪一端是数据权威来源，不在门户、独立页和外部系统各维护一份可写副本。
- 密钥只放 Wrangler secrets 或外部系统服务端，不进入 HTML、JavaScript、manifest 和仓库。
- 已准备至少一个普通队员账号；涉及财务、审批或管理动作时，再准备对应角色账号做对照。

## 3. 接入仓内内置应用

适用于需要门户 Tab、独立应用页和共享 Vue 组件的正式业务应用。

### 3.1 创建入口和共享组件

1. 新建 `web/apps/<name>/index.html`，模块脚本指向 `/src/apps/<name>/main.ts`。
2. 在 `web/src/apps/<name>/` 编写页面组件、状态、样式和 `main.ts`。
3. 独立页只通过 `?embedded=1` 控制展示，不使用 `window.parent` 或 iframe 嗅探。

`main.ts` 可按现有应用模式挂载：

```ts
import { createApp } from 'vue'
import ExampleApp from '@apps/example/ExampleApp.vue'

const embedded = new URLSearchParams(location.search).get('embedded') === '1'
createApp(ExampleApp, { embedded }).mount('#app')
```

门户 Tab 直接复用 `<ExampleApp embedded skip-auth-boot />`，不要复制第二套页面或默认使用 iframe。

### 3.2 复用登录态

组件从 `@shared/auth` 使用共享状态：

```ts
import { computed, onMounted } from 'vue'
import { auth, bootAuth, tryStartLogin } from '@shared/auth'

const props = withDefaults(
  defineProps<{ embedded?: boolean; skipAuthBoot?: boolean }>(),
  { embedded: false, skipAuthBoot: false },
)
const authed = computed(() => !!(auth.me.authenticated && auth.me.user))

onMounted(async () => {
  if (!props.skipAuthBoot) await bootAuth()
})
```

- 独立页：不要传 `skipAuthBoot`，由应用执行 `bootAuth()`。
- 门户内：传 `skip-auth-boot`，复用门户已经初始化的登录态。
- 业务关联使用 `auth.me.user.open_id`，不要只存展示姓名。
- 登录按钮使用 `tryStartLogin()`；登录完成后监听共享状态再加载数据。

### 3.3 接入权限和业务 API

- 前端调用既有 `/api/*` 服务；新增业务接口时，在服务端复用会话与角色解析。
- 401 显示登录引导，403 显示无权限说明，503 显示配置或上游未就绪；不要把它们都当成空列表。
- 审批统一进入审批引擎和待办聚合；附件使用既有上传链路；会议、通知等优先复用公共服务。
- 门户、独立页、首页组件和 MCP 必须读取同一服务或权威数据源。
- 状态变化后按声明的缓存时效刷新；需要立即可见时主动清缓存或提供强制刷新。

### 3.4 登记和构建

1. 在 `web/vite.config.ts` 的 `BUILTIN_APP_META` 登记标题、描述、图标和分组；Vite 自动发现 `web/apps/*/index.html`。
2. 如需门户 Tab，在门户中注册同一页面组件。
3. 执行：

```bash
npm run check
npm run test:ci
npm run build:web
```

4. 不要手改 `public/apps/<name>/index.html` 或 `public/portal-assets/` 构建产物。
5. 按第 7 节完成真实业务验收，再在上架说明中标记对应等级。

## 4. 发布 R2 静态应用

适用于 Vibe Coding 生成的单页 HTML 或多文件静态站，通过 MCP `deploy_app` 上架。

### 4.1 静态应用的安全边界

- 静态前端不能保存飞书 App Secret、MCP_TOKEN、设备凭证或其他管理密钥。
- 通过 `https://hub.newenergycoder.club/apps/<name>/` 访问时，可调用同源 HUB API，但仍由服务端鉴权。
- 通过 `<name>.newenergycoder.club` 独立域名访问时，不要假设 HUB 的 host-only 会话 Cookie 会自动共享；需要登录时应走外部应用 SSO/后端兑换流程。
- 只有静态展示能力的应用应声明 P 级，不得用演示数据冒充实时业务数据。

### 4.2 调用 deploy_app

向已接入 NEC HUB 的 Agent 提供以下参数：

```json
{
  "name": "inventory-check",
  "title": "物资盘点助手",
  "author": "队员姓名",
  "visibility": "all",
  "version": "0.1.0",
  "integration": {
    "level": "B",
    "owner": "物资组",
    "dataSource": "飞书 Base 物资台账",
    "businessId": "inventory.record_id",
    "apis": ["/api/dashboard"],
    "cacheTtl": "30 分钟",
    "status": "declared",
    "evidence": [],
    "notes": "尚未完成真实跨应用流程"
  },
  "files": [
    { "path": "index.html", "text": "<!doctype html>..." },
    { "path": "assets/app.js", "text": "..." }
  ]
}
```

限制：必须包含 `index.html`；单次最多 100 个文件；单文件不超过 2 MB，总量不超过 10 MB；文本用 `text`，二进制用 `base64`；路径不能包含 `..` 或以 `/` 开头。同名重复部署会覆盖更新，建议递增 `version`。

如果仓内已有同名内置应用，会形成双版本分叉：`/apps/<name>/` 仍打开仓内版本，R2 版本只从独立域名可达。非有意覆盖时应更换名称。

部署后检查：

1. `GET /api/apps` 中能看到应用，链接和可见范围正确。
2. `/apps/<name>/` 与独立域名按预期打开，没有意外覆盖内置应用。
3. 页面明确标注集成等级、数据来源和静态/实时状态。
4. 有写操作时按 I/B/D 完成身份、权限和流程验收。

## 5. 接入外部应用

适用于 MES、Vercel 项目或已有独立域名的系统。

### 5.1 打通身份和数据

1. 复用飞书 OAuth，由 HUB `/auth/feishu` 等服务端端点兑换 auth code；参考[《MES 飞书免登接入手册》](飞书免登接入_MES.md)。
2. 在外部系统服务端校验会话和角色，前端不能只凭本地存储的姓名决定权限。
3. 操作日志保存 `open_id`、业务 ID、时间和结果。
4. 明确数据同步方向、冲突规则和失败补偿；HUB 只保存必要索引与回链时，不得把索引当成业务本体。
5. 至少完成一条从 HUB 进入外部系统、处理业务、返回 HUB 查询结果的链路。

### 5.2 调用 register_app

```json
{
  "name": "mes-warehouse",
  "title": "NEC 仓库作业台",
  "author": "电控组",
  "url": "https://mes.newenergycoder.club/",
  "visibility": "all",
  "version": "1.0.0",
  "integration": {
    "level": "I",
    "owner": "电控组",
    "dataSource": "MES 自有库存与工单系统；HUB 仅保存应用索引",
    "businessId": "mes.work_order_id",
    "apis": ["HUB /auth/feishu", "MES 库存与工单 API"],
    "cacheTtl": "按 MES 接口声明",
    "status": "declared",
    "evidence": [],
    "notes": "登记入口不代表已完成 SSO 或业务验收"
  }
}
```

`register_app` 只负责登记入口，不会自动完成 SSO、权限或数据集成。登记后仍需按目标等级验收。

## 6. 接入 K1 等设备应用

当前仓内 `k1` 仅为 P 级静态预览和局域网入口，不是实时设备连接。升级到 D 级时按以下顺序实施：

1. 建立受控服务端中继，由中继访问设备，浏览器不直连设备管理端口。
2. 先提供只读状态、温度和历史数据；响应必须带设备在线状态、数据时间和来源。
3. 明确显示离线、数据过期和中继不可用，不能继续展示旧数据却标成“实时”。
4. 不公网映射 K1 端口，不在公网页面创建未鉴权的 `ws://` 内网连接，不在前端写设备凭证。
5. 查询与控制分离。打印、停止、调参等控制默认关闭；确需开放时另做角色授权、二次确认、审计和安全验收。

## 7. 验收与上架记录

### 7.1 通用检查

- 应用广场、门户和独立页入口符合目标等级，刷新深链和返回导航正常。
- 同一飞书账号在各入口身份一致，没有重复登录或第二套生产账号。
- 普通队员与适用管理角色的可见范围和可操作动作不同，服务端 401/403 生效。
- 未配置、上游超时、限流、离线时有明确提示，不白屏、不静默成功、不展示假实时数据。
- 所有密钥均不在前端和仓库中。

### 7.2 B 级业务闭环检查

至少选择一条真实流程完成端到端操作：

```text
发起端提交
→ 获得稳定业务 ID
→ 审批/待办端出现同一记录
→ 完成处理
→ 原业务状态回写
→ 门户/独立页/台账按缓存时效显示同一结果
→ 审计可查到操作人和时间
```

记录实际单号、测试账号角色、操作时间、各端截图或 API 响应。只跑类型检查、单元测试或静态页面截图，不能替代业务闭环验收。

### 7.3 验收记录模板

```markdown
## APP 互联互通验收

- 应用/版本：
- 集成等级：
- 负责人：
- 验收日期：
- 权威数据源：
- 业务 ID：
- 依赖 API：
- 测试账号与角色：
- 端到端流程及实际单号：
- 401/403/503 结果：
- 缓存与一致性结果：
- 降级与失败补偿结果：
- 证据链接：
- 结论：通过 / 有条件通过 / 不通过
- 遗留问题：
```

## 8. 常见问题

**应用已经在应用广场，为什么还不算打通？**
因为 `deploy_app` 和 `register_app` 解决的是托管与入口登记。身份、权限、数据和流程需要按目标等级另行接入和验收。

**门户和独立页数据不一致怎么办？**
先检查是否复制了两份状态或调用了不同接口，再检查缓存 TTL 与写后失效逻辑。长期方案是复用同一组件、服务和权威数据源，而不是定时互相拷贝。

**外部应用只拿到用户姓名，能完成 I 级吗？**
不能。正式关联和鉴权需要稳定的 `open_id`，并由服务端校验权限；姓名仅用于展示。

**静态应用能否直接调用管理 MCP 工具？**
不能把管理 token 放进静态页面。需要写操作时，应通过有鉴权的服务端接口，且按当前用户角色授权。

**K1 公网预览能直接连接局域网地址吗？**
不能按实时连接处理。公网直连存在可达性和安全风险，实时数据必须经过受控中继。

## 9. 发布后维护

- 数据源、业务 ID、权限、API、缓存或同步方向变化时，同步更新应用 README、验收记录和本手册相关说明。
- 每次重大版本更新重新执行对应等级验收，不沿用旧版本“已打通”结论。
- 负责人变更时一并交接配置位置、密钥名称、外部系统回链和故障降级方式；密钥值不写入文档。
