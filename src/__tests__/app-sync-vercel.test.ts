import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toolSyncVercel } from "../mcp/tools/apps";
import { KV_KEYS } from "../shared/kv-keys";
import { validIntegration } from "./app-integration-fixtures";
import { createMockEnv, type MockEnv } from "./mock-env";

function setupEnv() {
  const env = createMockEnv() as MockEnv & { VERCEL_TEAM?: string };
  env.VERCEL_TOKEN = "vercel-test-token";
  return env;
}

describe("sync_vercel 集成声明", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/v9/projects/demo-app")) {
        return new Response(JSON.stringify({ targets: { production: { alias: ["demo.example.com"] } } }), { status: 200 });
      }
      if (url.includes("/v9/projects?")) {
        return new Response(JSON.stringify({ projects: [{ name: "demo-app" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dry-run 报告缺失声明但不写入", async () => {
    const env = setupEnv();
    const result = await toolSyncVercel({ confirm: false }, env as unknown as Env);
    expect(result.content[0].text).toMatch(/demo-app[\s\S]*integration/);
    expect(env.REGISTRY.put).not.toHaveBeenCalled();
  });

  it("confirm 任一声明非法时整批无写入", async () => {
    const env = setupEnv();
    await expect(toolSyncVercel({ confirm: true, integrations: {} }, env as unknown as Env))
      .rejects.toThrow(/demo-app.*integration/);
    expect(env.REGISTRY.put).not.toHaveBeenCalled();
  });

  it("合法声明整批写入", async () => {
    const env = setupEnv();
    const integration = validIntegration();
    await toolSyncVercel({ confirm: true, integrations: { "demo-app": integration } }, env as unknown as Env);
    const write = env.REGISTRY.put.mock.calls.find(([key]) => key === KV_KEYS.appsIndex);
    expect(write).toBeDefined();
    expect(JSON.parse(String(write![1]))[0]).toMatchObject({ name: "demo-app", integration });
  });
});
