# NEC Hub Portal Mobile and Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair mobile usability, establish a clearer home workspace, and deliver a numbered application catalogue and NEC dawn hero without changing backend contracts.

**Architecture:** Keep Vue components, API responses, localStorage keys, tab routing and home layout persistence intact. Add small pure view-model helpers and shared portal CSS, then refactor only the portal shell, home widgets, application catalogue and hero. Use Vitest source/pure-function contracts plus desktop/mobile browser checks.

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS 4, Vite 7, Vitest, Cloudflare Workers static assets.

**Constraint:** Do not commit, push or deploy. Do not change backend APIs or unrelated application interiors.

---

## File map

- Create `web/src/portal/utils/goalSummary.ts`: pure urgent-goal summary model.
- Create `web/src/portal/utils/appCatalog.ts`: catalogue numbers, local cover mapping and monograms.
- Create `web/src/portal/components/apps/AppVisual.vue`: image/fallback application thumbnail.
- Create `web/src/portal/components/apps/AppCatalogRow.vue`: shared row for all three app groups.
- Create `web/src/portal/portal-refresh.css`: portal-only surfaces, grid, catalogue, hero and responsive rules.
- Create `src/__tests__/portal-refresh-model.test.ts`: pure helper tests.
- Create `src/__tests__/portal-refresh-ui.test.ts`: component/source accessibility and compatibility contracts.
- Modify `src/__tests__/app-integration-ui.test.ts`: integration badge now lives in the shared row.
- Modify `web/src/portal/components/GoalBanner.vue`: collapsible summary and readable danger surface.
- Modify `web/src/portal/components/HeroHeader.vue`: responsive top bar and full/compact hero.
- Modify `web/src/portal/components/UserBox.vue`: mobile wrapping and readable metadata.
- Modify `web/src/portal/components/TabNav.vue`: bounded horizontal navigation and contrast.
- Modify `web/src/portal/App.vue`: wide shell only for home/apps/dashboard.
- Modify `web/src/portal/components/tabs/HomeTab.vue`: explicit two-region grid with original-index drag persistence.
- Modify `web/src/portal/components/tabs/home/HomeWidget{Tasks,Goals,Docs,Apps}.vue`: mobile rows, contrast and shared visuals.
- Modify `web/src/portal/components/tabs/AppsTab.vue`: three groups using `AppCatalogRow`.
- Modify `web/src/portal/main.ts`, `web/index.html`: load portal CSS and warm neutral body.
- Keep the original `public/apps/k1/dashboard-preview.jpg` and `public/apps/mech-review-6014/sketch.png`; visual inspection confirmed they already match their filenames.

### Task 1: Goal summary model

**Files:**
- Create: `web/src/portal/utils/goalSummary.ts`
- Test: `src/__tests__/portal-refresh-model.test.ts`

- [x] **Step 1: Write failing summary tests**

```ts
import { describe, expect, it } from "vitest";
import { goalBannerSummary } from "../../web/src/portal/utils/goalSummary";

const goal = (title: string, daysLeft: number, overdue = false) => ({ title, daysLeft, overdue });

describe("goalBannerSummary", () => {
  it("returns null without items", () => {
    expect(goalBannerSummary([])).toBeNull();
  });

  it("uses the nearest deadline when nothing is overdue", () => {
    expect(goalBannerSummary([goal("评审", 5), goal("报名", 2)])).toEqual({
      count: 2, overdueCount: 0, maxOverdueDays: 0, title: "报名", tone: "warning",
    });
  });

  it("uses the longest overdue item and keeps source order for ties", () => {
    expect(goalBannerSummary([
      goal("临近", 2), goal("招新", -6, true), goal("联调", -36, true), goal("同优先级", -36, true),
    ])).toEqual({
      count: 4, overdueCount: 3, maxOverdueDays: 36, title: "联调", tone: "danger",
    });
  });
});
```

- [x] **Step 2: Verify RED**

Run: `npx vitest run src/__tests__/portal-refresh-model.test.ts`

Expected: FAIL because `web/src/portal/utils/goalSummary.ts` does not exist.

- [x] **Step 3: Implement the pure model**

