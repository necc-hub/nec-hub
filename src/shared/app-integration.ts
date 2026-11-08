export type IntegrationLevel = "P" | "I" | "B" | "D";
export type IntegrationStatus = "declared" | "partial" | "verified";
export type IntegrationEvidenceType = "test" | "document" | "production";

export interface IntegrationEvidence {
  type: IntegrationEvidenceType;
  ref: string;
  date: string;
  summary?: string;
}

export interface AppIntegration {
  level: IntegrationLevel;
  owner: string;
  dataSource: string;
  businessId?: string;
  apis: string[];
  cacheTtl: string;
  status: IntegrationStatus;
  evidence: IntegrationEvidence[];
  notes?: string;
  deprecated?: boolean;
}

export const APP_INTEGRATION_INPUT_SCHEMA = {
  type: "object",
  properties: {
    level: { type: "string", enum: ["P", "I", "B", "D"] },
    owner: { type: "string" },
    dataSource: { type: "string" },
    businessId: { type: "string" },
    apis: { type: "array", items: { type: "string" } },
    cacheTtl: { type: "string" },
    status: { type: "string", enum: ["declared", "partial", "verified"] },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["test", "document", "production"] },
          ref: { type: "string" },
          date: { type: "string" },
          summary: { type: "string" },
        },
        required: ["type", "ref", "date"],
      },
    },
    notes: { type: "string" },
    deprecated: { type: "boolean" },
  },
  required: ["level", "owner", "dataSource", "apis", "cacheTtl", "status", "evidence"],
} as const;

const LEVELS = new Set(["P", "I", "B", "D"]);
const STATUSES = new Set(["declared", "partial", "verified"]);
const EVIDENCE_TYPES = new Set(["test", "document", "production"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const filled = (value: unknown): value is string => typeof value === "string" && !!value.trim();

export function validateAppIntegration(value: unknown, appName = "unknown"): AppIntegration {
  const errors: string[] = [];
  if (!record(value)) throw new Error(`应用 ${appName} 缺少合法 integration 对象`);
  if (!LEVELS.has(String(value.level))) errors.push("level 必须是 P/I/B/D");
  for (const key of ["owner", "dataSource", "cacheTtl"] as const) {
    if (!filled(value[key])) errors.push(`${key} 不能为空`);
  }
  if (!STATUSES.has(String(value.status))) errors.push("status 必须是 declared/partial/verified");
  if (["I", "B", "D"].includes(String(value.level)) && !filled(value.businessId)) errors.push("I/B/D 必须提供 businessId");
  if (!Array.isArray(value.apis) || value.apis.some((item) => !filled(item))) errors.push("apis 必须是非空字符串数组");
  const apis = Array.isArray(value.apis) ? value.apis : [];
  if (value.level === "B" && value.status !== "declared" && apis.length === 0) errors.push("B/partial/verified 至少需要一个 apis 项");
  if (value.level === "B" && value.status === "declared" && apis.length === 0 && !filled(value.notes)) {
    errors.push("B/declared 空 apis 时必须在 notes 说明未接入原因");
  }
  if (!Array.isArray(value.evidence)) errors.push("evidence 必须是数组");
  const evidence = Array.isArray(value.evidence) ? value.evidence : [];
  evidence.forEach((item, index) => {
    if (!record(item)) {
      errors.push(`evidence[${index}] 必须是对象`);
      return;
    }
    if (!EVIDENCE_TYPES.has(String(item.type))) errors.push(`evidence[${index}].type 不合法`);
    if (!filled(item.ref)) errors.push(`evidence[${index}].ref 不能为空`);
    if (!filled(item.date) || !DATE_RE.test(item.date) || Number.isNaN(Date.parse(`${item.date}T00:00:00Z`))) {
      errors.push(`evidence[${index}].date 必须是 YYYY-MM-DD`);
    }
    if (item.type === "production" && !filled(item.summary)) errors.push(`evidence[${index}].summary 生产证据必填`);
  });
  if (value.status === "partial" && !evidence.some((item) => record(item) && ["test", "production"].includes(String(item.type)))) {
    errors.push("partial 至少需要 test 或 production 证据");
  }
  if (value.status === "verified" && !evidence.some((item) => record(item) && item.type === "production" && filled(item.summary))) {
    errors.push("verified 至少需要带 summary 的 production 证据");
  }
  if (errors.length) throw new Error(`应用 ${appName} 集成声明不合法：${errors.join("；")}`);
  return value as unknown as AppIntegration;
}

const LEVEL_LABEL = { P: "公开/只读", I: "身份", B: "业务", D: "设备" } as const;
const STATUS_LABEL = { declared: "待验收", partial: "部分验证", verified: "生产已验收" } as const;

export function integrationBadgeModel(integration?: AppIntegration | null) {
  if (!integration) return { levelLabel: "", statusLabel: "未声明", tone: "muted" as const };
  if (integration.deprecated) {
    return { levelLabel: `${integration.level} ${LEVEL_LABEL[integration.level]}`, statusLabel: "已废弃", tone: "danger" as const };
  }
  return {
    levelLabel: `${integration.level} ${LEVEL_LABEL[integration.level]}`,
    statusLabel: STATUS_LABEL[integration.status],
    tone: integration.status === "verified" ? "success" as const : integration.status === "partial" ? "info" as const : "warn" as const,
  };
}
