# PRD 看板补齐与后续更新清单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 补齐 `#/prd` 的 M5 平台与应用看板、三组后续更新清单和 5 份专项 PRD，并通过测试与构建验证。

**Architecture:** 后端 `src/prd.ts` 继续作为动态状态单一来源，新增 FE-19/FE-20 默认基线与 M5 里程碑；前端新增纯数据模块承载文档注册表和路线图，`PrdTab.vue` 只负责渲染；Node/Vitest 校验注册表指向的静态文件真实存在。

**Tech Stack:** TypeScript、Cloudflare Workers KV、Vue 3、Vite、Vitest、静态 Markdown 托管。

---

## 文件结构

- `public/docs/prd/*.md`：新增 5 份专项 PRD 的静态副本，并刷新主 PRD。
- `web/src/portal/data/prd-docs.json`：文档库唯一注册表，供前端与测试读取。
- `web/src/portal/data/prd-roadmap.ts`：三组后续更新清单的纯数据。
- `web/src/portal/components/tabs/PrdTab.vue`：渲染动态看板、后续清单和文档库。
- `src/prd.ts`：M5、FE-19、FE-20 与子项的默认基线。
- `src/__tests__/prd.test.ts`：看板数量、里程碑、KV 合并测试。
- `src/__tests__/prd-docs.test.ts`：文档注册表与静态文件一致性测试。
- `README.md`：里程碑与动态看板描述更新为 M1～M5。

## Task 1: 补齐静态文档与 README

**Files:**
- Create: `public/docs/prd/approval-card-v1.0.md`
- Create: `public/docs/prd/app-structure-v1.0.md`
- Create: `public/docs/prd/todo-center-v1.0.md`
- Create: `public/docs/prd/reimburse-flagship-v1.0.md`
- Create: `public/docs/prd/tenant-migration-v1.0.md`
- Modify: `public/docs/prd/team-ai-platform-v2.1.md`
- Modify: `README.md`

- [x] **Step 1: 复制专项 PRD 原文到静态目录**

```bash
cp docs/PRD_审批通知卡片化_V1.0.md public/docs/prd/approval-card-v1.0.md
cp docs/PRD_应用中台结构优化_V1.0.md public/docs/prd/app-structure-v1.0.md
cp docs/PRD_待办聚合中心_V1.0.md public/docs/prd/todo-center-v1.0.md
cp docs/PRD_报销助手标杆应用_V1.0.md public/docs/prd/reimburse-flagship-v1.0.md
cp docs/PRD_租户迁移_常州工NEC并入天合同创_V1.0.md public/docs/prd/tenant-migration-v1.0.md
cp docs/团队AI中台PRD_V2.1.md public/docs/prd/team-ai-platform-v2.1.md
```

- [x] **Step 2: 更新 README 的三处过期描述**

将 PRD 看板描述中的 `M1/M2/M3 三列` 改为 `M1~M5 五列`；将 `PRD V2.0 盘点基线` 改为 `PRD V2.1 盘点基线 + FE-19/FE-20`；将“待办（第二/三阶段）”说明中的 `M1 地基 → M2 资产与智能 → M3 个性化与自动化` 补为 `M1 地基 → M2 资产与智能 → M3 个性化与自动化 → M4 业务流程域 → M5 平台与应用`。

- [x] **Step 3: 验证文件可读且非空**

Run: `wc -c public/docs/prd/{approval-card-v1.0,app-structure-v1.0,todo-center-v1.0,reimburse-flagship-v1.0,tenant-migration-v1.0,team-ai-platform-v2.1}.md`
Expected: 每个文件均大于 1000 字节。

## Task 2: 用测试驱动补充 M5 看板基线与 KV 合并

**Files:**
- Modify: `src/__tests__/prd.test.ts:55-100`
- Modify: `src/prd.ts:25-62`

- [x] **Step 1: 先改测试，表达新基线**

将“16 项”改为“18 项”，里程碑断言改为 `["M1","M2","M3","M4","M5"]`，新增：

```ts
const fe20 = board.milestones[4].cards.find((c) => c.id === "FE-20");
expect(board.milestones[4].cards.map((c) => c.id)).toEqual(["FE-19", "FE-20"]);
expect(fe20?.subs?.["k1"]?.status).toBe("partial");
expect(fe20?.subs?.["ress"]?.status).toBe("partial");
```

KV 覆盖用例中增加 FE-19 覆盖，并断言默认 FE-20 与子项仍保留：

