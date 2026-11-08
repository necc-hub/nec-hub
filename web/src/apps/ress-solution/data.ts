export type BomGroup = '核心设备' | '可选配置' | '软件与模式'

export interface BomItem {
  group: BomGroup
  name: string
  model: string
  quantity: string
  spec: string
}

export interface Scenario {
  id: string
  nav: string
  eyebrow: string
  title: string
  subtitle: string
  packageName: string
  packageEn: string
  description: string
  videoStart: number
  metrics: { value: string; label: string }[]
  values: { title: string; text: string }[]
  bom: BomItem[]
  prompt: string
}

export const scenarios: Scenario[] = [
  {
    id: 'self',
    nav: '光伏自洽',
    eyebrow: 'SCENE 01 · SELF-POWERED',
    title: '让阳光，先抵达家庭。',
    subtitle: '光伏优先供家庭负载，余电存入 vBox，降低电网依赖。',
    packageName: '城市光伏自洽包',
    packageEn: 'URBAN SOLAR AUTONOMY',
    description: '面向已安装或计划安装屋顶光伏的城市家庭，以单相 Vesta 为能源中枢，兼顾日常消纳、备电与电动车充电扩展。',
    videoStart: 0,
    metrics: [
      { value: '6.0 kW', label: '单相逆变功率段' },
      { value: '13.8 kWh', label: 'vBox 额定电量' },
      { value: '3 MPPT', label: '光伏最大功率跟踪' },
    ],
    values: [
      { title: '光伏优先', text: '太阳能先供家庭，多余能量进入电池。' },
      { title: '模块扩展', text: 'vBox 以 3.46 kWh 模块灵活配置容量。' },
      { title: '统一交互', text: 'Home App 同屏查看能源流与充电状态。' },
    ],
    bom: [
      { group: '核心设备', name: '单相四合一混合逆变器', model: 'Vesta-6.0-S', quantity: '1 台', spec: '6 kW 功率段 · 3 MPPT · IP65' },
      { group: '核心设备', name: '模块化储能电池', model: 'vBox-14', quantity: '1 组', spec: '4 个电池模块 · 13.8 kWh · LFP' },
      { group: '核心设备', name: '微网互联装置', model: 'MID-63S', quantity: '1 台', spec: '单相 63 A · 20 ms 切换 · IP65' },
      { group: '可选配置', name: '屋顶光伏阵列', model: '按屋顶深化设计', quantity: '1 项', spec: '容量、组件与支架不在原 PDF 范围内' },
      { group: '可选配置', name: '交流充电器', model: 'AC Charger', quantity: '1 台', spec: '接入 Vesta Charger Port · 规格按选型' },
      { group: '软件与模式', name: '家庭能源管理', model: 'StarCharge Home App', quantity: '1 套', spec: 'Self-Powered · 能源统计 · 在线/离线' },
    ],
    prompt: '高端住宅能源产品短片，清晨阳光掠过现代住宅屋顶光伏，金色能量流先进入家庭，再流入 vBox 储能，Vesta 逆变器作为视觉中枢，最后出现电动车可扩展充电。深墨绿与暖金配色，真实建筑摄影质感，缓慢推镜，无人物口播，16:9，8 秒，中英文字幕留白，不出现未经证实的数据。',
  },
  {
    id: 'tou',
    nav: '峰谷优化',
    eyebrow: 'SCENE 02 · TIME-OF-USE',
    title: '把用电，安排在更好的时间。',
    subtitle: '低谷充电，高峰使用储能，让电价差成为可见的日常收益。',
    packageName: '峰谷智慧优化包',
    packageEn: 'TIME-OF-USE INTELLIGENCE',
    description: '面向执行峰谷电价的三相家庭用户，通过预约策略与 Home App 统计，把充放电时间、SOC 目标和费用口径统一呈现。',
    videoStart: 4,
    metrics: [
      { value: '12 kW', label: '三相逆变功率段' },
      { value: '20.7 kWh', label: 'vBox 额定电量' },
      { value: '24 h', label: '策略与统计周期' },
    ],
    values: [
      { title: '低谷充电', text: '按站点电价和时区执行充放电计划。' },
      { title: '高峰放电', text: '高电价时段优先使用已存储能量。' },
      { title: '收益可解释', text: '费用关联电价与币种，明确估算口径。' },
    ],
    bom: [
      { group: '核心设备', name: '三相四合一混合逆变器', model: 'Vesta-12-T', quantity: '1 台', spec: '12 kW 功率段 · 2 MPPT · IP65' },
      { group: '核心设备', name: '模块化储能电池', model: 'vBox-20', quantity: '1 组', spec: '6 个电池模块 · 20.7 kWh · 90% DOD' },
      { group: '核心设备', name: '微网互联装置', model: 'MID-63T', quantity: '1 台', spec: '三相 63 A · 20 ms 切换 · IP65' },
      { group: '可选配置', name: '交流充电器', model: 'AC Charger', quantity: '1 台', spec: '预约充电 · 负载均衡 · 规格按选型' },
      { group: '可选配置', name: '站点电价配置', model: '项目实施服务', quantity: '1 项', spec: '电价表、时区与策略边界现场确认' },
      { group: '软件与模式', name: '家庭能源管理', model: 'StarCharge Home App', quantity: '1 套', spec: 'Time-of-Use · 周/月/年统计 · 费用趋势' },
    ],
    prompt: '高级家庭储能解决方案短片，以一天 24 小时为叙事，夜间低谷电价时电网为 vBox 充电，白天高峰时电池向家庭释放能量，Vesta 与 Home App 时间策略界面叠化出现。深绿电影感、暖金时间轴、微距产品材质、平滑转场，16:9，8 秒，不展示具体电价或收益承诺。',
  },
  {
    id: 'backup',
    nav: '无忧备电',
    eyebrow: 'SCENE 03 · BACKUP POWER',
    title: '电网停下，生活不必停下。',
    subtitle: '预留备用电量，MID 自动切换，为关键负载提供持续能源。',
    packageName: '全屋韧性备电包',
    packageEn: 'RESILIENT HOME BACKUP',
    description: '面向对供电连续性有高要求的住宅，以储备 SOC、MID 和关键负载策略构建停电场景下的清晰保障链路。',
    videoStart: 8,
    metrics: [
      { value: '20 ms', label: 'MID 规格切换时间' },
      { value: '63 A', label: 'MID 最大输出电流' },
      { value: 'IP65', label: 'Vesta 与 MID 防护' },
    ],
    values: [
      { title: '备用储备', text: '按家庭需求保留停电时使用的电池电量。' },
      { title: '自动切换', text: 'MID 在电网中断时切换至离网供电。' },
      { title: '状态可见', text: '离网状态、关键负载和事件时间线可追踪。' },
    ],
    bom: [
      { group: '核心设备', name: '三相四合一混合逆变器', model: 'Vesta-12-T', quantity: '1 台', spec: '最大电池充放电功率 12.42 kW' },
      { group: '核心设备', name: '模块化储能电池', model: 'vBox-20', quantity: '1 组', spec: '20.7 kWh · FCS · LFP · IP55' },
      { group: '核心设备', name: '微网互联装置', model: 'MID-63T', quantity: '1 台', spec: '20 ms 切换 · 离网输出受 Vesta 限制' },
      { group: '可选配置', name: '关键负载配电改造', model: '项目实施服务', quantity: '1 项', spec: '负载清单与配电方案现场深化' },
      { group: '可选配置', name: '屋顶光伏阵列', model: '按屋顶深化设计', quantity: '1 项', spec: '停电备用能量来源 · 容量按设计' },
      { group: '软件与模式', name: '家庭能源管理', model: 'StarCharge Home App', quantity: '1 套', spec: 'Backup · 备用 SOC · 离网事件呈现' },
    ],
    prompt: '住宅备电产品电影，暴风雨夜城市电网突然变暗，镜头切入温暖明亮的现代住宅，MID 自动切换，vBox 通过 Vesta 持续为照明、冰箱和网络供电，随后显示 20 ms 规格字幕。高级深绿与暖白，真实产品质感，克制紧张感，16:9，8 秒，注明切换时间为 MID 规格而非 App 性能。',
  },
  {
    id: 'ev',
    nav: '绿色充电',
    eyebrow: 'SCENE 04 · GREEN CHARGING',
    title: '让每一次出发，都带着阳光。',
    subtitle: '协调光伏、储能和电网，为电动车提供绿色、可控的充电体验。',
    packageName: '墅宅光储充旗舰包',
    packageEn: 'SIGNATURE PV STORAGE CHARGE',
    description: '面向高端住宅与多能源负载场景，以三相 Vesta 四端口架构、双电池组和充电负载均衡形成完整光储充系统。',
    videoStart: 12,
    metrics: [
      { value: '14 kW', label: '三相逆变功率段' },
      { value: '约 40 kWh', label: '双电池组系统容量' },
      { value: '32 A', label: '所示三相充电端口上限' },
    ],
    values: [
      { title: '四端口协同', text: 'PV、电池、电网与充电端口统一管理。' },
      { title: '预约与均衡', text: '按计划启停，并在多个设备间分配电力。' },
      { title: '来源可追踪', text: '区分光伏、储能和电网的充电能量来源。' },
    ],
    bom: [
      { group: '核心设备', name: '三相四合一混合逆变器', model: 'Vesta-14-T', quantity: '1 台', spec: '14 kW 功率段 · Charger Port Max. 32 A' },
      { group: '核心设备', name: '模块化储能电池', model: 'vBox-20', quantity: '2 组', spec: '两组串联 · 系统约 40 kWh · LFP' },
      { group: '核心设备', name: '微网互联装置', model: 'MID-63T', quantity: '1 台', spec: '三相 63 A · 20 ms 切换 · RS485' },
      { group: '核心设备', name: '交流充电器', model: 'AC Charger', quantity: '1 台', spec: '光伏/储能/电网协同 · 充电启停' },
      { group: '可选配置', name: '屋顶光伏阵列', model: '按屋顶深化设计', quantity: '1 项', spec: '组件、容量与支架不在原 PDF 范围内' },
      { group: '软件与模式', name: '家庭能源管理', model: 'StarCharge Home App', quantity: '1 套', spec: 'EV Charging · Schedule · Load Balance' },
    ],
    prompt: '旗舰光储充住宅产品片，日落后的现代墅宅，屋顶光伏、双组 vBox、Vesta 和电动车依次被能量流连接，充电界面展示预约与负载均衡，结尾呈现光伏、电池、电网三种能量来源。深墨绿、香槟金、真实广告级产品渲染，缓慢环绕镜头，16:9，8 秒，不出现价格或未经确认的充电速度。',
  },
]
