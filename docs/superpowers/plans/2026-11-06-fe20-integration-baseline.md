# FE-20 Integration Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 为 14 个内置应用和所有新上架应用建立可信的 P/I/B/D 声明、验收状态与 MCP 身份权限基线。

**Architecture:** 共享 `AppIntegration` 类型和校验函数同时服务 Worker、Vite 构建与前端徽章。历史记录保持可读但未声明，新上架在副作用前强制校验；MCP 将只读、公开与管理员身份解耦。

**Tech Stack:** Cloudflare Workers、TypeScript、Vue 3、Vite、Vitest、KV/R2（mock 与本地 Miniflare）。

---

## 执行约束

- 依据：`docs/superpowers/specs/2026-11-06-fe20-integration-baseline-design.md`。
- 当前会话使用 `executing-plans` 内联执行，不启用子代理。
- 不执行 `git commit`、`git push` 或生产部署。
- 保留 PRD、README、`web/vite.config.ts`、`ress-solution` 等并行改动；编辑前重读目标片段。
- 每个任务先红后绿，检查点不提交代码。

### Task 1: 集成声明模型、校验与徽章语义

**Files:**
- Create: `src/shared/app-integration.ts`
- Create: `src/__tests__/app-integration.test.ts`
- Create: `src/__tests__/app-integration-fixtures.ts`

- [x] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { integrationBadgeModel, validateAppIntegration } from "../shared/app-integration";
import { validIntegration } from "./app-integration-fixtures";

describe("AppIntegration", () => {
  it("接受带测试证据的 B/partial", () => {
    expect(validateAppIntegration(validIntegration(), "demo").level).toBe("B");
  });
  it("I/B/D 缺 businessId 时拒绝", () => {
    for (const level of ["I", "B", "D"] as const) {
      expect(() => validateAppIntegration(validIntegration({ level, businessId: undefined }), "demo"))
        .toThrow(/businessId/);
    }
  });
  it("B/declared 允许空 APIs 但必须有缺口说明；partial 不允许", () => {
    expect(validateAppIntegration(validIntegration({ status: "declared", apis: [], evidence: [], notes: "尚未接服务" }), "demo").apis)
      .toEqual([]);
    expect(() => validateAppIntegration(validIntegration({ apis: [] }), "demo")).toThrow(/apis/);
  });
  it("verified 必须有带 summary 的生产证据", () => {
    expect(() => validateAppIntegration(validIntegration({ status: "verified" }), "demo")).toThrow(/production/);
    const verified = validIntegration({
      status: "verified",
      evidence: [{ type: "production", ref: "docs/acceptance.md", date: "2026-11-06", summary: "生产财务角色完成一单" }],
    });
    expect(validateAppIntegration(verified, "demo").status).toBe("verified");
  });
  it("徽章不把未声明或废弃应用显示为已验收", () => {
    expect(integrationBadgeModel(null).statusLabel).toBe("未声明");
    expect(integrationBadgeModel(validIntegration({ deprecated: true, status: "verified", evidence: [{ type: "production", ref: "docs/x.md", date: "2026-11-06", summary: "历史生产验收" }] })).statusLabel)
      .toBe("已废弃");
  });
});
```

- [x] **Step 2: 运行测试确认红灯**

Run: `npx vitest run src/__tests__/app-integration.test.ts`
Expected: FAIL，找不到 `../shared/app-integration` 和 fixture。

- [x] **Step 3: 写共享 fixture**

```ts
import type { AppIntegration } from "../shared/app-integration";

export function validIntegration(patch: Partial<AppIntegration> = {}): AppIntegration {
  return {
    level: "B",
    owner: "NEC 测试组",
    dataSource: "飞书 Base 测试表",
    businessId: "TEST-*",
    apis: ["/api/demo"],
    cacheTtl: "5 分钟",
    status: "partial",
    evidence: [{ type: "test", ref: "src/__tests__/app-integration.test.ts", date: "2026-11-06" }],
    notes: "仅测试证据",
    ...patch,
  };
}
```

- [x] **Step 4: 实现共享模型**

```ts
export type IntegrationLevel = "P" | "I" | "B" | "D";
export type IntegrationStatus = "declared" | "partial" | "verified";
export type IntegrationEvidenceType = "test" | "document" | "production";

export interface IntegrationEvidence {
  type: IntegrationEvidenceType;
  ref: string;
  date: string;
  summary?: string;
}