```ts
ctx.kv.set(KV_KEYS.prdStatus, JSON.stringify({
  items: {
    "FE-04": { title: "赛季目标可视化面板", priority: "P1", status: "done", note: "面板上线" },
    "FE-19": { title: "域名分发系统", priority: "P1", status: "done", note: "线上已验收" },
  },
  updatedAt: "2026-10-14T00:00:00.000Z",
}));
expect(board.progress.done).toBe(10);
expect(board.milestones[4].cards.find((c) => c.id === "FE-19")?.status).toBe("done");
expect(board.milestones[4].cards.find((c) => c.id === "FE-20")?.subs?.["k1"]?.status).toBe("partial");
```

KV 损坏用例的总数期望改为 18。

- [x] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/__tests__/prd.test.ts`
Expected: FAIL，基线总数仍为 16 且无 M5。

- [x] **Step 3: 实现 FE-19/FE-20 与 M5**

在 `DEFAULT_PRD_ITEMS` 末尾加入：

```ts
"FE-19": { title: "域名分发系统", priority: "P1", status: "partial", note: "自助三级/四级域名 + 泛域名应用直达已上线；待登录态申请/释放一单端到端实测" },
"FE-20": {
  title: "APP 互联互通", priority: "P0", status: "partial",
  note: "P/I/B/D 声明、发布门槛、应用状态展示与 MCP 权限基线已交付；核心应用真实生产闭环待逐项验收",
  subs: {
    "k1": { title: "K1 Dashboard（静态预览）", priority: "P1", status: "partial", note: "P 级静态预览与局域网导航已上架；实时数据需鉴权只读中继，控制需独立授权与审计" },
    "ress": { title: "StarCharge RESS 方案展示", priority: "P2", status: "partial", note: "场景展示、25D 预览与 BOM 导出已交付；持久化/报价/提交等业务闭环未实现" },
  },
},
```

增加里程碑：

```ts
{ id: "M5", title: "平台与应用", items: ["FE-19", "FE-20"] },
```

- [x] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/__tests__/prd.test.ts`
Expected: PASS，包含 M5 与 KV 合并用例。

## Task 3: 建立文档注册表、后续清单数据与链接校验

**Files:**
- Create: `web/src/portal/data/prd-docs.json`
- Create: `web/src/portal/data/prd-roadmap.ts`
- Create: `src/__tests__/prd-docs.test.ts`

- [x] **Step 1: 先写会失败的链接校验测试**

```ts
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../public/docs/prd");
const docs = JSON.parse(readFileSync(resolve(__dirname, "../../web/src/portal/data/prd-docs.json"), "utf8")) as Array<{ slug: string; title: string; version: string; date: string; desc: string; html?: boolean }>;

describe("PRD 文档注册表", () => {
  it("每份注册文档都有对应的静态文件", () => {
    for (const doc of docs) {
      expect(existsSync(resolve(root, `${doc.slug}.${doc.html ? "html" : "md"}`)), doc.slug).toBe(true);
    }
  });
  it("注册项字段完整且 slug 唯一", () => {
    expect(new Set(docs.map((d) => d.slug)).size).toBe(docs.length);
    for (const doc of docs) {
      expect(doc.title.trim()).not.toBe("");
      expect(doc.version.trim()).not.toBe("");
      expect(doc.desc.trim()).not.toBe("");
      expect(doc.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/__tests__/prd-docs.test.ts`
Expected: FAIL，`prd-docs.json` 不存在。

- [x] **Step 3: 创建完整注册表**

`prd-docs.json` 依次登记现有 7 份和新增 5 份，新增项字段为：

```json
[
  { "slug": "approval-card-v1.0", "title": "审批通知卡片化 PRD", "version": "V1.0", "date": "2026-11-02", "desc": "审批提交与结果通知卡片化、@ 申请人、失败回退文本；P1-1～P1-3 已实现，逐流程灰度待验证" },
  { "slug": "app-structure-v1.0", "title": "应用中台结构优化 PRD", "version": "V1.0", "date": "2026-10-15", "desc": "门户模块化、hash 深链、CI 测试门禁与 KV 治理；历史专项，当前门户已演进为 Vue 3 + Vite" },
  { "slug": "todo-center-v1.0", "title": "待办聚合中心 PRD", "version": "V1.0", "date": "2026-10-15", "desc": "逾期任务、财务报销、飞书审批与本地审批四类聚合；T-1 标红与角色视角仍待真实账号复核" },
  { "slug": "reimburse-flagship-v1.0", "title": "报销助手标杆应用 PRD", "version": "V1.0", "date": "2026-10-15", "desc": "发票 OCR、SOP 自检、审批引擎、D1 台账与 R2 凭证；待带附件真实单据端到端验收" },
  { "slug": "tenant-migration-v1.0", "title": "租户迁移 PRD（天合同创）", "version": "V1.0", "date": "2026-10-23", "desc": "从常州工 NEC 飞书企业迁入天合同创的 19 张底表、应用凭证与用户态重建方案；草稿，待评审排期" }
]
```

