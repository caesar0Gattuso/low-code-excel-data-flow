/** 一行数据：键值对 */
export type DataRow = Record<string, unknown>

/** 数据集：一张表 */
export interface DataTable {
  columns: string[]
  rows: DataRow[]
}

// ---------------------------------------------------------------------------
// 节点类型枚举
// ---------------------------------------------------------------------------
export enum NodeCategory {
  Input = 'input',
  /** 行列加工：对每行计算新列/改值（公式、条件赋值、阶梯规则、保底封顶） */
  Transformer = 'transformer',
  /** 结构整理：改变表的行/列结构（过滤、排序、去重、列操作） */
  Restructure = 'restructure',
  /** 聚合关联：跨行/跨表操作（Join、GroupBy） */
  Aggregator = 'aggregator',
  Output = 'output',
}

export enum OperatorType {
  ExcelInput = 'excelInput',
  ExcelOutput = 'excelOutput',
  TierRule = 'tierRule',
  TierRuleV2 = 'tierRuleV2',
  Formula = 'formula',
  FormulaV2 = 'formulaV2',
  Filter = 'filter',
  Constraint = 'constraint',
  ConditionalAssign = 'conditionalAssign',
  Join = 'join',
  GroupBy = 'groupBy',
  Sort = 'sort',
  Deduplicate = 'deduplicate',
  ColumnOps = 'columnOps',
}

// ---------------------------------------------------------------------------
// 各算子的配置类型
// ---------------------------------------------------------------------------

/** 阶梯档位，max 为 null 表示无上限 */
export interface TierBracket {
  min: number
  max: number | null
  value: number
}

export interface TierRuleConfig {
  inputColumn: string
  outputColumn: string
  brackets: TierBracket[]
}

export interface FormulaConfig {
  expression: string
  outputColumn: string
}

export interface FormulaV2Config {
  expression: string
  outputColumn: string
}

export interface FilterConfig {
  column: string
  operator: CompareOperator
  value: number | string
}

export interface ConstraintConfig {
  column: string
  min?: number
  max?: number
}

export interface JoinConfig {
  /** 左表关联键（支持多列联合匹配） */
  leftKeys: string[]
  /** 右表关联键（顺序与 leftKeys 对应） */
  rightKeys: string[]
  joinType: 'inner' | 'left' | 'right' | 'full'
  /** 同名列冲突处理策略 */
  conflictStrategy: 'left_wins' | 'right_wins' | 'rename_right' | 'rename_both'
}

export interface GroupByConfig {
  groupByColumns: string[]
  aggregations: {
    column: string
    func: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'countif'
    outputColumn: string
    operator?: CompareOperator
    compareValue?: number | string
  }[]
}

export type CompareOperator = '>' | '>=' | '<' | '<=' | '==' | '!='

/** 单个比较条件 */
export interface Condition {
  column: string
  operator: CompareOperator
  compareValue: number | string
}

/** 条件赋值的一条规则：多个条件 + 组合逻辑 */
export interface ConditionalRule {
  conditions: Condition[]
  /** 多个条件的组合方式 */
  logic: 'and' | 'or'
  result: number | string
  /** 条件不满足时的结果（可选，填写后该规则即为完整的 if/else） */
  elseResult?: number | string
}

export interface ConditionalAssignConfig {
  rules: ConditionalRule[]
  /** 所有条件都不满足时的默认值 */
  defaultValue: number | string
  outputColumn: string
}

/** 阶梯规则V2：匹配后输出规则表中所有列 */
export interface TierRuleV2Config {
  /** 原始表中用于匹配的列名 */
  inputColumn: string
  /** 规则表中的下限列名 */
  minColumn: string
  /** 规则表中的上限列名 */
  maxColumn: string
  /** 规则表数据（从 Excel 导入） */
  ruleTable: DataTable
}

export interface ExcelInputConfig {
  sheetName: string
  fileName?: string
  /** 用户选择参与后续流程的列；undefined / 空数组 = 全部列 */
  selectedColumns?: string[]
}