export interface AppIntegration {
  level: IntegrationLevel;
  owner: string;
  dataSource: string;
  businessId?: string;
  apis: string[];
  cacheTtl: string;
  status: IntegrationStatus;
  evidence: IntegrationEvidence[];
  notes?: string;
  deprecated?: boolean;
}

export const APP_INTEGRATION_INPUT_SCHEMA = {
  type: "object",
  properties: {
    level: { type: "string", enum: ["P", "I", "B", "D"] },
    owner: { type: "string" },
    dataSource: { type: "string" },
    businessId: { type: "string" },
    apis: { type: "array", items: { type: "string" } },
    cacheTtl: { type: "string" },
    status: { type: "string", enum: ["declared", "partial", "verified"] },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["test", "document", "production"] },
          ref: { type: "string" },
          date: { type: "string" },
          summary: { type: "string" },
        },
        required: ["type", "ref", "date"],
      },
    },
    notes: { type: "string" },
    deprecated: { type: "boolean" },
  },
  required: ["level", "owner", "dataSource", "apis", "cacheTtl", "status", "evidence"],
} as const;

const LEVELS = new Set(["P", "I", "B", "D"]);
const STATUSES = new Set(["declared", "partial", "verified"]);
const EVIDENCE_TYPES = new Set(["test", "document", "production"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const filled = (v: unknown): v is string => typeof v === "string" && !!v.trim();

export function validateAppIntegration(value: unknown, appName = "unknown"): AppIntegration {
  const errors: string[] = [];
  if (!record(value)) throw new Error(`应用 ${appName} 缺少合法 integration 对象`);
  if (!LEVELS.has(String(value.level))) errors.push("level 必须是 P/I/B/D");
  for (const key of ["owner", "dataSource", "cacheTtl"] as const) {
    if (!filled(value[key])) errors.push(`${key} 不能为空`);
  }
  if (!STATUSES.has(String(value.status))) errors.push("status 必须是 declared/partial/verified");
  if (["I", "B", "D"].includes(String(value.level)) && !filled(value.businessId)) errors.push("I/B/D 必须提供 businessId");
  if (!Array.isArray(value.apis) || value.apis.some((v) => !filled(v))) errors.push("apis 必须是非空字符串数组");
  const apis = Array.isArray(value.apis) ? value.apis : [];
  if (value.level === "B" && value.status !== "declared" && apis.length === 0) errors.push("B/partial/verified 至少需要一个 apis 项");
  if (value.level === "B" && value.status === "declared" && apis.length === 0 && !filled(value.notes)) {
    errors.push("B/declared 空 apis 时必须在 notes 说明未接入原因");
  }
  if (!Array.isArray(value.evidence)) errors.push("evidence 必须是数组");
  const evidence = Array.isArray(value.evidence) ? value.evidence : [];
  evidence.forEach((item, index) => {
    if (!record(item)) { errors.push(`evidence[${index}] 必须是对象`); return; }
    if (!EVIDENCE_TYPES.has(String(item.type))) errors.push(`evidence[${index}].type 不合法`);
    if (!filled(item.ref)) errors.push(`evidence[${index}].ref 不能为空`);
    if (!filled(item.date) || !DATE_RE.test(item.date) || Number.isNaN(Date.parse(`${item.date}T00:00:00Z`))) {
      errors.push(`evidence[${index}].date 必须是 YYYY-MM-DD`);
    }
    if (item.type === "production" && !filled(item.summary)) errors.push(`evidence[${index}].summary 生产证据必填`);
  });
  if (value.status === "partial" && !evidence.some((e) => record(e) && ["test", "production"].includes(String(e.type)))) {
    errors.push("partial 至少需要 test 或 production 证据");
  }
  if (value.status === "verified" && !evidence.some((e) => record(e) && e.type === "production" && filled(e.summary))) {
    errors.push("verified 至少需要带 summary 的 production 证据");
  }
  if (errors.length) throw new Error(`应用 ${appName} 集成声明不合法：${errors.join("；")}`);
  return value as AppIntegration;
}

const LEVEL_LABEL = { P: "公开/只读", I: "身份", B: "业务", D: "设备" } as const;
const STATUS_LABEL = { declared: "待验收", partial: "部分验证", verified: "生产已验收" } as const;
export function integrationBadgeModel(integration?: AppIntegration | null) {
  if (!integration) return { levelLabel: "", statusLabel: "未声明", tone: "muted" as const };
  if (integration.deprecated) return { levelLabel: `${integration.level} ${LEVEL_LABEL[integration.level]}`, statusLabel: "已废弃", tone: "danger" as const };
  return {
    levelLabel: `${integration.level} ${LEVEL_LABEL[integration.level]}`,
    statusLabel: STATUS_LABEL[integration.status],
    tone: integration.status === "verified" ? "success" as const : integration.status === "partial" ? "info" as const : "warn" as const,
  };
}
```

- [x] **Step 5: 运行测试并检查点**

Run: `npx vitest run src/__tests__/app-integration.test.ts && git diff --check`
Expected: PASS，无空白错误。

### Task 2: 14 个内置声明、Vite manifest 与合并视图

**Files:**
- Create: `web/apps/{drawing-review,hardware-review,contract-signing,reimburse,compliance,season-goals,task-schedule,domains,cla-sign,scoring,mech-review-6014,ress-solution,k1,drawing}/integration.json`
- Modify: `web/vite.config.ts`
- Modify: `src/hosting.ts`
- Modify: `src/__tests__/portal-apps.test.ts`
- Create: `src/__tests__/builtin-integration.test.ts`

- [x] **Step 1: 写内置声明和合并视图失败测试**

```ts
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { validateAppIntegration } from "../shared/app-integration";

const names = ["drawing-review", "hardware-review", "contract-signing", "reimburse", "compliance", "season-goals", "task-schedule", "domains", "cla-sign", "scoring", "mech-review-6014", "ress-solution", "k1", "drawing"];

describe("内置应用集成声明", () => {
  it.each(names)("%s 声明合法且没有自动生产验收", (name) => {
    const raw = JSON.parse(fs.readFileSync(`web/apps/${name}/integration.json`, "utf8"));
    const integration = validateAppIntegration(raw, name);
    expect(integration.status).not.toBe("verified");
  });
  it("K1 仅 P 级静态预览，任务排期如实声明 localStorage", () => {
    const k1 = JSON.parse(fs.readFileSync("web/apps/k1/integration.json", "utf8"));
    const tasks = JSON.parse(fs.readFileSync("web/apps/task-schedule/integration.json", "utf8"));
    expect(k1.level).toBe("P");
    expect(k1.notes).toMatch(/不连接打印机/);
    expect(tasks.dataSource).toMatch(/localStorage/);
    expect(tasks.apis).toEqual([]);
  });
});
```

同时给 `portal-apps.test.ts` 的一个 builtin fixture 加合法 `integration`，断言 `/api/apps` 原样透传；旧 fixture 不带声明时断言 `integration === null`。

- [x] **Step 2: 运行测试确认红灯**

Run: `npx vitest run src/__tests__/builtin-integration.test.ts src/__tests__/portal-apps.test.ts`
Expected: FAIL，14 个 JSON 尚不存在，合并视图未归一化 `integration`。

- [x] **Step 3: 按固定值创建 14 个声明**

通用结构：

```json
{
  "level": "P",
  "owner": "NEC 平台维护者",
  "dataSource": "web/src/apps/example/data.ts",
  "apis": [],
  "cacheTtl": "静态构建产物",
  "status": "declared",
  "evidence": [],
  "notes": "静态边界，无生产验收证据"
}
```

逐应用替换为下表值；`partial` 的证据均为 `{ "type": "test", "ref": "<表中测试路径>", "date": "2026-11-06" }`，`declared` 的 `evidence` 均为 `[]`。

| name | level/status | owner | dataSource | businessId | apis | cacheTtl | notes/证据 |
|---|---|---|---|---|---|---|---|
| drawing-review | B/partial | NEC 机械组 | 飞书 Base 图纸评审主表及子表 + approvals | `DR-<YYYY>-<4位序号>` | `/api/drawing-review/*`, `/api/approvals/*`, `/api/todos` | 待办 5 分钟 | 生产闭环待验收；`src/__tests__/drawing-review-e2e.test.ts` |
| hardware-review | B/partial | NEC 电控组 | 飞书 Base 硬件评审主表及子表 + approvals | `HR-<YYYY>-<4位序号>` | `/api/hardware-review/*`, `/api/approvals/*`, `/api/todos` | 待办 5 分钟 | 真实硬件流程待验收；`src/__tests__/hardware-review.test.ts` |
| contract-signing | B/partial | NEC 运营组 | 飞书 Base 合同主表/评论/事件 + approvals | `HT-<YYYY>-<3位序号>` | `/api/contract-approval/*`, `/api/approvals/*`, `/api/todos` | 待办 5 分钟 | 生产会签待验收；`src/contract-approval/__tests__/contract-approval.test.ts` |
| reimburse | B/partial | NEC 平台维护者 | 飞书 Base 报销审批状态 + D1 整单快照 + R2 receipts | `BX-<YYYY>-<4位序号>` | `/api/erp/reimburse/*`, `/api/approvals/*`, `/api/todos` | D1 实时；待办 5 分钟；看板 30 分钟 | 生产报销闭环待验收；`src/__tests__/erp-reimburse.test.ts` |
| compliance | B/declared | NEC 运营组 | 飞书 Base 合规审批表 + approvals | `CP-<YYYY>-<4位序号>` | `/api/approvals/*`, `/api/todos` | 待办 5 分钟 | 暂无独立业务闭环证据 |
| season-goals | B/partial | NEC 队长与各组长 | 飞书 Base goals/collect/tasks | `goals.record_id` | `/api/season-goals/*`, `/api/dashboard`, `/api/my-tasks` | 看板最长 30 分钟；指定写操作主动失效 | 目标任务稳定关联待补；`src/season-goals/__tests__/season-goals.test.ts` |
| task-schedule | B/declared | NEC 平台维护者 | 浏览器 localStorage `nec-taskto-v1` | 本地 `uid()`（仅浏览器内稳定） | 空数组 | 仅本地持久化 | 未接任务服务，跨应用关联未实现 |
| domains | I/partial | NEC 平台维护者 | KV `domains:rec:<subdomain>` + Cloudflare DNS | `<subdomain>.newenergycoder.club` | `/api/domains/*` | 域名记录按现有短缓存 | 生产申请一单待验收；`src/__tests__/domains.test.ts` |
| cla-sign | I/declared | NEC 开源社区 | KV `cla:sig:*` / `cla:oid:*` | 飞书 `open_id`；匿名历史路径为 GitHub 用户名 | `/api/cla`, `/api/cla/status`, `/api/cla/sign` | 签署状态实时读取 | 匿名签署与 I 级目标冲突 |
| scoring | P/declared | NEC 平台维护者 | `web/src/apps/scoring/data.ts` | 省略 | 空数组 | 静态构建产物 | 静态评分资料，无实时写入 |
| mech-review-6014 | P/declared | NEC 机械组 | `public/apps/mech-review-6014/` 静态纪要/DXF/CSV | 省略 | 空数组 | 静态构建产物 | 6014 静态归档 |
| ress-solution | P/declared | NEC 平台维护者 | `web/src/apps/ress-solution/data.ts` + `public/assets/starcharge-ress/` | 省略 | 空数组 | 静态构建产物 | 本地预览与客户端导出，不接 LibTV 实时服务 |
| k1 | P/declared | NEC Hardware | `web/apps/k1/` 静态页与 2026-11-03 验收截图 | 省略 | 空数组 | 静态构建产物 | 不连接打印机、不创建内网 WebSocket、不提供远程控制 |
| drawing | B/declared + deprecated | NEC 机械组 | 旧 approvals 轻审批底表 | `MECH-<YYYY>-<4位序号>` | `/api/approvals/*` | 待办 5 分钟 | `deprecated: true`；新增能力进入 drawing-review |

- [x] **Step 4: 接入 Vite 与 hosting**

`web/vite.config.ts` 顶部增加：

```ts
import { validateAppIntegration, type AppIntegration } from '../src/shared/app-integration'
```

`builtinManifestEntries` 在 `ordered.map` 中读取：

```ts
const integrationPath = path.join(appsDir, name, 'integration.json')
const integration = validateAppIntegration(JSON.parse(fs.readFileSync(integrationPath, 'utf8')), name) as AppIntegration
return { name, title: meta?.title ?? title, desc: meta?.desc ?? '', icon: meta?.icon ?? '🧩', group: meta?.group ?? 'standalone', integration }
```

`src/hosting.ts` 为 `AppEntry`、`BuiltinManifestEntry` 增加 `integration?: AppIntegration | null`，导入类型；`readBuiltinManifest` 对旧 manifest 缺声明返回 `null`，有声明时调用 `validateAppIntegration`。`listPortalApps` 对 builtin 和 registry 都显式输出 `integration: x.integration ?? null`。

- [x] **Step 5: 跑测试与构建检查点**

Run: `npx vitest run src/__tests__/builtin-integration.test.ts src/__tests__/portal-apps.test.ts && npm run check && npm run build:web && git diff --check`
Expected: 测试通过、类型通过、14 个应用构建成功。

### Task 3: deploy_app 与 register_app 声明门槛

**Files:**
- Modify: `src/mcp/tools/apps.ts`
- Modify: `src/__tests__/mcp-admin-guard.test.ts`
- Create: `src/__tests__/app-publishing.test.ts`

- [x] **Step 1: 写无副作用失败测试**

```ts
it("deploy_app 缺 integration 时不上传、不写 KV", async () => {
  const env = createMockEnv();
  await expect(toolDeployApp({ name: "demo-app", files: [{ path: "index.html", text: "ok" }] }, env as unknown as Env, new Request("https://hub.local/mcp")))
    .rejects.toThrow(/integration/);
  expect(env.APPS_BUCKET.put).not.toHaveBeenCalled();
  expect(env.REGISTRY.put).not.toHaveBeenCalled();
});

it("register_app 非法声明时不写 KV", async () => {
  const env = createMockEnv();
  await expect(toolRegisterApp({ name: "demo-app", url: "https://demo.example.com", integration: validIntegration({ status: "verified" }) }, env as unknown as Env))
    .rejects.toThrow(/production/);
  expect(env.REGISTRY.put).not.toHaveBeenCalled();
});
```

成功路径使用 `integration: validIntegration()`，断言返回 entry 的声明被保存。

- [x] **Step 2: 运行测试确认红灯**

Run: `npx vitest run src/__tests__/app-publishing.test.ts src/__tests__/mcp-admin-guard.test.ts`
Expected: 新测试 FAIL；旧上传限额测试因缺声明也需用 `validIntegration()` 补齐参数。

- [x] **Step 3: 实现上架校验**

在两个工具入口、任何 R2/KV/Cache 副作用前调用：

```ts
const integration = validateAppIntegration(args.integration, appName);
```

写入 entry：`integration`。两个工具的 `inputSchema.properties` 增加 `integration: APP_INTEGRATION_INPUT_SCHEMA`，`required` 数组增加 `"integration"`，导入 `validateAppIntegration` 与 `APP_INTEGRATION_INPUT_SCHEMA`。

- [x] **Step 4: 运行测试检查点**

Run: `npx vitest run src/__tests__/app-publishing.test.ts src/__tests__/mcp-admin-guard.test.ts src/__tests__/mcp-registry.test.ts && git diff --check`
Expected: PASS，旧 schema 名称和顺序不变。

### Task 4: sync_vercel 批量声明与整批原子校验

**Files:**
- Modify: `src/mcp/tools/apps.ts`
- Create: `src/__tests__/app-sync-vercel.test.ts`

- [x] **Step 1: 写 dry-run 和 confirm 失败测试**

mock Vercel 返回一个待登记项目 `demo-app`，并 spy KV：

```ts
it("dry-run 报告缺失声明但不写入", async () => {
  const result = await toolSyncVercel({ confirm: false }, env, true);
  expect(result.content[0].text).toMatch(/demo-app.*integration/);
  expect(env.REGISTRY.put).not.toHaveBeenCalled();
});

it("confirm 任一声明非法时整批无写入", async () => {
  await expect(toolSyncVercel({ confirm: true, integrations: {} }, env, true)).rejects.toThrow(/demo-app.*integration/);
  expect(env.REGISTRY.put).not.toHaveBeenCalled();
});
```

再测 `integrations: { "demo-app": validIntegration() }` 成功写入一项。

- [x] **Step 2: 运行测试确认红灯**

Run: `npx vitest run src/__tests__/app-sync-vercel.test.ts`
Expected: FAIL，当前 dry-run 不检查声明，confirm 会直接写入。

- [x] **Step 3: 实现批量预检**

```ts
const declarations = (args.integrations ?? {}) as Record<string, unknown>;
if (!declarations || typeof declarations !== "object" || Array.isArray(declarations)) throw new Error("integrations 必须是按应用名 keyed 的对象");
const pending = plan.filter((p) => p.action === "registered" || p.action === "would register");
const validated = new Map<string, AppIntegration>();
for (const p of pending) {
  try {
    validated.set(p.name, validateAppIntegration(declarations[p.name], p.name));
    if (!confirm) p.action = `would register（integration 已声明）`;
  } catch (err) {
    if (confirm) throw err;
    p.action = `blocked: ${err instanceof Error ? err.message : String(err)}`;
  }
}
if (confirm) {
  for (const p of pending) {
    await upsertIndex(env, KV_KEYS.appsIndex, {
      name: p.name, title: p.name, author: "Vercel 同步", visibility: "all", version: "1.0.0",
      updatedAt: new Date().toISOString(), url: p.url, external: true, integration: validated.get(p.name)!,
    });
  }
}
```

`newCount` 只统计非 `blocked` 项；MCP schema 增加 `integrations: { type: "object", additionalProperties: APP_INTEGRATION_INPUT_SCHEMA }`。

- [x] **Step 4: 运行测试检查点**

Run: `npx vitest run src/__tests__/app-sync-vercel.test.ts src/__tests__/app-publishing.test.ts && git diff --check`
Expected: PASS，失败路径零 KV 写入。

### Task 5: MCP 身份与管理标记解耦

**Files:**
- Modify: `src/mcp/handler.ts`
- Modify: `src/__tests__/mcp-registry.test.ts`
- Modify: `src/__tests__/mcp-whoami.test.ts`

- [x] **Step 1: 修改权限矩阵测试**

覆盖以下真实 `handleMcp` 调用：

```ts
it.each([{}, { MCP_TOKEN: "secret" }])("匿名 whoami 不再误报管理员", async (env) => {
  const res = await handleMcp(mcpReq({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "whoami", arguments: {} } }), env as Env);
  const body = await res.json() as { result: { isError: boolean; content: { text: string }[] } };
  expect(body.result.isError).toBe(true);
  expect(body.result.content[0].text).not.toContain("MCP_TOKEN 持有者");
});

it("协议元数据公开，无效 Bearer 所有方法均 401", async () => {
  const list = await handleMcp(mcpReq({ jsonrpc: "2.0", id: 1, method: "tools/list" }), { MCP_TOKEN: "secret" } as Env);
  expect(list.status).toBe(200);
  const bad = await handleMcp(mcpReq({ jsonrpc: "2.0", id: 2, method: "tools/list" }, "wrong"), { MCP_TOKEN: "secret" } as Env);
  expect(bad.status).toBe(401);
});

it("无管理 Bearer 时写工具 fail-closed", async () => {
  const res = await handleMcp(mcpReq({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "remove_docs", arguments: { ids: ["a"] } } }), { MCP_TOKEN: "secret" } as Env);
  const body = await res.json() as { error: { code: number } };
  expect(body.error.code).toBe(-32000);
});
```

保留有效管理 Bearer 的全工具路径；匿名 `whoami` 原“Token 持有者”断言改为身份缺失。

- [x] **Step 2: 运行测试确认红灯**

Run: `npx vitest run src/__tests__/mcp-registry.test.ts src/__tests__/mcp-whoami.test.ts`
Expected: FAIL，匿名 whoami 当前误报管理员，无 Bearer 的协议元数据和写工具行为不符合矩阵。

- [x] **Step 3: 重构 handleMcp 与 callTool**

核心实现：

```ts
export async function handleMcp(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const hasMcpToken = Boolean(env.MCP_TOKEN) && await timingSafeEqual(supplied, env.MCP_TOKEN!);
  if (authorization && !hasMcpToken) return json({ error: "unauthorized" }, 401);

  let msg: { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
  try { msg = await request.json() as typeof msg; }
  catch { return rpcError(null, -32700, "Parse error"); }
  const id = msg.id ?? null;
  switch (msg.method) {
    case "initialize": return rpc(id, { protocolVersion: (msg.params?.protocolVersion as string) ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "NEC-MCP", version: "0.4.0" }, instructions: SERVER_INSTRUCTIONS });
    case "ping": return rpc(id, {});
    case "notifications/initialized": return new Response(null, { status: 202 });
    case "tools/list": return rpc(id, { tools: TOOLS });
    case "tools/call": return callTool(id, msg.params ?? {}, env, request, hasMcpToken);
    default: return rpcError(id, -32601, `Method not found: ${String(msg.method)}`);
  }
}
```

`callTool` 先 `findTool`，未知工具返回 `-32602`；然后使用：

```ts
if (!hasMcpToken && !READONLY_TOOLS.has(name)) {
  return rpcError(id, -32000, `工具 ${name} 为写操作：需要有效 MCP_TOKEN；只读工具仍按各自用户权限执行`);
}
```

`hasMcpToken` 不再在未配置环境 Token 时设为 `true`。

- [x] **Step 4: 运行测试检查点**

Run: `npx vitest run src/__tests__/mcp-registry.test.ts src/__tests__/mcp-whoami.test.ts src/__tests__/mcp-admin-guard.test.ts && git diff --check`
Expected: PASS。

### Task 6: query_bitable 用户身份与财务权限

**Files:**
- Modify: `src/mcp/tools/bitable-query.ts`
- Create: `src/__tests__/mcp-bitable-authz.test.ts`

- [x] **Step 1: 写用户权限失败测试**

使用 mock `validateUserToken` 的 fetch 响应和内存名单：

```ts
it("匿名查询普通业务表也要求 user_token", async () => {
  await expect(toolQueryBitable({ table: "tasks" }, env, false)).rejects.toThrow(/user_token/);
});
it("matched=false 不按普通队员放行", async () => {
  await expect(toolQueryBitable({ table: "tasks", user_token: "u-external" }, env, false)).rejects.toThrow(/权限不足/);
});
it("普通队员查 finance 拒绝，队长可查", async () => {
  await expect(toolQueryBitable({ table: "finance", user_token: "u-member" }, env, false)).rejects.toThrow(/队长\/财务/);
  const result = await toolQueryBitable({ table: "finance", user_token: "u-captain" }, env, false);
  expect(result.content[0].text).toContain("报销金额");
});
it("管理 Bearer 保持放行", async () => {
  const result = await toolQueryBitable({ table: "finance" }, env, true);
  expect(result.content[0].text).toContain("报销金额");
});
```

- [x] **Step 2: 运行测试确认红灯**

Run: `npx vitest run src/__tests__/mcp-bitable-authz.test.ts`
Expected: FAIL，普通表匿名可查，finance 在旧降级路径可绕过。

- [x] **Step 3: 实现统一用户校验**

```ts
if (!hasMcpToken) {
  const userToken = String(args.user_token ?? "").trim();
  if (!userToken) throw new Error("query_bitable 需要 user_token，或由管理端携带 MCP_TOKEN 调用");
  const { openId, name } = await validateUserToken(userToken);
  const role = await resolveUserRole(env, { name, open_id: openId });
  if (!role.matched || role.role === "external") throw new Error("权限不足：队员名单无法确认当前用户身份");
  if (table === "finance" && !canSeeFinanceDetail(role)) {
    throw new Error(`权限不足：finance 表仅队长/财务角色可查（当前角色：${role.role}）`);
  }
}
```

更新工具描述和 `user_token` 描述：非管理查询均需用户身份，finance 还需队长/财务。

- [x] **Step 4: 跑 MCP 全量回归**

Run: `npx vitest run src/__tests__/mcp-*.test.ts && git diff --check`
Expected: 所有 MCP 测试通过。

### Task 7: 应用广场徽章与 K1 静态边界

**Files:**
- Create: `web/src/shared/app-integration.ts`
- Create: `web/src/shared/ui/IntegrationBadge.vue`
- Modify: `web/src/portal/components/tabs/AppsTab.vue`
- Modify: `web/apps/k1/index.html`
- Modify: `src/__tests__/app-integration.test.ts`

- [x] **Step 1: 补徽章映射失败测试**

断言 `declared/partial/verified/null/deprecated` 的 `levelLabel/statusLabel/tone`，尤其：

```ts
expect(integrationBadgeModel(validIntegration({ status: "declared", evidence: [] }))).toMatchObject({ statusLabel: "待验收", tone: "warn" });
expect(integrationBadgeModel(validIntegration())).toMatchObject({ statusLabel: "部分验证", tone: "info" });
```

- [x] **Step 2: 运行测试确认映射覆盖**

Run: `npx vitest run src/__tests__/app-integration.test.ts`
Expected: 新增断言若模型缺状态则 FAIL；通过后锁定展示语义。

- [x] **Step 3: 实现组件和页面**

`web/src/shared/app-integration.ts`：

```ts
export { integrationBadgeModel } from "../../../src/shared/app-integration";
export type { AppIntegration } from "../../../src/shared/app-integration";
```

`IntegrationBadge.vue` 使用静态 class 映射，避免 Tailwind 动态类遗漏：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { integrationBadgeModel, type AppIntegration } from '@shared/app-integration'
const props = defineProps<{ integration?: AppIntegration | null }>()
const model = computed(() => integrationBadgeModel(props.integration))
const classes = {
  muted: 'bg-gray-100 text-gray-500 border-gray-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
}
</script>
<template>
  <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium" :class="classes[model.tone]">
    <template v-if="model.levelLabel">{{ model.levelLabel }} · </template>{{ model.statusLabel }}
  </span>
</template>
```

在 `AppsTab.vue` 三组卡片各放一个 `<IntegrationBadge :integration="a.integration" />`，不移除现有描述、作者、版本和 shadows 提示。K1 的 `boundary-label` 改为 `P 级 · 公网静态预览`。

- [x] **Step 4: 构建检查点**

Run: `npm run check && npm run build:web && npx vitest run src/__tests__/app-integration.test.ts src/__tests__/builtin-integration.test.ts && git diff --check`
Expected: Vue 编译通过，徽章语义测试通过。

### Task 8: 发布 Prompt、使用手册、README 与 PRD 同步

**Files:**
- Modify: `web/src/shared/prompts.ts`
- Modify: `src/mcp/instructions.ts`
- Modify: `README.md`
- Modify: `docs/APP互联互通使用手册.md`
- Modify: `web/apps/README.md`
- Modify: `docs/团队AI中台PRD_V2.1.md`
- Modify: `docs/superpowers/specs/2026-11-06-fe20-integration-baseline-design.md`

- [x] **Step 1: 更新 Agent 发布契约**

`PUBLISH_PROMPT` 明确要求：

```text
先确认真实集成等级、负责人、权威数据源、稳定业务 ID、依赖 API、缓存时效和验收证据；
deploy_app/register_app 必须传 integration；
declared/partial/verified 不得混用，生产已验收必须有 production 证据；
没有真实业务闭环时保持 declared 或 partial，不得宣称已打通。
```

`src/mcp/instructions.ts` 和工具描述同步必填契约。

- [x] **Step 2: 更新使用手册和 README**

`deploy_app`、`register_app` 示例增加完整 `integration`，并保留现有静态托管、SSO 和安全边界说明。`web/apps/README.md` 在新增应用步骤中加入 `integration.json` 和构建失败语义。

根 README 只增量修改现有 FE-20 段落，说明：

- 历史未声明应用仍可访问但不算已打通。
- 新增/更新上架必须声明。
- MCP 元数据可公开，业务读工具仍需用户或管理身份，写工具需管理 Token。

- [x] **Step 3: 更新 PRD 进展和设计规格**

PRD §15 追加实际进展：14 个内置声明、上架门槛、徽章和 MCP 权限矩阵已完成代码与自动化验证；FE-20 整体仍为待逐应用生产验收，不改写成全部完成。

设计规格补充 `ress-solution` 和 B/declared 空 API 规则，保持与实现一致。

- [x] **Step 4: 文档检查点**

Run: `git diff --check && node scripts/validate-docs.js`
Expected: 无空白错误；文档质检通过。如果脚本只覆盖联想功能文档，记录其实际覆盖范围，不把它当成 FE-20 验收。

### Task 9: 全量回归与本地 Worker 端到端验证

**Files:**
- Verify only; generated `public/` 构建产物不手工编辑。

- [x] **Step 1: 后端全量验证**

Run: `npm run check && npm run test:ci`
Expected: TypeScript 无错误，全部 Vitest 文件和用例通过。

- [x] **Step 2: 前端构建验证**

Run: `npm run build:web`
Expected: Vite 构建成功；`public/apps/builtin.json` 含 14 个应用及合法 `integration`，没有 `verified` 自动升级。

- [x] **Step 3: 启动本地 Worker 并验证真实 HTTP**

后台运行：`npm run dev`，等待 8787 端口后执行：

```bash
curl -fsS http://localhost:8787/api/health
curl -fsS http://localhost:8787/api/apps
curl -fsS -X POST http://localhost:8787/mcp \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"whoami","arguments":{}}}'
```

Expected:

- health `ok: true`。
- `/api/apps` 含 `ress-solution`、`k1`、`drawing-review` 及各自 `integration`；K1 为 P，任务排期数据源含 localStorage。
- 匿名 `whoami` 返回 `isError: true`，不再出现“MCP_TOKEN 持有者”。

- [x] **Step 4: 清理与最终审计**

停止本次启动的 Wrangler 后台任务，执行 `git status --short` 和 `git diff --stat`。只报告本次源码、测试、声明、文档和构建产物变化；不删除或回滚用户并行创建的 `output/`、截图、RESS 资产及其他文件。

- [x] **Step 5: 交付结论**

报告已完成的第一阶段能力、实际测试数量、HTTP 验证结果、未完成的 FE-20 生产/逐应用闭环事项，以及新上架工具的必填参数破坏性变化。不得把 partial 描述为生产已验收。
