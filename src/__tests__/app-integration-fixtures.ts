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
