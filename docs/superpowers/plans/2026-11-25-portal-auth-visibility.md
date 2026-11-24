# 门户登录可见性实施计划

> **For agentic workers:** Implement this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未登录访客只看到公开门户内容，内部页面不挂载、不请求业务数据，登录后按原权限恢复。

**Architecture:** `useTabs.ts` 统一公开、登录和管理门控；`App.vue` 只挂载当前可访问页面。首页根据登录状态过滤业务组件，横幅和待办沿用现有登录态，不增加后端权限范围。

**Tech Stack:** Vue 3、TypeScript、Vitest、Vite、Cloudflare Worker 本地预览。

**Design:** `docs/superpowers/specs/2026-11-25-portal-auth-visibility-design.md`

---

### Task 1: 权限模型与深链

**Files:**
- Modify: `web/src/portal/composables/useTabs.ts`
- Create: `src/__tests__/portal-auth-visibility.test.ts`

- [x] 写覆盖公开、登录、管理页面集合，以及 boot 和未登录状态不允许内部页面的失败测试。
- [x] 将内部页面集合设为 `my-tasks`、`reimburse`、`drawing-review`、`hardware-review`、`contract-approval`、`task-schedule`、`season-goals`、`dashboard`，由 `gateVisible()` 要求 `auth.phase === 'ready'` 且已登录。
- [x] 受限 hash 停留首页、规范化到 `#/home`、保留 `pendingHash.tab`；登录后由现有 `applyHashRoute()` 恢复。公开 hash 正常切换，未知 hash 回首页。
- [x] 登出时仅在内部页面回落首页，公开页面保持不动；`HeroHeader` 的健康入口只在内部页面对登录用户展示。

### Task 2: 仅挂载可访问页面

**Files:**
- Modify: `web/src/portal/App.vue`
- Modify: `src/__tests__/portal-refresh-ui.test.ts`

- [x] 断言受限页面使用 `v-if="tabs.active === '...'"` 和可访问门控，而不是常驻 `v-show`。
- [x] 保留公开页按需挂载；登录初始化完成前不渲染内部组件。
- [x] 受限深链显示一条可操作的登录提示，不复用 `MyTasksTab` 的登录占位卡。
- [x] 将 `GoalBanner` 和 `TodoBar` 限定为已登录；`loadTodos()` 在未登录时清除待办数据与展开状态。

### Task 3: 访客首页与入口

**Files:**
- Modify: `web/src/portal/components/tabs/HomeTab.vue`
- Modify: `web/src/portal/components/HeroHeader.vue`
- Modify: `src/__tests__/portal-refresh-ui.test.ts`

- [x] 增加首页内部组件集合 `my-tasks`、`my-reimburse`、`goals`、`inventory`；访客布局仅保留 `my-apps` 与 `docs`。
- [x] 访客不显示布局编辑、恢复默认、拖拽工具、个人视图来源或业务待办卡；保留公开团队动态。
- [x] Hero 首屏公开入口改为应用广场和资料页，移除指向内部任务的 CTA。
- [x] 验证访客首页不请求 `/api/dashboard`、`/api/my-tasks`、`/api/todos`、`/api/home` 或报销接口。

### Task 4: 回归与验收

**Files:**
- Test: `src/__tests__/portal-auth-visibility.test.ts`
- Test: `src/__tests__/portal-refresh-ui.test.ts`

- [x] 运行 `npm run test:ci && npm run check && npm run build:web`，要求全部通过。
- [x] 本地 Worker 验证桌面与 390px 未登录首页、导航、公开 Tab、受限深链和无内部业务请求。
- [x] 检查真实登录后恢复需要可用测试会话；无会话时明确记录未实测，不创建生产业务数据。
