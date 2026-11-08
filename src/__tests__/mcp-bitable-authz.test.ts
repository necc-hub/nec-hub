import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toolQueryBitable } from "../mcp/tools/bitable-query";
import { KV_KEYS } from "../shared/kv-keys";

function createEnv() {
  const kv = new Map<string, string>([
    [KV_KEYS.dashboardConfig, JSON.stringify({ base: "appMock", tables: { tasks: "tblTasks", finance: "tblFinance", members: "tblMembers" } })],
    [KV_KEYS.role("ou_member"), JSON.stringify({ role: "队员", group: "机械组", matched: true })],
    [KV_KEYS.role("ou_captain"), JSON.stringify({ role: "队长", group: "管理组", matched: true })],
    [KV_KEYS.role("ou_external"), JSON.stringify({ role: "external", group: "", matched: false })],
  ]);
  return {
    REGISTRY: {
      get: async (key: string, type?: string) => {
        if (key === KV_KEYS.feishuTenantAccessToken) return { token: "mock-token", expireAt: Date.now() + 3600e3 };
        const value = kv.get(key) ?? null;
        return value !== null && type === "json" ? JSON.parse(value) : value;
      },
      put: async (key: string, value: string) => void kv.set(key, value),
      delete: async (key: string) => void kv.delete(key),
    },
    FEISHU_APP_ID: "mock-app-id",
    FEISHU_APP_SECRET: "mock-app-secret",
  } as unknown as Env;
}

const users: Record<string, { open_id: string; name: string }> = {
  "u-member": { open_id: "ou_member", name: "队员甲" },
  "u-captain": { open_id: "ou_captain", name: "队长乙" },
  "u-external": { open_id: "ou_external", name: "访客丙" },
};

describe("query_bitable 用户权限", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: { headers?: { authorization?: string } }) => {
      const url = String(input);
      if (url.includes("/authen/v1/user_info")) {
        const token = init?.headers?.authorization?.replace(/^Bearer\s+/i, "") ?? "";
        const user = users[token];
        return new Response(JSON.stringify(user ? { code: 0, data: user } : { code: 99991663, msg: "invalid token" }), { status: 200 });
      }
      if (url.includes("/bitable/v1/")) {
        return new Response(JSON.stringify({
          code: 0,
          data: { items: [{ record_id: "rec1", fields: { 报销金额: 999, 任务: "测试任务" } }], has_more: false },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 404, msg: "not mocked" }), { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("匿名查询普通业务表也要求 user_token", async () => {
    await expect(toolQueryBitable({ table: "tasks" }, createEnv(), false)).rejects.toThrow(/user_token/);
  });

  it("matched=false 不按普通队员放行", async () => {
    await expect(toolQueryBitable({ table: "tasks", user_token: "u-external" }, createEnv(), false))
      .rejects.toThrow(/权限不足/);
  });

  it("普通队员可查 tasks 但查 finance 返回权限错误", async () => {
    const tasks = await toolQueryBitable({ table: "tasks", user_token: "u-member" }, createEnv(), false);
    expect(tasks.content[0].text).toContain("测试任务");
    await expect(toolQueryBitable({ table: "finance", user_token: "u-member" }, createEnv(), false))
      .rejects.toThrow(/队长\/财务/);
  });

  it("队长 user_token 可查 finance", async () => {
    const result = await toolQueryBitable({ table: "finance", user_token: "u-captain" }, createEnv(), false);
    expect(result.content[0].text).toContain("报销金额");
  });

  it("管理 Bearer 保持放行", async () => {
    const result = await toolQueryBitable({ table: "finance" }, createEnv(), true);
    expect(result.content[0].text).toContain("报销金额");
  });
});