```ts
export interface GoalSummaryItem {
  title: string;
  daysLeft: number | null;
  overdue: boolean;
}

export interface GoalBannerSummary {
  count: number;
  overdueCount: number;
  maxOverdueDays: number;
  title: string;
  tone: "danger" | "warning";
}

export function goalBannerSummary(items: GoalSummaryItem[]): GoalBannerSummary | null {
  if (!items.length) return null;
  const overdue = items.filter((item) => item.overdue);
  const ordered = items.map((item, index) => ({ item, index })).sort((a, b) => {
    if (a.item.overdue !== b.item.overdue) return a.item.overdue ? -1 : 1;
    if (a.item.overdue && b.item.overdue) {
      const days = (a.item.daysLeft ?? 0) - (b.item.daysLeft ?? 0);
      return days || a.index - b.index;
    }
    const days = (a.item.daysLeft ?? Number.POSITIVE_INFINITY) - (b.item.daysLeft ?? Number.POSITIVE_INFINITY);
    return days || a.index - b.index;
  });
  return {
    count: items.length,
    overdueCount: overdue.length,
    maxOverdueDays: overdue.reduce((max, item) => Math.max(max, Math.abs(Math.min(item.daysLeft ?? 0, 0))), 0),
    title: ordered[0].item.title,
    tone: overdue.length ? "danger" : "warning",
  };
}
```

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run src/__tests__/portal-refresh-model.test.ts`

Expected: 3 tests PASS.

### Task 2: Collapsible goal banner and mobile shell contracts

**Files:**
- Create: `src/__tests__/portal-refresh-ui.test.ts`
- Modify: `web/src/portal/components/GoalBanner.vue`
- Modify: `web/src/portal/components/HeroHeader.vue`
- Modify: `web/src/portal/components/UserBox.vue`
- Modify: `web/src/portal/components/TabNav.vue`
- Modify: `web/src/portal/components/tabs/home/HomeWidgetTasks.vue`
- Modify: `web/src/portal/components/tabs/home/HomeWidgetGoals.vue`
- Modify: `web/src/portal/components/tabs/home/HomeWidgetDocs.vue`

- [x] **Step 1: Write failing UI contract tests**

```ts
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("portal mobile and accessibility contracts", () => {
  it("keeps goal details available behind an accessible summary", () => {
    const source = read("web/src/portal/components/GoalBanner.vue");
    expect(source).toContain("goalBannerSummary");
    expect(source).toContain(":aria-expanded=\"expanded\"");
    expect(source).toContain("aria-controls=\"goal-banner-details\"");
    expect(source).toContain("id=\"goal-banner-details\"");
  });

  it("uses wrapping and shrinkable containers in the mobile shell", () => {
    const header = read("web/src/portal/components/HeroHeader.vue");
    const user = read("web/src/portal/components/UserBox.vue");
    const tasks = read("web/src/portal/components/tabs/home/HomeWidgetTasks.vue");
    expect(header).toContain("portal-topbar");
    expect(header).toContain("min-w-0");
    expect(user).toContain("flex-wrap");
    expect(tasks).toContain("home-task-row");
    expect(tasks).toContain("home-task-title");
  });

  it("does not use low-contrast gray for meaningful home metadata", () => {
    for (const path of [
      "web/src/portal/components/GoalBanner.vue",
      "web/src/portal/components/UserBox.vue",
      "web/src/portal/components/tabs/home/HomeWidgetTasks.vue",
      "web/src/portal/components/tabs/home/HomeWidgetGoals.vue",
      "web/src/portal/components/tabs/home/HomeWidgetDocs.vue",
    ]) {
      expect(read(path), path).not.toMatch(/text-gray-(300|400)/);
    }
  });
});
```

- [x] **Step 2: Verify RED**

Run: `npx vitest run src/__tests__/portal-refresh-ui.test.ts`

Expected: FAIL on missing summary/ARIA and missing responsive classes; low-contrast gray remains.

- [x] **Step 3: Implement the banner behaviour and template**

Keep `labelOf`, `goalBanner`, `goalRisk` and `dismissGoalBanner`. Add:

```ts
import { computed, ref } from "vue";
import { goalBannerSummary } from "../utils/goalSummary";

const expanded = ref(false);
const summary = computed(() => goalBannerSummary(goalBanner.items));
```

Use this complete visible structure:

```vue
<div id="goal-banner" v-show="goalBanner.items.length" class="goal-alert" :class="summary?.tone === 'danger' ? 'goal-alert--danger' : 'goal-alert--warning'">
  <div class="goal-alert__inner">
    <span class="goal-alert__mark" aria-hidden="true">!</span>
    <button type="button" class="goal-alert__summary" :aria-expanded="expanded" aria-controls="goal-banner-details" @click="expanded = !expanded">
      <span class="goal-alert__count">{{ summary?.overdueCount ? `${summary.overdueCount} 项目标逾期` : `${summary?.count ?? 0} 个临近节点` }}</span>
      <span v-if="summary?.maxOverdueDays" class="goal-alert__days">最长 {{ summary.maxOverdueDays }} 天</span>
      <span class="goal-alert__lead">{{ summary?.title }}</span>
      <span class="goal-alert__toggle">{{ expanded ? '收起' : '查看详情' }} <span aria-hidden="true">{{ expanded ? '↑' : '↓' }}</span></span>
    </button>
    <button type="button" class="goal-alert__close" aria-label="关闭目标提醒" @click="dismissGoalBanner">×</button>
  </div>
  <div v-show="expanded" id="goal-banner-details" class="goal-alert__details">
    <a v-for="(it, i) in goalBanner.items" :key="i" :href="it.link" target="_blank" rel="noopener noreferrer" class="goal-alert__detail">
      <b>{{ labelOf(it).text }}</b><span>{{ it.title }}</span><small>{{ it.group }} · {{ it.progress === null ? '未填写进度' : Math.round(it.progress) + '%' }}</small>
    </a>
  </div>
