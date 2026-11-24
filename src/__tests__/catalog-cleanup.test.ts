/**
 * 目录去重与资料页种子迁移测试
 */
import { describe, expect, it } from "vitest";
import {
  filterCatalogEntries,
  isCatalogEligible,
  PORTAL_SELF_MIRRORS,
  R2_MIRROR_KEEP,
  DEPRECATED_MIRRORS,
  type CatalogLike,
} from "../shared/app-catalog";
import { validIntegration } from "./app-integration-fixtures";
import { migrateSeedDocs, type DocEntry } from "../docs";

const NAMES = new Set(["drawing-review", "reimburse", "domains", "drawing"]);

function entry(overrides: Partial<CatalogLike> & { name: string }): CatalogLike {
  return { title: overrides.name, source: "builtin", url: `/apps/${overrides.name}/`, ...overrides };
}

describe("filterCatalogEntries", () => {
  it("剔除已废弃的 builtin（drawing）与门户自镜像", () => {
    const input = [
      entry({ name: "drawing", integration: validIntegration({ deprecated: true }) }),
      entry({ name: "nec-hub-portal", source: "r2", url: "https://hub/apps/nec-hub-portal/" }),
      entry({ name: "drawing-review" }),
    ];
    const out = filterCatalogEntries(input, NAMES);
    expect(out.map((a) => a.name)).toEqual(["drawing-review"]);
    expect(PORTAL_SELF_MIRRORS.has("nec-hub-portal")).toBe(true);
  });

  it("同名 R2 副本默认去重，白名单保留", () => {
    const input = [
      entry({ name: "reimburse", source: "r2", url: "https://reimburse.zone/" }),
      entry({ name: "domains", source: "r2", url: "https://domains.zone/" }),
      entry({ name: "mes-warehouse", source: "external", url: "https://mes.zone/" }),
    ];
    const out = filterCatalogEntries(input, NAMES);
    expect(out.map((a) => a.name)).toEqual(["domains", "mes-warehouse"]);
    expect(R2_MIRROR_KEEP.has("domains")).toBe(true);
  });

  it("已废弃的 R2 镜像保留卡片但指向现行入口并标注", () => {
    const input = [entry({ name: "drawing", source: "r2", title: "机械图纸审批", url: "https://drawing.zone/" })];
    const out = filterCatalogEntries(input, NAMES);
    expect(out).toHaveLength(1);
    expect(out[0].title).toContain("已废弃");
    expect(out[0].url).toBe(`/apps/${DEPRECATED_MIRRORS.drawing.target}/`);
  });

  it("普通社区应用不受影响", () => {
    const input = [entry({ name: "inventory-check", source: "r2" })];
    expect(filterCatalogEntries(input, NAMES)).toHaveLength(1);
  });
});

describe("isCatalogEligible（构建期 manifest）", () => {
  it("deprecated 或自镜像不上架，其余保留", () => {
    expect(isCatalogEligible({ name: "drawing", integration: validIntegration({ deprecated: true }) })).toBe(false);
    expect(isCatalogEligible({ name: "nec-hub-portal" })).toBe(false);
    expect(isCatalogEligible({ name: "reimburse", integration: validIntegration() })).toBe(true);
  });
});

function doc(id: string, url: string, overrides: Partial<DocEntry> = {}): DocEntry {
  return {
    id,
    title: id,
    description: "",
    category: "sop",
    url,
    visibility: "all",
    maintainer: "x",
    updatedAt: "2026-10-14T00:00:00Z",
    source: "hub",
    ...overrides,
  };
}

describe("migrateSeedDocs（资料页种子迁移）", () => {
  it("删除空占位、修正 VI 手册死链、保留成员自发布资料", () => {
    const stored: DocEntry[] = [
      doc("nec-vi-manual", "/brand/NEC-VI-Manual_V1.0.md"),
      doc("vision-onboarding", ""),
      doc("tech-report-template", ""),
      doc("member-doc", "https://example.com/doc", { maintainer: "成员" }),
      doc("reimburse-sop", "/#tab-dashboard"),
    ];
    const out = migrateSeedDocs(stored, "2026-11-25T00:00:00Z");
    const ids = out.map((d) => d.id);

    expect(ids).not.toContain("vision-onboarding");
    expect(ids).not.toContain("tech-report-template");
    expect(ids).toContain("member-doc");

    const vi = out.find((d) => d.id === "nec-vi-manual");
    expect(vi?.url).toBe("/brand/NEC-VI-Manual_V1.1.md");
    expect(vi?.title).toContain("V1.1");

    const reimb = out.find((d) => d.id === "reimburse-sop");
    expect(reimb?.url).toBe("/#/reimburse");
  });

  it("补齐缺失的种子条目", () => {
    const out = migrateSeedDocs([doc("member-doc", "https://example.com")]);
    expect(out.map((d) => d.id)).toContain("nec-brand-center");
    expect(out.map((d) => d.id)).toContain("warehouse-sop");
  });

  it("清理 example.feishu.cn 占位链接", () => {
    const out = migrateSeedDocs([doc("legacy", "https://example.feishu.cn/docx/xxx")]);
    expect(out.find((d) => d.id === "legacy")?.url).toBe("");
  });
});
