import { OperatorMeta, OperatorType, NodeCategory } from '@/types'

export const operatorRegistry: OperatorMeta[] = [
  {
    type: OperatorType.ExcelInput,
    category: NodeCategory.Input,
    label: 'Excel 输入',
    description: '导入 Excel 文件中的一个 Sheet',
    inputs: 0,
    outputs: 1,
    defaultConfig: { sheetName: 'Sheet1' },
  },
  {
    type: OperatorType.TierRule,
    category: NodeCategory.Transformer,
    label: '阶梯规则',
    description: '按阶梯档位映射数值',
    inputs: 1,
    outputs: 1,
    defaultConfig: {
      inputColumn: '',
      outputColumn: 'tier_result',
      brackets: [{ min: 0, max: 1000, value: 10 }],
    },
  },
  {
    type: OperatorType.TierRuleV2,
    category: NodeCategory.Transformer,
    label: '阶梯规则V2',
    description: '阶梯匹配后输出规则表所有列',
    inputs: 1,
    outputs: 1,
    defaultConfig: {
      inputColumn: '',
      minColumn: 'min',
      maxColumn: 'max',
      ruleTable: { columns: [], rows: [] },
    },
  },
  {
    type: OperatorType.Formula,
    category: NodeCategory.Transformer,
    label: '公式计算',
    description: '对列进行数学运算',
    inputs: 1,
    outputs: 1,
    defaultConfig: { expression: '', outputColumn: 'formula_result' },
  },
  {
    type: OperatorType.Filter,
    category: NodeCategory.Transformer,
    label: '条件过滤',
    description: '根据条件筛选或标记数据行',
    inputs: 1,
    outputs: 1,
    defaultConfig: { column: '', operator: '>=', value: 0 },
  },
  {
    type: OperatorType.Constraint,
    category: NodeCategory.Transformer,
    label: '保底/封顶',
    description: '对列值应用上下限约束',
    inputs: 1,
    outputs: 1,
    defaultConfig: { column: '', min: undefined, max: undefined },
  },
  {
    type: OperatorType.ConditionalAssign,
    category: NodeCategory.Transformer,
    label: '条件赋值',
    description: '按条件规则赋予不同值',
    inputs: 1,
    outputs: 1,
    defaultConfig: {
      rules: [{
        conditions: [{ column: '', operator: '>=' as const, compareValue: '' }],
        logic: 'and' as const,
        result: '',
      }],
      defaultValue: '',
      outputColumn: 'condition_result',
    },
  },
  {
    type: OperatorType.Join,
    category: NodeCategory.Aggregator,
    label: '数据关联',
    description: '按键关联两张表',
    inputs: 2,
    outputs: 1,
    defaultConfig: { leftKey: '', rightKey: '', joinType: 'left' as const },
  },
  {
    type: OperatorType.GroupBy,
    category: NodeCategory.Aggregator,
    label: '分组聚合',
    description: '按列分组后聚合统计',
    inputs: 1,
    outputs: 1,
    defaultConfig: {
      groupByColumns: [],
      aggregations: [{ column: '', func: 'sum' as const, outputColumn: 'total' }],
    },
  },
  {
    type: OperatorType.ExcelOutput,
    category: NodeCategory.Output,
    label: 'Excel 输出',
    description: '导出结果为 Excel 文件',
    inputs: 1,
    outputs: 0,
    defaultConfig: { sheetName: 'Result', fileName: 'final_result.xlsx' },
  },
]

export function getOperatorMeta(type: OperatorType): OperatorMeta | undefined {
  return operatorRegistry.find((o) => o.type === type)
}
