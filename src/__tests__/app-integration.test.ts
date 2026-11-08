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
    expect(integrationBadgeModel(validIntegration({
      deprecated: true,
      status: "verified",
      evidence: [{ type: "production", ref: "docs/x.md", date: "2026-11-06", summary: "历史生产验收" }],
    })).statusLabel).toBe("已废弃");
  });
});
