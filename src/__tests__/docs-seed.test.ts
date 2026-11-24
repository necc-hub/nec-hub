/**
 * /api/docs 种子版本迁移行为测试（buildDocs）
 *
 * 覆盖线上真实踩过的坑：改 SEED_DOCS 但 KV 已有旧数据时，资料页必须自动迁移，
 * 否则 VI 手册会一直指向已删除的 V1.0（404）。
 */
import { describe, expect, it } from "vitest";
import { buildDocs, DOCS_SEED_VERSION, RETIRED_SEED_IDS, type DocEntry } from "../docs";
import { KV_KEYS } from "../shared/kv-keys";
import { createMockEnv, type MockEnv } from "./mock-env";

/** 带内存 Map 的 KV mock，记录写入次数以观察是否重复迁移 */
function envWithKv(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  const puts: Array<{ key: string; value: string }> = [];
  const env = createMockEnv() as MockEnv;
  env.REGISTRY.get = (async (key: string) => store.get(String(key)) ?? null) as never;
  env.REGISTRY.put = (async (key: string, value: string) => {
    store.set(String(key), value);
    puts.push({ key: String(key), value });
  }) as never;
  return { env: env as unknown as Env, store, puts };
}

function doc(id: string, url: string, overrides: Partial<DocEntry> = {}): DocEntry {
  return {
    id, title: id, description: "", category: "sop", url,
    visibility: "all", maintainer: "x", updatedAt: "2026-10-14T00:00:00Z", source: "hub", ...overrides,
  };
}

const req = () => new Request("https://hub/api/docs");

describe("buildDocs 种子迁移", () => {
  it("KV 为空：写入种子与版本号，且不含空 url 占位", async () => {
    const { env, store } = envWithKv();
    const docs = (await buildDocs(env, req())) as DocEntry[];
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.url !== "")).toBe(true);
    expect(docs.find((d) => d.id === "nec-vi-manual")?.url).toBe("/brand/NEC-VI-Manual_V1.1.md");
    expect(store.get(KV_KEYS.docsSeedVersion)).toBe(String(DOCS_SEED_VERSION));
  });

  it("KV 是旧版本：自动修死链、删空占位、保留成员资料，并写入版本号", async () => {
    const old: DocEntry[] = [
      doc("nec-vi-manual", "/brand/NEC-VI-Manual_V1.0.md"),
      doc("vision-onboarding", ""),
      doc("member-doc", "https://example.com/doc", { maintainer: "成员" }),
    ];
    const { env, store } = envWithKv({ [KV_KEYS.docsRegistry]: JSON.stringify(old) });
    const docs = (await buildDocs(env, req())) as DocEntry[];

    expect(docs.find((d) => d.id === "nec-vi-manual")?.url).toBe("/brand/NEC-VI-Manual_V1.1.md");
    expect(docs.map((d) => d.id)).not.toContain("vision-onboarding");
    expect(docs.map((d) => d.id)).toContain("member-doc");
    for (const id of RETIRED_SEED_IDS) expect(docs.map((d) => d.id)).not.toContain(id);
    expect(store.get(KV_KEYS.docsSeedVersion)).toBe(String(DOCS_SEED_VERSION));
  });

  it("版本号已对齐：不再重复迁移（无额外写入）", async () => {
    const { env, puts } = envWithKv();
    await buildDocs(env, req()); // 首次：写种子 + 版本
    const putsAfterFirst = puts.length;

    const docs = (await buildDocs(env, req())) as DocEntry[];
    expect(puts.length).toBe(putsAfterFirst);
    expect(docs.length).toBeGreaterThan(0);
  });

  it("未登录只返回 visibility=all", async () => {
    const hidden = doc("hidden-doc", "https://example.com/hidden", { visibility: "队长" });
    const { env } = envWithKv({
      [KV_KEYS.docsRegistry]: JSON.stringify([hidden]),
      [KV_KEYS.docsSeedVersion]: String(DOCS_SEED_VERSION),
    });
    const docs = (await buildDocs(env, req())) as DocEntry[];
    expect(docs.map((d) => d.id)).not.toContain("hidden-doc");
  });
});

/** 以 store 大小变化无法区分同值覆盖，这里直接用代理计数器更直观 */
function countPuts(store: Map<string, string>): number {
  return (store as unknown as { __puts?: number }).__puts ?? store.size;
}