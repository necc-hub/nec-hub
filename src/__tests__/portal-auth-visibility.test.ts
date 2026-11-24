import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { canViewPortalTab, PORTAL_INTERNAL_TABS, resolvePortalRoute } from "../../web/src/portal/utils/portalVisibility";

const read = (path: string) => fs.readFileSync(path, "utf8");
const PUBLIC_TABS = ["home", "apps", "skills", "docs", "repos", "prd", "agent"];
const guest = { ready: true, authenticated: false, isAdmin: false };
const member = { ready: true, authenticated: true, isAdmin: false };

 describe("portal authenticated visibility", () => {
  it("keeps public pages visible without a session", () => {
    for (const tab of PUBLIC_TABS) expect(canViewPortalTab(tab, guest)).toBe(true);
    for (const tab of PORTAL_INTERNAL_TABS) expect(canViewPortalTab(tab, guest), tab).toBe(false);
    expect(PORTAL_INTERNAL_TABS).toEqual([
      "my-tasks", "reimburse", "drawing-review", "hardware-review", "contract-approval",
      "task-schedule", "season-goals", "dashboard",
    ]);
  });

  it("does not open internal pages before auth initialization finishes", () => {
    expect(canViewPortalTab("dashboard", { ...member, ready: false })).toBe(false);
    expect(canViewPortalTab("apps", { ...guest, ready: false })).toBe(true);
  });

  it("restores internal pages for members and preserves admin role gating", () => {
    for (const tab of PORTAL_INTERNAL_TABS) expect(canViewPortalTab(tab, member), tab).toBe(true);
    expect(canViewPortalTab("admin", member)).toBe(false);
    expect(canViewPortalTab("admin", { ...member, isAdmin: true })).toBe(true);
  });

  it("keeps an internal deep link pending until login grants access", () => {
    expect(resolvePortalRoute("dashboard", null, tab => canViewPortalTab(tab, guest))).toBe("dashboard");
    expect(resolvePortalRoute("home", "dashboard", tab => canViewPortalTab(tab, guest))).toBe("home");
    expect(resolvePortalRoute("home", "dashboard", tab => canViewPortalTab(tab, member))).toBe("dashboard");
    expect(resolvePortalRoute("home", "admin", tab => canViewPortalTab(tab, member))).toBe("home");
  });

  it("uses the shared model and does not mount hidden internal components", () => {
    const router = read("web/src/portal/composables/useTabs.ts");
    expect(router).toContain("canViewPortalTab");
    expect(router).toContain("resolvePortalRoute");
    const app = read("web/src/portal/App.vue");
    expect(app).not.toMatch(/<(?:MyTasksTab|DrawingReviewTab|ReimburseTab|TaskScheduleTab|SeasonGoalsTab|HardwareReviewTab|ContractApprovalTab|DashboardTab|AdminTab) v-show=/);
    expect(app).toContain("v-if=\"auth.phase === 'ready' && auth.me.authenticated\"");
    expect(app).toContain("const activeTabComponent");
    const home = read("web/src/portal/components/tabs/HomeTab.vue");
    expect(home).toContain("HOME_INTERNAL_WIDGET_IDS");
    expect(home).toContain("v-if=\"auth.phase === 'ready' && auth.me.authenticated\"");
    const hero = read("web/src/portal/components/HeroHeader.vue");
    expect(hero).not.toContain("switchTab('my-tasks')");
    expect(hero).toContain("switchTab('docs')");
  });
});