原有 7 项保留原 slug、标题和描述，`416mes-architecture` 保留 `"html": true`。

- [x] **Step 4: 创建路线图数据**

```ts
export interface PrdNextItem {
  title: string
  detail: string
  evidence: string
}

export interface PrdNextGroup {
  key: 'P0' | 'P1' | 'P2'
  title: string
  summary: string
  items: PrdNextItem[]
}

export const PRD_ROADMAP: PrdNextGroup[] = [
  {
    key: 'P0', title: '真实业务验收', summary: '代码上线不等于业务闭环，以下需真实账号与单据证据。',
    items: [
      { title: '报销闭环', detail: 'FE-08 / FE-20：带附件提交、审批/支付、我的报销、台账与财务汇总核对同一单据。', evidence: '完成证据：单号、角色、日期、审批记录与台账截图' },
      { title: '评审闭环', detail: 'FE-14～16 / FE-20：图纸、硬件、合同各走一单提交、审批/会签、整改/纪要、结果回写；图纸补会议/ERP/MES 联调。', evidence: '完成证据：同一业务流程单号贯穿发起、待办与结果端' },
      { title: '身份与待办', detail: 'FE-01 / FE-09 / FE-17 / FE-18：真实队员账号复核任务绑定、角色可见范围、48h 视角、T-1 标红与目标回写。', evidence: '完成证据：队长与队员双账号对照记录' },
      { title: '工作台与权限', detail: 'FE-02 / FE-11：补齐剩余 5 名成员组别，由飞书超管启用定制工作台并开通审批所需 scope。', evidence: '完成证据：超管后台截图与全员入口实测' },
    ],
  },
  {
    key: 'P1', title: '功能完善', summary: '已有能力继续收口，按应用逐项补验收与安全边界。',
    items: [
      { title: 'FE-20 逐应用验收', detail: '补共享登录、深链、权限、同源数据与业务 ID 证据；单测和截图不能升级为生产已验收。', evidence: '完成证据：应用集成等级与 production 证据' },
      { title: 'FE-19 域名服务收尾', detail: '完成真实申请/释放；评估 KV 索引并发、到期回收与 DNS 对账。', evidence: '完成证据：DNS 记录增删与 dig 结果' },
      { title: '审批通知卡片灰度', detail: '按流程开启卡片、@ 人与失败回退；卡片内直接审批另立应用机器人方案。', evidence: '完成证据：灰度流程与回退日志' },
      { title: 'K1 安全只读接入', detail: '先做统一身份与鉴权中继，展示在线/离线/数据时间；不映射设备端口，不默认开放控制。', evidence: '完成证据：中继接口、过期状态与控制审计' },
      { title: '任务排期与 CLA 整改', detail: '评审 localStorage 迁移与 CLA 外部贡献者身份方案，分别作为独立变更实施。', evidence: '完成证据：数据迁移或身份方案评审记录' },
      { title: 'RESS 后续迭代', detail: '确认真实业务需求后再增加持久化、报价或审批闭环，并同步数据源与验收证据。', evidence: '完成证据：需求确认与后端数据源清单' },
    ],
  },
  {
    key: 'P2', title: '文档与运行治理', summary: '让页面、事实源与验收证据持续可追溯。',
    items: [
      { title: '专项 PRD 保鲜', detail: '新专项 PRD 同步静态目录并登记版本、日期与真实状态，链接检查随测试执行。', evidence: '完成证据：注册表与文件一致性测试通过' },
      { title: '维护白皮书试行', detail: '按 NEC 网站维护白皮书逐步补 Owner、复核日期、链接检查与发布/回滚记录。', evidence: '完成证据：抽查条目的 Owner 与复核日期' },
      { title: 'staging 与环境隔离', detail: '评审独立 KV/R2/D1 与测试域名，避免真实验收和公共预览共用生产数据。', evidence: '完成证据：隔离资源与测试域名可访问' },
      { title: '状态维护收口', detail: '需求状态继续由 update_prd 维护；路线图随代码版本发布，不自动推断验收状态。', evidence: '完成证据：版本历史与状态变更通知' },
    ],
  },
]
```

- [x] **Step 5: 运行文档测试**

Run: `npx vitest run src/__tests__/prd-docs.test.ts`
Expected: PASS。

