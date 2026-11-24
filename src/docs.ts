/**
 * 资料页（KV 注册表 + 种子数据 + 种子版本迁移）
 *
 * 注意：资料页读的是 KV `docs:registry`，不是本文件的 SEED_DOCS。
 * 改 SEED_DOCS 只会影响「首次访问且 KV 为空」的场景；已上线的资料必须靠
 * DOCS_SEED_VERSION 递增触发迁移（见 migrateSeedDocs），或走 MCP publish_doc / remove_docs。
 * 这也是历史上「代码改了 VI 手册 V1.1、线上仍指向 V1.0 死链」的根因。
 */

import { readIndex } from "./hosting";
import { KV_KEYS } from "./shared/kv-keys";
import { resolveSession } from "./shared/session";

/** 资料页注册表 KV key */
export const DOCS_REGISTRY_KEY = KV_KEYS.docsRegistry;

/**
 * 种子版本号：★ 修改 SEED_DOCS / RETIRED_SEED_IDS 后必须递增 ★
 * 线上 KV 里记录的版本与之不同时，buildDocs 会执行一次迁移（更新既有种子、补新增、删已下线）。
 */
export const DOCS_SEED_VERSION = 2;

/** 资料页条目（KV key: docs:registry，由 MCP publish_doc 写入） */
export interface DocEntry {
  id: string;
  title: string;
  description: string;
  /** 分类：brand=品牌规范 template=文档模板 sop=制度SOP training=培训材料 */
  category: "brand" | "template" | "sop" | "training";
  /** 为空字符串表示占位条目，前端展示「即将上线」且不可点击 */
  url: string;
  visibility: string;
  maintainer: string;
  updatedAt: string;
  source: string;
}

/**
 * 资料页种子数据。
 *
 * 原则：只放**链接可用**的条目。「即将上线」的空占位（技术方案报告模板、会议纪要模板、
 * 换届交接清单、三组入门教程）没有内容也没有维护人，已从种子移除，见 RETIRED_SEED_IDS。
 * 新资料请用 MCP publish_doc 发布，或补进这里并递增 DOCS_SEED_VERSION。
 */
const SEED_DOCS: ReadonlyArray<Omit<DocEntry, "updatedAt">> = [
  {
    id: "nec-brand-center",
    title: "NEC 品牌主视觉中心",
    description: "Logo / PPT 模板 / VI 规范一站式下载与规范说明",
    category: "brand",
    url: "/brand/",
    visibility: "all",
    maintainer: "NEC AI 中台",
    source: "hub",
  },
  {
    id: "nec-vi-manual",
    title: "NEC VI 规范手册 V1.1",
    description: "标准色值、语义色、字体系统、最小尺寸、禁用示例完整规范",
    category: "brand",
    url: "/brand/NEC-VI-Manual_V1.1.md",
    visibility: "all",
    maintainer: "NEC AI 中台",
    source: "hub",
  },
  {
    id: "nec-ppt-template",
    title: "NEC PPT 标准模板",
    description: "7 种版式（封面/目录/章节/内容/图文/表格/结尾），思源黑体统一",
    category: "template",
    url: "/brand/NEC-PPT-Template_V1.0.pptx",
    visibility: "all",
    maintainer: "NEC AI 中台",
    source: "hub",
  },
  {
    id: "reimburse-sop",
    title: "财务报销流程",
    description: "线上报销助手 + 材料清单 + 审批节点说明",
    category: "sop",
    // 旧值 /#tab-dashboard 会被 hash 兼容层落到「数据看板」，与报销流程语义错位；直达报销 Tab
    url: "/#/reimburse",
    visibility: "all",
    maintainer: "NEC AI 中台",
    source: "hub",
  },
  {
    id: "bitable-spec-group-leaders",
    title: "多维表数据规范（组长维护手册）",
    description: "任务表/赛季目标表字段规范：列名识别、字段类型硬要求、状态词口径、接入授权与自检清单",
    category: "sop",
    url: "/docs/多维表数据规范_组长维护手册.md",
    visibility: "all",
    maintainer: "NEC AI 中台",
    source: "hub",
  },
  {
    id: "dashboard-config-manual",
    title: "数据看板配置手册",
    description: "飞书多维表格接入：权限开通、应用协作者、app_token/table_id 获取、config_dashboard 配置与验证",
    category: "sop",
    url: "/docs/数据看板配置手册.md",
    visibility: "all",
    maintainer: "NEC AI 中台",
    source: "hub",
  },
  {
    id: "warehouse-sop",
    title: "仓库领用规范",
    description: "物资领用/归还/盘点操作流程，配合 NEC 仓库作业台使用",
    category: "sop",
    url: "https://mes.newenergycoder.club/home.html",
    visibility: "all",
    maintainer: "NEC AI 中台",
    source: "hub",
  },
];

