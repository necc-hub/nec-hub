export interface PrdNextItem {
  title: string
  detail: string
  evidence: string
}

export interface PrdNextGroup {
  key: 'P0' | 'P1' | 'P2'
  title: string
  summary: string
  items: PrdNextItem[]
}

export const PRD_ROADMAP: PrdNextGroup[] = [
  {
    key: 'P0',
    title: '真实业务验收',
    summary: '代码上线不等于业务闭环，以下需真实账号与单据证据。',
    items: [
      {
        title: '报销闭环',
        detail: 'FE-08 / FE-20：带附件提交、审批/支付、我的报销、台账与财务汇总核对同一单据。',
        evidence: '完成证据：单号、角色、日期、审批记录与台账截图',
      },
      {
        title: '评审闭环',
        detail: 'FE-14～16 / FE-20：图纸、硬件、合同各走一单提交、审批/会签、整改/纪要、结果回写；图纸补会议/ERP/MES 联调。',
        evidence: '完成证据：同一业务流程单号贯穿发起、待办与结果端',
      },
      {
        title: '身份与待办',
        detail: 'FE-01 / FE-09 / FE-17 / FE-18：真实队员账号复核任务绑定、角色可见范围、48h 视角、T-1 标红与目标回写。',
        evidence: '完成证据：队长与队员双账号对照记录',
      },
      {
        title: '工作台与权限',
        detail: 'FE-02 / FE-11：补齐剩余 5 名成员组别，由飞书超管启用定制工作台并开通审批所需 scope。',
        evidence: '完成证据：超管后台截图与全员入口实测',
      },
    ],
  },
  {
    key: 'P1',
    title: '功能完善',
    summary: '已有能力继续收口，按应用逐项补验收与安全边界。',
    items: [
      {
        title: 'FE-20 逐应用验收',
        detail: '补共享登录、深链、权限、同源数据与业务 ID 证据；单测和截图不能升级为生产已验收。',
        evidence: '完成证据：应用集成等级与 production 证据',
      },
      {
        title: 'FE-19 域名服务收尾',
        detail: '完成真实申请/释放；评估 KV 索引并发、到期回收与 DNS 对账。',
        evidence: '完成证据：DNS 记录增删与 dig 结果',
      },
      {
        title: '审批通知卡片灰度',
        detail: '按流程开启卡片、@ 人与失败回退；卡片内直接审批另立应用机器人方案。',
        evidence: '完成证据：灰度流程与回退日志',
      },
      {
        title: 'K1 安全只读接入',
        detail: '先做统一身份与鉴权中继，展示在线/离线/数据时间；不映射设备端口，不默认开放控制。',
        evidence: '完成证据：中继接口、过期状态与控制审计',
      },
      {
        title: '任务排期与 CLA 整改',
        detail: '评审 localStorage 迁移与 CLA 外部贡献者身份方案，分别作为独立变更实施。',
        evidence: '完成证据：数据迁移或身份方案评审记录',
      },
      {
        title: 'RESS 后续迭代',
        detail: '确认真实业务需求后再增加持久化、报价或审批闭环，并同步数据源与验收证据。',
        evidence: '完成证据：需求确认与后端数据源清单',
      },
    ],
  },
  {
    key: 'P2',
    title: '文档与运行治理',
    summary: '让页面、事实源与验收证据持续可追溯。',
    items: [
      {
        title: '专项 PRD 保鲜',
        detail: '新专项 PRD 同步静态目录并登记版本、日期与真实状态，链接检查随测试执行。',
        evidence: '完成证据：注册表与文件一致性测试通过',
      },
      {
        title: '维护白皮书试行',
        detail: '按 NEC 网站维护白皮书逐步补 Owner、复核日期、链接检查与发布/回滚记录。',
        evidence: '完成证据：抽查条目的 Owner 与复核日期',
      },
      {
        title: 'staging 与环境隔离',
        detail: '评审独立 KV/R2/D1 与测试域名，避免真实验收和公共预览共用生产数据。',
        evidence: '完成证据：隔离资源与测试域名可访问',
      },
      {
        title: '状态维护收口',
        detail: '需求状态继续由 update_prd 维护；路线图随代码版本发布，不自动推断验收状态。',
        evidence: '完成证据：版本历史与状态变更通知',
      },
    ],
  },
]