</div>
```

- [x] **Step 4: Apply mobile row semantics and contrast**

In `HomeWidgetTasks.vue`, replace each task `<li>` with this structure and keep the existing `rows` source:

```vue
<li v-for="(t, i) in rows" :key="i" class="home-task-row">
  <a v-if="t.url" :href="t.url" target="_blank" rel="noopener noreferrer" class="home-task-title">{{ t.title }}</a>
  <span v-else class="home-task-title">{{ t.title }}</span>
  <span class="home-task-meta">
    <span class="home-status"><i aria-hidden="true" :style="`background:${t.color}`"></i>{{ t.status }}</span>
    <time class="mono text-nec-gray">{{ fmtDashDate(t.deadline) }}</time>
  </span>
</li>
```

Replace informational `text-gray-300/400` with `text-nec-gray` in the listed files. Add `flex-wrap`, `min-w-0` and responsive hiding only to secondary user metadata; do not hide login/logout controls. Keep the existing health panel and authentication logic unchanged.

In `HomeWidgetGoals.vue`, add `home-goal-row` to each goal container, `home-goal-line` to its first flex row and `home-goal-title` to the title span. In `HomeTab.vue`, add `home-commit-title` to commit links/fallback text and `home-commit-meta` to author/time spans. In `TabNav.vue`, add `portal-tab-scroll` to the existing horizontal scroll container. These classes are styled in Task 3; no data or click handler changes are needed.

- [x] **Step 5: Verify GREEN**

Run: `npx vitest run src/__tests__/portal-refresh-model.test.ts src/__tests__/portal-refresh-ui.test.ts`

Expected: all tests PASS.

### Task 3: Portal visual system and explicit home grid

**Files:**
- Create: `web/src/portal/portal-refresh.css`
- Modify: `web/src/portal/main.ts`
- Modify: `web/index.html`
- Modify: `web/src/portal/App.vue`
- Modify: `web/src/portal/components/tabs/HomeTab.vue`
- Test: `src/__tests__/portal-refresh-ui.test.ts`

- [x] **Step 1: Add failing grid and shell contracts**

```ts
it("uses an explicit home grid and preserves original drag indexes", () => {
  const home = read("web/src/portal/components/tabs/HomeTab.vue");
  expect(home).toContain("primaryWidgets");
  expect(home).toContain("secondaryWidgets");
  expect(home).toContain("entry.index");
  expect(home).toContain("home-grid");
  expect(home).not.toContain("xl:columns-2");
});

it("widens only the portal working views", () => {
  const app = read("web/src/portal/App.vue");
  expect(app).toContain("mainWidthClass");
  expect(app).toContain("tabs.active === 'home'");
  expect(app).toContain("tabs.active === 'apps'");
});
```

Run: `npx vitest run src/__tests__/portal-refresh-ui.test.ts`

Expected: FAIL on missing grid and width model.

- [x] **Step 2: Add home view models without changing persistence**

Add to `HomeTab.vue`:

```ts
const HOME_SECONDARY_IDS = new Set(["my-apps", "docs"]);
const sameHomeRegion = (a: HomeWidget, b: HomeWidget) => HOME_SECONDARY_IDS.has(a.id) === HOME_SECONDARY_IDS.has(b.id);
const indexedWidgets = computed(() => widgets.value.map((widget, index) => ({ widget, index })));
const primaryWidgets = computed(() => indexedWidgets.value.filter(({ widget }) => !HOME_SECONDARY_IDS.has(widget.id)));
const secondaryWidgets = computed(() => indexedWidgets.value.filter(({ widget }) => HOME_SECONDARY_IDS.has(widget.id)));
```

Render loading/empty states first, then this grid. Before the existing reorder in `onDragOver`, add `if (!sameHomeRegion(widgets.value[dragIdx.value], widgets.value[i])) return;` so cross-region dragging cannot persist an invisible order change. Keep all other existing component and drag callbacks:

```vue
<div v-else id="home-widgets" class="home-grid">
  <div class="home-column home-column--primary">
    <div v-for="entry in primaryWidgets" :key="entry.widget.id" class="portal-card home-widget" :class="{ 'ring-2 ring-sky-200': dragIdx === entry.index }" @dragover="onDragOver(entry.index, $event)" @drop="onCardDrop">
      <div class="home-widget__header">
        <h3>{{ entry.widget.title || HOME_WIDGET_DEFS[entry.widget.id].title }}</h3>
        <div v-if="auth.me.authenticated" class="home-widget__tools">
          <span @dragstart="onDragStart(entry.index, $event)" @dragend="onDragEnd" draggable="true" title="在同一功能区内拖拽排序" class="home-widget__drag">⠿ 拖拽</span>
          <button @click="removeHomeWidget(entry.index)" class="home-widget__remove">× 移除</button>
        </div>
      </div>
      <component :is="HOME_WIDGET_DEFS[entry.widget.id].comp" :shared="shared" />
    </div>
  </div>
  <div class="home-column home-column--secondary">
    <div v-for="entry in secondaryWidgets" :key="entry.widget.id" class="portal-card home-widget" :class="{ 'ring-2 ring-sky-200': dragIdx === entry.index }" @dragover="onDragOver(entry.index, $event)" @drop="onCardDrop">
      <div class="home-widget__header">
        <h3>{{ entry.widget.title || HOME_WIDGET_DEFS[entry.widget.id].title }}</h3>
        <div v-if="auth.me.authenticated" class="home-widget__tools">
          <span @dragstart="onDragStart(entry.index, $event)" @dragend="onDragEnd" draggable="true" title="在同一功能区内拖拽排序" class="home-widget__drag">⠿ 拖拽</span>
          <button @click="removeHomeWidget(entry.index)" class="home-widget__remove">× 移除</button>
        </div>
      </div>
      <component :is="HOME_WIDGET_DEFS[entry.widget.id].comp" :shared="shared" />
    </div>
  </div>
