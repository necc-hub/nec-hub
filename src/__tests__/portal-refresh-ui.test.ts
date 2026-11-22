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

  it("keeps a compact returning-user hero and an accessible full hero", () => {
    const hero = read("web/src/portal/components/HeroHeader.vue");
    expect(hero).toContain("heroCompact()");
    expect(hero).toContain("auth.phase !== 'ready'");
    expect(hero).toContain("return heroCompact();");
    expect(hero).toContain("portal-hero__stage");
    expect(hero).toContain("switchTab('my-tasks')");
    expect(hero).toContain("switchTab('apps')");
    expect(hero).toContain("aria-hidden=\"true\"");
  });
});
