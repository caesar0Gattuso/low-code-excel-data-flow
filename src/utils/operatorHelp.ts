import { OperatorType } from '@/types'

export interface OperatorHelpEntry {
  inputDesc: string
  outputDesc: string
  configs: { name: string; desc: string }[]
  tips?: string[]
}

/**
 * 算子帮助元数据。
 * 新增算子时在这里添加对应条目，帮助页面会自动渲染。
 */
export const operatorHelpMap: Record<OperatorType, OperatorHelpEntry> = {
  [OperatorType.ExcelInput]: {
    inputDesc: '无（数据源头节点）',
    outputDesc: '一张表（指定 Sheet 解析后的全部行列）',
    configs: [
      { name: '上传 Excel 文件', desc: '支持 .xlsx / .xls / .csv 格式' },
      { name: '选择 Sheet', desc: '下拉单选，来自已加载文件的所有 Sheet' },
    ],
    tips: [
      '选中节点后，右侧面板会展示表头列名，点击可一键复制到其他节点配置中',
      '可以放置多个 Excel 输入节点，分别加载不同的文件或 Sheet',
    ],
  },

  [OperatorType.TierRule]: {
    inputDesc: '1 张表',
    outputDesc: '原表 + 新增 1 列（阶梯映射结果）',
    configs: [
      { name: '输入列', desc: '要判断的源数据列名' },
      { name: '输出列', desc: '新增的结果列名' },
      { name: '阶梯档位', desc: '每档包含 下限(min)、上限(max)、结果值(value)；上限留空表示无上限' },
    ],
    tips: [
      '匹配逻辑：从低到高遍历，val >= min 且 val < max 时命中',
      '支持从 Excel 批量导入档位，面板中提供模板下载',
      '导入后仍可在界面上逐行微调',
    ],
  },

  [OperatorType.TierRuleV2]: {
    inputDesc: '1 张表',
    outputDesc: '原表 + 匹配档位中除 min/max 外的所有列',
    configs: [
      { name: '匹配列', desc: '原始数据中用于阶梯匹配的列名（如"钻石数"）' },
      { name: '规则表 Excel', desc: '上传包含阶梯规则的 Excel 文件，需包含 min、max 列和若干输出列' },
      { name: 'min / max 列名', desc: '规则表中表示阶梯下限和上限的列名，可自定义映射' },
    ],
    tips: [
      '与 V1 的区别：V1 只输出一个值，V2 输出匹配行的所有列（如 value-X、A-min、value-Y 等）',
      '适用于阶梯查找后需要引用多个阈值做进一步判断的场景',
      '上限列留空表示无上限，匹配逻辑为 val >= min 且 val < max',
      '匹配后的列会追加到原始表中，可供后续条件赋值节点引用',
    ],
  },

  [OperatorType.Formula]: {
    inputDesc: '1 张表',
    outputDesc: '原表 + 新增 1 列（公式运算结果）',
    configs: [
      { name: '公式表达式', desc: '用 [列名] 引用列值，如 [金币] * 0.5 + [时长] * 2' },
      { name: '输出列名', desc: '新增的结果列名' },
    ],
    tips: [
      '支持 + - * / 和括号运算',
      '使用安全解析器，不使用 eval，无注入风险',
      '引用不存在的列名时，值会被当作 0',
    ],
  },

  [OperatorType.Filter]: {
    inputDesc: '1 张表',
    outputDesc: '行数减少（仅保留满足条件的行），列不变',
    configs: [
      { name: '列名', desc: '要判断的目标列' },
      { name: '运算符', desc: '> / >= / < / <= / == / !=' },
      { name: '比较值', desc: '数值或字符串，系统自动识别类型' },
    ],
    tips: [
      '这是唯一会减少行数的转换节点',
      '可用于实现惩罚机制：先过滤出违规数据，再接扣款公式',
    ],
  },

  [OperatorType.ConditionalAssign]: {
    inputDesc: '1 张表',
    outputDesc: '原表 + 新增 1 列（按条件赋值的结果）',
    configs: [
      { name: '条件规则列表', desc: '每条规则包含一组条件（支持多个条件用「并且/或者」组合）、满足时的结果值、以及可选的否则值' },
      { name: '条件组合', desc: '每条规则内的多个条件可选择「全部满足（并且）」或「任一满足（或者）」' },
      { name: '否则值', desc: '每条规则可单独设置否则值（不满足时的结果）；留空则继续匹配下一条规则' },
      { name: '兜底值', desc: '所有规则都未命中时使用的最终兜底值' },
      { name: '输出列名', desc: '新增的结果列名' },
    ],
    tips: [
      '规则按顺序匹配，命中第一条即停止（类似 if / else if / else）',
      '每条规则支持多个条件：如「金币 > 1000 并且 时长 > 30」',
      '每条规则可设置独立的否则值：如「如果 > 1 则 新主播 否则 旧主播」',
      '支持日期比较：比较值填 2025-01-01 格式即可',
      '支持列间比较：比较值填 [列名] 可引用同行其他列的值（如 A < [A-min]）',
      '与阶梯规则的区别：阶梯只处理数值区间映射，条件赋值支持任意列、任意比较运算、多条件组合',
    ],
  },

  [OperatorType.Constraint]: {
    inputDesc: '1 张表',
    outputDesc: '原表（目标列值被裁剪到上下限内）',
    configs: [
      { name: '目标列', desc: '要约束的列名' },
      { name: '保底值 (Min)', desc: '低于此值则设为此值，留空表示不设下限' },
      { name: '封顶值 (Max)', desc: '高于此值则设为此值，留空表示不设上限' },
    ],
    tips: [
      '典型场景：薪资保底 100 元、封顶 10000 元',
      '只填 Min 或只填 Max 均可，实现单侧约束',
    ],
  },

  [OperatorType.Join]: {
    inputDesc: '2 张表（左表 + 右表，节点顶部有两个输入接口）',
    outputDesc: '1 张合并后的表（列 = 两表列的并集）',
    configs: [
      { name: '左表关联键', desc: '左表中用于匹配的列名' },
      { name: '右表关联键', desc: '右表中用于匹配的列名' },
      { name: '关联类型', desc: '左连接（保留左表全部行）或 内连接（只保留匹配行）' },
    ],
    tips: [
      '典型用途：将用户工作表通过 user_id 关联组织关系表',
      '左表数据优先：如果两表有同名列，左表的值会覆盖右表',
      '可串联多个 Join 节点实现 用户 → A组织 → B组织 的多级关联',
    ],
  },

  [OperatorType.GroupBy]: {
    inputDesc: '1 张表',
    outputDesc: '行数大幅减少（每个分组 1 行），列 = 分组列 + 聚合结果列',
    configs: [
      { name: '分组列', desc: '分组依据的列名，多列用逗号分隔' },
      { name: '聚合规则', desc: '每条规则包含：源列名、聚合函数（sum/count/avg/min/max/countif）、输出列名' },
      { name: '条件计数 (countif)', desc: '统计分组内满足指定条件的行数。选择 countif 后需设置运算符和比较值，如：列=等级, ==, A → 统计等级为A的行数' },
    ],
    tips: [
      '典型用途：按 org_id 分组，对金币列求和 → 得到每个组织的金币总额',
      '可配置多条聚合规则，如同时求和与计数',
      'countif 示例：按工会ID分组，列=等级, countif, ==, A, 输出=A级主播数 → 统计每个工会中等级为A的主播数量',
      '聚合后只保留分组列和聚合结果列，原始明细列会消失',
    ],
  },

  [OperatorType.ExcelOutput]: {
    inputDesc: '1 张表',
    outputDesc: '无（终端节点，执行后通过下载获取结果）',
    configs: [
      { name: 'Sheet 名称', desc: '导出文件中的 Sheet 名' },
      { name: '文件名', desc: '下载的文件名，如 settlement_result.xlsx' },
    ],
    tips: [
      '可以放置多个输出节点，分别导出不同的计算结果',
      '点击工具栏「下载结果」按钮统一导出所有输出节点的数据',
    ],
  },
}