</div>
```

Set default source label to `团队视图`; retain personal/group labels and freshness. Keep team activity outside the grid.

- [x] **Step 3: Add shell width model and global CSS**

In `App.vue`, import `computed` and add:

```ts
const mainWidthClass = computed(() =>
  tabs.active === 'home' || tabs.active === 'apps' || tabs.active === 'dashboard' ? 'max-w-7xl' : 'max-w-5xl'
);
```

Bind `:class="mainWidthClass"` on `<main>` and keep every existing `v-show`. Import `./portal-refresh.css` from `main.ts` after `@shared/style.css`. Set `<body>` to `class="min-h-screen bg-[#FAF7F2] text-nec-ink"`.

Create the core CSS (catalogue and hero classes are added by later tasks):

```css
.portal-card { background: var(--nec-paper); border: 1px solid var(--nec-line); border-radius: 16px; }
.portal-topbar { display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; min-width: 0; }
.home-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr); gap: 1rem; align-items: start; }
.home-column { display: grid; gap: 1rem; min-width: 0; }
.home-widget { min-width: 0; padding: 1.25rem; }
.home-widget__header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: 1rem; }
.home-widget__header h3 { color: var(--nec-navy); font-size: 1.25rem; font-weight: 750; }
.home-widget__tools { display: flex; gap: .5rem; color: var(--nec-gray); font-size: .75rem; }
.home-widget__drag { cursor: grab; }
.home-widget__remove { min-height: 2rem; }
.home-task-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .5rem; padding: .75rem 0; border-bottom: 1px solid var(--nec-line); }
.home-task-title { min-width: 0; color: var(--nec-ink); line-height: 1.55; overflow-wrap: anywhere; }
.home-task-meta { display: flex; align-items: center; gap: .5rem; color: var(--nec-gray); font-size: .75rem; white-space: nowrap; }
.home-status { display: inline-flex; align-items: center; gap: .3rem; color: var(--nec-ink); font-size: .75rem; font-weight: 700; }
.home-status i { width: .45rem; height: .45rem; border-radius: 50%; }
.home-goal-row, .home-goal-line { min-width: 0; }
.home-goal-title, .home-commit-title { min-width: 0; overflow-wrap: anywhere; }
.home-commit-meta { color: var(--nec-gray); }
.portal-tab-scroll { min-width: 0; overscroll-behavior-inline: contain; mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 1.5rem), transparent 100%); }
.portal-card :is(a,button):focus-visible, .goal-alert :is(a,button):focus-visible, .portal-hero :is(a,button):focus-visible, .portal-tab-scroll button:focus-visible { outline: 3px solid var(--nec-navy); outline-offset: 3px; }
@media (max-width: 767px) {
  .home-grid { grid-template-columns: minmax(0, 1fr); }
  .home-widget { padding: 1rem; }
  .home-task-row { grid-template-columns: minmax(0, 1fr); }
  .home-task-title { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .home-task-meta { justify-content: space-between; white-space: normal; }
  .home-goal-line { flex-wrap: wrap; }
  .home-goal-title { flex-basis: 100%; order: 5; white-space: normal; }
  #home-activity li { flex-wrap: wrap; }
  .home-commit-title { flex-basis: 100%; order: 3; white-space: normal; }
  .home-commit-meta { margin-left: auto; font-size: .75rem; }
}
@media (prefers-reduced-motion: reduce) {
  .portal-card, .goal-alert, .portal-topbar, .portal-hero *, .app-catalog-row, .app-visual { transition: none !important; animation: none !important; }
}
```

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run src/__tests__/portal-refresh-ui.test.ts src/__tests__/home.test.ts`

Expected: all tests PASS, including existing home layout tests.

### Task 4: Application catalogue helpers and accessible visuals

**Files:**
- Create: `web/src/portal/utils/appCatalog.ts`
- Create: `web/src/portal/components/apps/AppVisual.vue`
- Test: `src/__tests__/portal-refresh-model.test.ts`

- [x] **Step 1: Add failing catalogue model tests**

```ts
import { appCover, appMonogram, catalogNumber } from "../../web/src/portal/utils/appCatalog";

describe("application catalogue model", () => {
  it("formats stable two-digit numbers", () => {
    expect(catalogNumber(0)).toBe("01");
    expect(catalogNumber(13)).toBe("14");
  });

  it("uses only local cover assets and readable fallbacks", () => {
    expect(appCover("k1")).toBe("/apps/k1/dashboard-preview.jpg");
    expect(appCover("ress-solution")).toBe("/assets/starcharge-ress/ress-scene-poster.png");
    expect(appCover("unknown")).toBe("");
    expect(appMonogram("硬件评审流程")).toBe("硬");
    expect(appMonogram("  ")).toBe("N");
  });
});
```

Run: `npx vitest run src/__tests__/portal-refresh-model.test.ts`

Expected: FAIL because the helper does not exist.

- [x] **Step 2: Implement the helper**

```ts
const LOCAL_COVERS: Record<string, string> = {
  k1: "/apps/k1/dashboard-preview.jpg",
  "mech-review-6014": "/apps/mech-review-6014/sketch.png",
  "ress-solution": "/assets/starcharge-ress/ress-scene-poster.png",
};

export function catalogNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function appCover(name: string): string {
  return LOCAL_COVERS[name] ?? "";
}

export function appMonogram(title: string): string {
  return Array.from(title.trim())[0] ?? "N";
}
```

- [x] **Step 3: Verify the original local images**

```bash
file public/apps/k1/dashboard-preview.jpg public/apps/mech-review-6014/sketch.png
```

Confirmed dimensions and content: K1 JPEG is 1440×1442; 6014 sketch PNG is 1180×660. The initially suspected mismatch came from parallel image results being read in a different order, so no binary asset change was retained.

- [x] **Step 4: Implement the reusable visual**

```vue
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { appCover, appMonogram } from "../../utils/appCatalog";

const props = withDefaults(defineProps<{ name: string; title: string; compact?: boolean }>(), { compact: false });
const failed = ref(false);
const cover = computed(() => appCover(props.name));
watch(cover, () => { failed.value = false; });
</script>

<template>
  <span class="app-visual" :class="{ 'app-visual--compact': compact }">
    <img v-if="cover && !failed" :src="cover" alt="" loading="lazy" @error="failed = true" />
    <span v-else class="app-visual__fallback" aria-hidden="true">
      <svg viewBox="0 0 120 120" focusable="false"><path d="M0 30H120M0 60H120M0 90H120M30 0V120M60 0V120M90 0V120" /><circle cx="60" cy="60" r="28" /><path d="M44 60H76M60 44V76" /></svg>
      <b>{{ appMonogram(title) }}</b>
    </span>
  </span>
</template>
```

- [x] **Step 5: Verify GREEN**

Run: `npx vitest run src/__tests__/portal-refresh-model.test.ts`

Expected: all helper tests PASS.

### Task 5: Shared numbered catalogue and home app shortcuts

**Files:**
- Create: `web/src/portal/components/apps/AppCatalogRow.vue`
- Modify: `web/src/portal/components/tabs/AppsTab.vue`
- Modify: `web/src/portal/components/tabs/home/HomeWidgetApps.vue`
- Modify: `web/src/portal/portal-refresh.css`
- Modify: `src/__tests__/app-integration-ui.test.ts`
- Test: `src/__tests__/portal-refresh-ui.test.ts`

- [x] **Step 1: Change integration and catalogue contracts first**

Replace the first test in `app-integration-ui.test.ts` with:

```ts
it("three groups share one catalogue row and one integration badge implementation", () => {
  const component = fs.readFileSync("web/src/shared/ui/IntegrationBadge.vue", "utf8");
  const row = fs.readFileSync("web/src/portal/components/apps/AppCatalogRow.vue", "utf8");
  const appsTab = fs.readFileSync("web/src/portal/components/tabs/AppsTab.vue", "utf8");
  expect(component).toContain("integrationBadgeModel");
  expect(component).toContain("classes[model.tone]");
  expect(row).toContain("<IntegrationBadge");
  expect(appsTab.match(/<AppCatalogRow\b/g)).toHaveLength(3);
  expect(appsTab).not.toContain("<IntegrationBadge");
});
```

Add to `portal-refresh-ui.test.ts`:

```ts
it("keeps catalogue navigation, publishing and community metadata contracts", () => {
  const row = read("web/src/portal/components/apps/AppCatalogRow.vue");
  const apps = read("web/src/portal/components/tabs/AppsTab.vue");
  expect(row).toContain("catalogNumber(index)");
  expect(row).toContain("AppVisual");
  expect(row).toContain("a.shadows");
  expect(row).toContain("a.updatedAt");
  const visual = read("web/src/portal/components/apps/AppVisual.vue");
  expect(visual).toContain("@error=\"failed = true\"");
  expect(visual).toContain("alt=\"\"");
  expect(apps).toContain("id=\"apps-list\"");
  expect(apps).toContain("id=\"publish-box\"");
});
```

Run both test files. Expected: FAIL because the shared row does not exist and AppsTab still has direct badges.

- [x] **Step 2: Implement the shared row**

```vue
<script setup lang="ts">
import { computed } from "vue";
import IntegrationBadge from "@shared/ui/IntegrationBadge.vue";
import AppVisual from "./AppVisual.vue";
import { catalogNumber } from "../../utils/appCatalog";

const props = defineProps<{ a: any; index: number }>();
const external = computed(() => props.a.source !== "builtin");
</script>

<template>
  <a class="app-catalog-row" :href="a.url" :target="external ? '_blank' : undefined" :rel="external ? 'noopener noreferrer' : undefined">
    <span class="app-catalog-row__number mono">{{ catalogNumber(index) }}</span>
    <AppVisual :name="a.name" :title="a.title" />
    <span class="app-catalog-row__body">
      <span class="app-catalog-row__title"><b>{{ a.title }}</b><span aria-hidden="true">↗</span></span>
      <span class="app-catalog-row__description">{{ a.description || a.desc || 'NEC 团队应用' }}</span>
      <span class="app-catalog-row__meta">
        <IntegrationBadge :integration="a.integration" />
        <small v-if="external">{{ a.author || 'NEC 队员' }}<template v-if="a.version"> · v{{ a.version }}</template> · 更新于 {{ a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('zh-CN') : '—' }}</small>
      </span>
      <small v-if="a.shadows" class="app-catalog-row__warning">双版本：此行进入 R2 独立域名版，/apps/ 路径为仓内版</small>
    </span>
  </a>
</template>
```

`IntegrationBadge` continues to expose `integrationBadgeModel` and remains the only badge implementation; `AppCatalogRow` only renders it.

- [x] **Step 3: Render all three groups through the row**

In `AppsTab.vue`, import only `AppCatalogRow`. Each group gets a heading and `<div class="app-catalog-list">` with:

```vue
<AppCatalogRow v-for="(a, index) in coreApps" :key="a.name" :a="a" :index="index" />
```

Use `standaloneApps` and `communityApps` in the other two identical loops. Keep `apps-list` on the community list, retain its empty state, and leave the publish Prompt logic untouched. Remove the three old card grids and direct `IntegrationBadge` imports.

- [x] **Step 4: Reuse AppVisual in home shortcuts**

Replace the circular initial in `HomeWidgetApps.vue` with:

```vue
<AppVisual :name="a.name" :title="titleParts(a.title)[0]" compact />
```

Import `AppVisual`, keep recent-use sorting and click tracking, and change titles/descriptions to `text-nec-ink` / `text-nec-gray` with two-line wrapping on narrow screens.

- [x] **Step 5: Add catalogue CSS**

```css
.app-catalog-list { overflow: hidden; background: var(--nec-paper); border: 1px solid var(--nec-line); border-radius: 16px; }
.app-catalog-row { display: grid; grid-template-columns: 3rem 8rem minmax(0, 1fr); gap: 1.5rem; align-items: center; min-width: 0; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--nec-line); transition: background-color .18s ease; }
.app-catalog-row:last-child { border-bottom: 0; }
.app-catalog-row:hover { background: var(--nec-royal-100); }
.app-catalog-row__number { align-self: start; padding-top: .25rem; color: var(--nec-gray); font-size: 1.25rem; font-weight: 700; }
.app-catalog-row__body { display: grid; gap: .5rem; min-width: 0; }
.app-catalog-row__title { display: flex; justify-content: space-between; gap: 1rem; color: var(--nec-navy); font-size: clamp(1.25rem, 2vw, 1.75rem); line-height: 1.25; }
.app-catalog-row__description { color: var(--nec-gray); line-height: 1.6; }
.app-catalog-row__meta { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; color: var(--nec-gray); }
.app-catalog-row__warning { color: var(--nec-warning); }
.app-visual { position: relative; display: block; overflow: hidden; width: 8rem; aspect-ratio: 1; background: var(--nec-royal-100); border-radius: 12px; }
.app-visual img { width: 100%; height: 100%; object-fit: cover; }
.app-visual__fallback { position: absolute; inset: 0; display: grid; place-items: center; color: var(--nec-navy); }
.app-visual__fallback svg { position: absolute; inset: 0; width: 100%; height: 100%; fill: none; stroke: var(--nec-cyan); stroke-width: .7; opacity: .35; }
.app-visual__fallback b { position: relative; font-size: 2rem; }
.app-visual--compact { flex: 0 0 3rem; width: 3rem; border-radius: 9px; }
.app-visual--compact .app-visual__fallback b { font-size: 1rem; }
@media (max-width: 639px) {
  .app-catalog-row { grid-template-columns: 2rem 4.5rem minmax(0, 1fr); gap: .75rem; padding: 1rem; }
  .app-visual { width: 4.5rem; }
  .app-catalog-row__description { font-size: .8125rem; }
}
```

- [x] **Step 6: Verify GREEN**

Run: `npx vitest run src/__tests__/portal-refresh-model.test.ts src/__tests__/portal-refresh-ui.test.ts src/__tests__/app-integration-ui.test.ts src/__tests__/portal-apps.test.ts`

Expected: all tests PASS.

### Task 6: Full and compact dawn hero

**Files:**
- Modify: `web/src/portal/components/HeroHeader.vue`
- Modify: `web/src/portal/portal-refresh.css`
- Test: `src/__tests__/portal-refresh-ui.test.ts`

- [x] **Step 1: Add failing hero contract**

```ts
it("keeps a compact returning-user hero and an accessible full hero", () => {
  const hero = read("web/src/portal/components/HeroHeader.vue");
  expect(hero).toContain("heroCompact()");
  expect(hero).toContain("portal-hero__stage");
  expect(hero).toContain("switchTab('my-tasks')");
  expect(hero).toContain("switchTab('apps')");
  expect(hero).toContain("aria-hidden=\"true\"");
});
```

Run the UI test; expected FAIL on the new stage and actions.

- [x] **Step 2: Implement the hero stage while retaining all health/auth code**

Keep `<script>` health functions and `UserBox`. Compute compactness only after authentication initialization, so `heroCompact()` cannot mark the first visit seen before it can render:

```ts
const compact = computed(() => {
  if (auth.phase !== 'ready') return false;
  auth.tick;
  return heroCompact();
});
```

Use a `portal-topbar` for logo, health and user controls. Inside `id="hero-full"`, add:

```vue
<div class="portal-hero__stage">
  <div class="portal-hero__copy">
    <p class="portal-hero__eyebrow mono">NEC HUB · TEAM AI WORKSPACE · 2026</p>
    <h1 class="hero-title">BUILT <span class="to">TO</span> DAWN</h1>
    <p class="portal-hero__cn">为黎明而造</p>
    <p class="portal-hero__lede">把任务、工具与创造，放在同一张工作台上。</p>
    <div class="portal-hero__actions">
      <button type="button" class="portal-button portal-button--primary" @click="switchTab('my-tasks')">进入我的任务 <span aria-hidden="true">→</span></button>
      <button type="button" class="portal-button portal-button--secondary" @click="switchTab('apps')">浏览应用目录</button>
    </div>
    <a class="portal-hero__warehouse" href="https://mes.newenergycoder.club/home.html" target="_blank" rel="noopener noreferrer">NEC 仓库作业台 · 找物品 / 扫标签 / 办工单 <span aria-hidden="true">↗</span></a>
  </div>
  <div class="portal-hero__object" aria-hidden="true">
    <svg viewBox="0 0 560 440" focusable="false">
      <circle cx="382" cy="148" r="112" class="hero-orbit hero-orbit--outer" />
      <circle cx="382" cy="148" r="86" class="hero-orbit hero-orbit--inner" />
      <path d="M70 340H510M110 368H470" class="hero-horizon" />
      <path d="M92 302L220 236L350 302L220 368Z" class="hero-plinth" />
      <path d="M220 236V112L350 178V302L220 368Z" class="hero-module" />
      <path d="M244 180L302 151M244 214L326 177M244 248L326 211" class="hero-module-lines" />
    </svg>
    <img src="/brand/nec-logo.svg" alt="" />
    <span class="mono">NEW ENERGY / NEW MAKING</span>
  </div>
</div>
```

Remove the old chip row and old separate `hero-sun`; retain `hero-mini`, `horizon`, `base-line` and `heroCompact()` behavior.

- [x] **Step 3: Add complete hero and alert CSS**

```css
.portal-hero { background-color: #faf7f2; }
.portal-hero__stage { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(20rem, .9fr); gap: 2rem; align-items: center; min-height: min(58vh, 36rem); padding: 2rem 0 3rem; }
.portal-hero__copy { position: relative; z-index: 1; min-width: 0; }
.portal-hero__eyebrow { margin-bottom: 1rem; color: var(--nec-gray); font-size: .75rem; letter-spacing: .14em; }
.portal-hero__cn { margin-top: 1rem; color: var(--nec-navy); font-size: 1rem; font-weight: 800; letter-spacing: .3em; }
.portal-hero__lede { max-width: 32rem; margin-top: 1rem; color: var(--nec-gray); font-size: 1rem; line-height: 1.8; }
.portal-hero__actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1.75rem; }
.portal-button { min-height: 2.75rem; padding: .7rem 1.1rem; border: 1px solid var(--nec-navy); border-radius: 999px; font-weight: 700; }
.portal-button--primary { background: var(--nec-navy); color: white; }
.portal-button--secondary { color: var(--nec-navy); }
.portal-hero__warehouse { display: inline-flex; min-height: 2.75rem; align-items: center; margin-top: .75rem; color: var(--nec-gray); font-size: .8125rem; text-decoration: underline; text-underline-offset: .25rem; }
.portal-hero__object { position: relative; min-width: 0; }
.portal-hero__object svg { display: block; width: 100%; height: auto; }
.portal-hero__object img { position: absolute; left: 31%; top: 31%; width: 20%; height: auto; }
.portal-hero__object > span { position: absolute; right: 0; bottom: 0; color: var(--nec-gray); font-size: .65rem; letter-spacing: .12em; }
.hero-orbit, .hero-module, .hero-plinth { fill: rgba(255,255,255,.5); stroke: var(--nec-cyan); stroke-width: 1.5; }
.hero-orbit--inner { fill: none; stroke-dasharray: 3 9; }
.hero-horizon, .hero-module-lines { fill: none; stroke: var(--nec-navy); stroke-width: 1.5; }
.goal-alert { margin-bottom: 1rem; border: 1px solid; }
.goal-alert--danger { background: var(--nec-danger-bg); border-color: color-mix(in srgb, var(--nec-danger) 30%, white); color: var(--nec-danger); }
.goal-alert--warning { background: var(--nec-warning-bg); border-color: color-mix(in srgb, var(--nec-warning) 30%, white); color: var(--nec-warning); }
.goal-alert__inner { display: flex; align-items: center; gap: .75rem; max-width: 80rem; min-height: 3.5rem; margin: auto; padding: .5rem 1.5rem; }
.goal-alert__summary { display: flex; flex: 1; flex-wrap: wrap; align-items: center; gap: .5rem .75rem; min-width: 0; text-align: left; }
.goal-alert__count, .goal-alert__days { font-weight: 800; white-space: nowrap; }
.goal-alert__lead { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--nec-ink); }
.goal-alert__toggle { margin-left: auto; font-size: .75rem; font-weight: 700; white-space: nowrap; }
.goal-alert__close { min-width: 2.75rem; min-height: 2.75rem; }
.goal-alert__details { display: grid; max-width: 80rem; margin: auto; padding: 0 1.5rem 1rem; }
.goal-alert__detail { display: grid; grid-template-columns: 8rem minmax(0, 1fr) auto; gap: .75rem; padding: .65rem 0; border-top: 1px solid currentColor; }
.goal-alert__detail small { color: var(--nec-gray); }
@media (max-width: 767px) {
  .portal-hero__stage { grid-template-columns: minmax(0, 1fr); min-height: auto; padding-top: 1rem; }
  .portal-hero__object { max-height: 15rem; }
  .portal-hero__object svg { max-height: 15rem; }
  .goal-alert__inner, .goal-alert__details { padding-inline: 1rem; }
  .goal-alert__lead { flex-basis: 100%; order: 3; }
  .goal-alert__toggle { margin-left: 0; }
  .goal-alert__detail { grid-template-columns: minmax(0, 1fr); gap: .2rem; }
}
```

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run src/__tests__/portal-refresh-ui.test.ts`

Expected: all UI contracts PASS.

### Task 7: Full verification and browser acceptance

**Files:**
- Verify all modified files; no new production scope.

- [x] **Step 1: Run focused and complete automated tests**

```bash
npx vitest run src/__tests__/portal-refresh-model.test.ts src/__tests__/portal-refresh-ui.test.ts src/__tests__/app-integration-ui.test.ts src/__tests__/home.test.ts src/__tests__/portal-apps.test.ts
npm run test:ci
npm run check
npm run build:web
```

Expected: all commands exit 0. `build:web` may regenerate `public/portal-assets` and `public/apps/builtin.json`; inspect `git diff` and include only intended generated output. If the generated manifest is unchanged, leave it unchanged.

- [x] **Step 2: Start local preview**

Create a temporary `.claude/launch.json` entry that runs `npm --prefix web run dev -- --host 0.0.0.0 --port 5173`, start the preview, and remove the temporary config before finishing. If API data is unavailable locally, record that limitation; use the production page only for read-only comparison, not as proof that local changes work.

- [x] **Step 3: Inspect desktop and responsive layouts**

Check 1440×1000, 768×1024 and 390×844:

- Home primary/secondary columns, no unexpected empty grid tracks.
- Summary expands/collapses with keyboard and exposes all source items.
- Task titles, status, dates, goal actions and commit metadata do not cause document-level horizontal overflow.
- All application groups show stable numbering, correct covers/fallbacks, integration badges and working links.
- Full hero actions switch tabs; compact hero still hides the full stage.
- Password login, health panel, layout editing and drag handles remain usable.

Use `preview_eval` for this read-only overflow check:

```js
({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflowing: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, id: el.id, class: el.className })) })
```

Expected: `scrollWidth <= innerWidth`; inspect any intentional nav scroll container separately rather than hiding global overflow.

- [x] **Step 4: Inspect console, reduced motion and final diff**

Check browser console for errors and failed local asset requests. Emulate reduced motion and confirm transitions are removed. Run `git status --short` and `git diff --stat`; ensure no launch config, temporary screenshot, dependency change or unrelated generated file remains. Do not commit or push.

- [x] **Step 5: Report honestly**

Report automated test/build results and exactly which viewport/data states were inspected. If authenticated data or drag interactions could not be exercised locally, state that limitation rather than claiming full verification.