export interface ExcelOutputConfig {
  sheetName: string
  fileName: string
  /** 选择导出的列；undefined = 全部列 */
  selectedColumns?: string[]
  /** 按哪些列的组合值拆分导出；为空数组或 undefined 则不拆分 */
  splitByColumns?: string[]
  /** 拆分模式：多 Sheet 合并为单文件 或 每个值单独一个文件 */
  splitMode?: 'sheets' | 'files'
}

export interface SortConfig {
  /** 排序规则，按优先级顺序执行 */
  rules: { column: string; order: 'asc' | 'desc' }[]
}

export interface DeduplicateConfig {
  /** 用作唯一键的列名；空数组 = 全列去重 */
  keyColumns: string[]
  /** 相同 key 保留哪条：first = 第一条，last = 最后一条 */
  keep: 'first' | 'last'
}

export interface ColumnOpsConfig {
  /** 最终保留并输出的列，顺序即为输出列顺序 */
  columns: {
    source: string   // 原列名
    output: string   // 输出列名（可重命名；与 source 相同表示不改名）
  }[]
}

/** 所有算子配置的联合类型 */
export type OperatorConfig =
  | TierRuleConfig
  | TierRuleV2Config
  | FormulaConfig
  | FormulaV2Config
  | FilterConfig
  | ConstraintConfig
  | ConditionalAssignConfig
  | JoinConfig
  | GroupByConfig
  | ExcelInputConfig
  | ExcelOutputConfig
  | SortConfig
  | DeduplicateConfig
  | ColumnOpsConfig

// ---------------------------------------------------------------------------
// 流程图节点
// ---------------------------------------------------------------------------

export interface FlowNodeData {
  [key: string]: unknown
  /** 算子类型名称（只读，来自注册表） */
  label: string
  /** 用户自定义节点名称，在画布上优先展示 */
  customName?: string
  category: NodeCategory
  operatorType: OperatorType
  config: OperatorConfig
  /** 用户备注，显示在节点底部 */
  note?: string
  /** 运行时输出数据（非序列化） */
  outputPreview?: DataTable
}

// ---------------------------------------------------------------------------
// 算子注册表 — 描述每种节点的元信息
// ---------------------------------------------------------------------------

export interface OperatorMeta {
  type: OperatorType
  category: NodeCategory
  label: string
  description: string
  /** 输入 handle 数量（0 = 数据源） */
  inputs: number
  /** 输出 handle 数量 */
  outputs: number
  defaultConfig: OperatorConfig
}

// ---------------------------------------------------------------------------
// 模板导入导出
// ---------------------------------------------------------------------------

export interface TemplateData {
  version: string
  name: string
  createdAt: string
  nodes: SerializedNode[]
  edges: SerializedEdge[]
  /** 导入后默认进入的视图模式 */
  defaultMode?: 'design' | 'simple'
}

export interface SerializedNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: FlowNodeData
}

export interface SerializedEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

// ---------------------------------------------------------------------------
// 计算引擎消息协议 (主线程 <-> Worker)
// ---------------------------------------------------------------------------

export interface EngineRequest {
  type: 'execute'
  nodes: SerializedNode[]
  edges: SerializedEdge[]
  /** 每个 ExcelInput 节点 id -> 对应数据 */
  inputData: Record<string, DataTable>
}

export interface EngineResponse {
  type: 'result' | 'error' | 'progress'
  /** 每个输出节点 id -> 结果数据 */
  outputs?: Record<string, DataTable>
  /** 每个节点 id -> 输出预览数据（前 200 行） */
  previews?: Record<string, DataTable>
  /** 每个节点 id -> 输入预览数据（前 200 行） */
  inputPreviews?: Record<string, DataTable>
  /** 每条边流过的行数 */
  edgeRowCounts?: Record<string, number>
  /** 每个节点输出的真实总行数 */
  previewTotals?: Record<string, number>
  error?: string
  progress?: { nodeId: string; status: 'running' | 'done' | 'error'; errorMsg?: string }
}
