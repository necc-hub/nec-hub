/**
 * PRD 文档注册表测试：确保「PRD 文档库」每张卡片都指向真实静态文件，
 * 避免新增内容只进页面、不进 public/docs/prd 导致线上 404。
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REGISTRY = resolve(process.cwd(), "web/src/portal/data/prd-docs.json");
const PUBLIC_PRD = resolve(process.cwd(), "public/docs/prd");

interface PrdDoc {
  slug: string;
  title: string;
  version: string;
  date: string;
  desc: string;
  html?: boolean;
}

const docs = JSON.parse(readFileSync(REGISTRY, "utf8")) as PrdDoc[];

describe("PRD 文档注册表", () => {
  it("每份注册文档都有对应的静态文件", () => {
    for (const doc of docs) {
      const file = resolve(PUBLIC_PRD, `${doc.slug}.${doc.html ? "html" : "md"}`);
      expect(existsSync(file), doc.slug).toBe(true);
    }
  });

  it("注册项字段完整、日期合法且 slug 唯一", () => {
    expect(new Set(docs.map((d) => d.slug)).size).toBe(docs.length);
    for (const doc of docs) {
      expect(doc.title.trim(), doc.slug).not.toBe("");
      expect(doc.version.trim(), doc.slug).not.toBe("");
      expect(doc.desc.trim(), doc.slug).not.toBe("");
      expect(doc.date, doc.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});