## Task 4: 渲染后续清单并改进子项可达性

**Files:**
- Modify: `web/src/portal/components/tabs/PrdTab.vue:1-173`

- [x] **Step 1: 改用共享数据**

删除组件内 `PRD_DOCS`，改为：

```ts
import prdDocs from '@portal/data/prd-docs.json'
import { PRD_ROADMAP } from '@portal/data/prd-roadmap'
const PRD_DOCS = prdDocs
```

v-for 增加 `:key="g.key"` 的路线图分组，放在看板说明之后：

```html
<div id="prd-next-steps" class="mt-8">
  <div class="flex items-end justify-between mb-3">
    <h3 class="text-base font-bold">下一步更新</h3>
    <span class="text-xs text-gray-400">按优先级排列；状态以真实验收证据为准</span>
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <div v-for="g in PRD_ROADMAP" :key="g.key" class="bg-white rounded-xl shadow p-5">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-[10px] px-1.5 py-0.5 rounded text-white bg-nec-navy">{{ g.key }}</span>
        <h4 class="font-bold text-sm text-nec-navy">{{ g.title }}</h4>
      </div>
      <p class="text-xs text-gray-500 mb-3">{{ g.summary }}</p>
      <div class="space-y-3">
        <div v-for="item in g.items" :key="item.title" class="border-t border-gray-100 pt-3">
          <p class="text-xs font-bold text-nec-ink">{{ item.title }}</p>
          <p class="text-[11px] text-gray-500 mt-1">{{ item.detail }}</p>
          <p class="text-[10px] text-nec-cyan mt-1">{{ item.evidence }}</p>
        </div>
      </div>
    </div>
  </div>
</div>
```

- [x] **Step 2: 子项改为可展开，不再只支持悬停**

把 `<p>▸ ... 悬停查看</p>` 与 `group-hover` 浮层替换为：

```html
<details v-if="subList(c).length" class="mt-2">
  <summary class="text-[10px] cursor-pointer text-nec-cyan">▸ {{ subList(c).length }} 个子项</summary>
  <div class="mt-1 space-y-2">
    <div v-for="s in subList(c)" :key="s.id" class="rounded-lg p-2.5 border border-gray-100" :style="`background:${metaOf(s.status).bg}`">
      <div class="flex items-center justify-between gap-2">
        <span class="font-bold text-[11px] text-nec-navy">{{ s.id }}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded text-white" :style="`background:${metaOf(s.status).color}`">{{ metaOf(s.status).label }}</span>
      </div>
      <p class="text-[11px] mt-0.5 text-nec-ink">{{ s.title }}</p>
      <p class="text-[10px] text-gray-400 mt-0.5">{{ s.priority }}{{ s.note ? ' · ' + s.note : '' }}</p>
    </div>
  </div>
</details>
```

页脚说明由 `FE-01 ~ FE-18` 改为 `FE-01 ~ FE-20`，`子项悬停` 改为 `子项展开`。

- [x] **Step 3: 构建前端**

Run: `npm --prefix web run build`
Expected: Vite 构建成功，无 JSON 导入或模板编译错误。

## Task 5: 全量验证与人工核对

**Files:** 无新增文件。

- [x] **Step 1: 运行 PRD 相关测试**

Run: `npx vitest run src/__tests__/prd.test.ts src/__tests__/prd-docs.test.ts`
Expected: 全部 PASS。

- [x] **Step 2: 运行类型检查与全量测试**

Run: `npm run check && npm run test:ci`
Expected: `tsc` 无错误，Vitest 全量通过。

- [x] **Step 3: 浏览器核对**

启动或复用本地门户，打开 `http://localhost:8787/#/prd`，核对：

- M5 展示 FE-19/FE-20，FE-20 的两个子项可展开。
- “下一步更新”三列在桌面可读，窄屏单列堆叠。
- 5 份新增 PRD 可打开，主 PRD 可见 FE-19/FE-20。
- 文档 404 时显示原有失败提示，不出现伪造成功。

- [x] **Step 4: 核对未提交状态并汇报**

Run: `git status --short && git diff --check`
Expected: 仅包含本次页面、文档、测试改动；无空白错误。用户未要求提交时不执行 commit。

## 自检结论

- 设计中的 M5、FE-19、FE-20、K1/RESS、三组清单、5 份文档、README、KV 合并和移动端子项可达性均有对应任务。
- 不新增生产 KV 写入、不自动标记验收、不宣称 K1 或 RESS 完成业务闭环。
- 未包含占位词；新增类型与组件字段名保持一致（`slug/title/version/date/desc/html`、`key/title/summary/items`）。