/**
 * 已从种子下线的条目：迁移时删除。只列**种子自带**的 id，不动成员通过 publish_doc 发布的资料。
 * v2 下线的 6 条均为空 url 的「即将上线」占位。
 */
export const RETIRED_SEED_IDS = [
  "tech-report-template",
  "meeting-minutes-template",
  "handover-checklist",
  "mech-onboarding",
  "elec-onboarding",
  "vision-onboarding",
] as const;

function seedEntries(now: string): DocEntry[] {
  return SEED_DOCS.map((d) => ({ ...d, updatedAt: now }));
}

/**
 * 把线上 KV 迁移到当前种子版本：
 * - 删除 RETIRED_SEED_IDS 中的条目；
 * - 按 id 就地更新/新增 SEED_DOCS（链接、标题、描述、维护人以代码为准）；
 * - 成员自行发布的其它资料原样保留；
 * - 历史 example.feishu.cn 占位链接置空。
 */
export function migrateSeedDocs(docs: DocEntry[], now = new Date().toISOString()): DocEntry[] {
  const retired = new Set<string>(RETIRED_SEED_IDS);
  const kept = docs
    .filter((d) => !retired.has(d.id))
    .map((d) => (d.url.includes("example.feishu.cn") ? { ...d, url: "" } : d));

  for (const seed of seedEntries(now)) {
    const i = kept.findIndex((d) => d.id === seed.id);
    if (i >= 0) kept[i] = { ...seed, updatedAt: now };
    else kept.push(seed);
  }
  return kept;
}

export async function buildDocs(env: Env, request: Request, ctx?: ExecutionContext): Promise<unknown> {
  let docs = await readIndex<DocEntry>(env, DOCS_REGISTRY_KEY);
  const storedVersion = await env.REGISTRY.get(KV_KEYS.docsSeedVersion);

  if (docs.length === 0) {
    docs = seedEntries(new Date().toISOString());
    await env.REGISTRY.put(DOCS_REGISTRY_KEY, JSON.stringify(docs));
    await env.REGISTRY.put(KV_KEYS.docsSeedVersion, String(DOCS_SEED_VERSION));
  } else if (storedVersion !== String(DOCS_SEED_VERSION)) {
    // 种子升级：修复死链 / 删除空占位 / 补新增资料（一次性，版本号对齐后不再执行）
    docs = migrateSeedDocs(docs);
    await env.REGISTRY.put(DOCS_REGISTRY_KEY, JSON.stringify(docs));
    await env.REGISTRY.put(KV_KEYS.docsSeedVersion, String(DOCS_SEED_VERSION));
  } else {
    // 版本已对齐：只兜底清理历史 example.feishu.cn 占位，不重写种子
    const cleaned = docs.map((d) => (d.url.includes("example.feishu.cn") ? { ...d, url: "" } : d));
    if (cleaned.some((d, i) => d.url !== docs[i].url)) {
      docs = cleaned;
      await env.REGISTRY.put(DOCS_REGISTRY_KEY, JSON.stringify(docs));
    }
  }

  const session = await resolveSession(env, request, ctx);
  if (!session) {
    return docs.filter((d) => d.visibility === "all");
  }
  return docs;
}