import { describe, expect, it } from "vitest";
import { goalBannerSummary } from "../../web/src/portal/utils/goalSummary";
import { appCover, appMonogram, catalogNumber } from "../../web/src/portal/utils/appCatalog";

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
