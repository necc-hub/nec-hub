import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toolDeployApp, toolRegisterApp } from "../mcp/tools/apps";
import { KV_KEYS } from "../shared/kv-keys";
import { validIntegration } from "./app-integration-fixtures";
import { createMockEnv } from "./mock-env";

describe("应用上架集成声明", () => {
  beforeEach(() => {
    vi.stubGlobal("caches", { default: { delete: vi.fn().mockResolvedValue(true) } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deploy_app 缺 integration 时不上传、不写 KV", async () => {
    const env = createMockEnv();
    await expect(toolDeployApp(
      { name: "demo-app", files: [{ path: "index.html", text: "ok" }] },
      env as unknown as Env,
      new Request("https://hub.local/mcp"),
    )).rejects.toThrow(/integration/);
    expect(env.APPS_BUCKET.put).not.toHaveBeenCalled();
    expect(env.REGISTRY.put).not.toHaveBeenCalled();
  });

  it("register_app 非法声明时不写 KV", async () => {
    const env = createMockEnv();
    await expect(toolRegisterApp({
      name: "demo-app",
      url: "https://demo.example.com",
      integration: validIntegration({ status: "verified" }),
    }, env as unknown as Env)).rejects.toThrow(/production/);
    expect(env.REGISTRY.put).not.toHaveBeenCalled();
  });

  it("合法 deploy_app 保存声明", async () => {
    const env = createMockEnv();
    const integration = validIntegration();
    await toolDeployApp({
      name: "demo-app",
      files: [{ path: "index.html", text: "ok" }],
      integration,
    }, env as unknown as Env, new Request("https://hub.local/mcp"));
    const write = env.REGISTRY.put.mock.calls.find(([key]) => key === KV_KEYS.appsIndex);
    expect(write).toBeDefined();
    expect(JSON.parse(String(write![1]))[0].integration).toEqual(integration);
  });

  it("合法 register_app 保存声明", async () => {
    const env = createMockEnv();
    const integration = validIntegration();
    await toolRegisterApp({
      name: "demo-app",
      url: "https://demo.example.com",
      integration,
    }, env as unknown as Env);
    const write = env.REGISTRY.put.mock.calls.find(([key]) => key === KV_KEYS.appsIndex);
    expect(write).toBeDefined();
    expect(JSON.parse(String(write![1]))[0].integration).toEqual(integration);
  });
});
