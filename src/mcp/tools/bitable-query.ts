import { validateUserToken } from "../../auth/feishu-auth";
import { canSeeFinanceDetail, resolveUserRole } from "../../auth/role";
import { DASH_TABLES, getDashboardConfig, type DashTable } from "../../dashboard";
import { getTenantAccessToken, listBitableRecords } from "../../feishu/bitable";
import type { McpToolDef } from "./shared";

export async function toolQueryBitable(args: Record<string, unknown>, env: Env, hasMcpToken: boolean) {
  const table = String(args.table ?? "") as DashTable;
  if (!DASH_TABLES.includes(table)) {
    throw new Error("table 必须是 members | tasks | inventory | finance | goals 之一");
  }
  // 非管理查询均需可确认的队员身份；finance 额外要求队长/财务。
  if (!hasMcpToken) {
    const userToken = String(args.user_token ?? "").trim();
    if (!userToken) {
      throw new Error("query_bitable 需要 user_token，或由管理端携带 MCP_TOKEN 调用");
    }
    const { openId, name } = await validateUserToken(userToken);
    const role = await resolveUserRole(env, { name, open_id: openId });
    if (!role.matched || role.role === "external") {
      throw new Error("权限不足：队员名单无法确认当前用户身份");
    }
    if (table === "finance" && !canSeeFinanceDetail(role)) {
      throw new Error(`权限不足：finance 表仅队长/财务角色可查（当前角色：${role.role}）`);
    }
  }
  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET) {
    return {
      content: [
        {
          type: "text",
          text: "⚠️ 飞书自建应用尚未配置（FEISHU_APP_ID / FEISHU_APP_SECRET）。请按 docs/飞书免登接入_MES.md 创建企业自建应用并 wrangler secret put 配置后重试。",
        },
      ],
    };
  }
  const cfg = await getDashboardConfig(env);
  const appToken = String(args.app_token ?? cfg?.base ?? "");
  const tableId = String(args.table_id ?? cfg?.tables?.[table] ?? "");
  if (!appToken || !tableId) {
    return {
      content: [
        {
          type: "text",
          text: `⚠️ 尚未配置 ${table} 表。两种方式任选：\n1. 调用 config_dashboard（action=set）写入 base 与 tables.${table}；\n2. 本次调用显式传 app_token + table_id。`,
        },
      ],
    };
  }
  const token = await getTenantAccessToken(env);
  const records = await listBitableRecords(token, appToken, tableId);
  const filter = String(args.filter ?? "").trim().toLowerCase();
  const matched = filter
    ? records.filter((r) => JSON.stringify(r.fields).toLowerCase().includes(filter))
    : records;
  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
  return {
    content: [
      {
        type: "text",
        text:
          `表 ${table} 共 ${matched.length} 条匹配记录（展示前 ${Math.min(limit, matched.length)} 条）：\n` +
          JSON.stringify(matched.slice(0, limit).map((r) => r.fields), null, 2),
      },
    ],
  };
}

export const queryBitableTool: McpToolDef = {
  name: "query_bitable",
  readOnly: true,
  description:
    "只读查询飞书多维表格（队员名单/任务进度/物资台账/财务报销/赛季目标）。非管理调用必须提供有效 user_token 且队员名单匹配；finance 表还需队长/财务角色。需先用 config_dashboard 配置 base 与 table_id，也可显式传 app_token/table_id。",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "表名：members | tasks | inventory | finance" },
      filter: { type: "string", description: "可选：对整条记录做不区分大小写的包含匹配" },
      limit: { type: "number", description: "返回条数上限，默认 20，最大 100" },
      app_token: { type: "string", description: "可选：覆盖配置，直接指定多维表格 app_token" },
      table_id: { type: "string", description: "可选：覆盖配置，直接指定 table_id（tbl 开头）" },
      user_token: { type: "string", description: "非管理查询必填：飞书 user_access_token；finance 表要求队长/财务角色" },
    },
    required: ["table"],
  },
  impl: (args, env, ctx) => toolQueryBitable(args, env, ctx.hasMcpToken),
};

export const tools: McpToolDef[] = [queryBitableTool];
