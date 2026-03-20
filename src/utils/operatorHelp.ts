import { OperatorType } from '@/types'

export interface OperatorHelpEntry {
  inputDesc: string
  outputDesc: string
  configs: { name: string; desc: string }[]
  tips?: string[]
  /** 支持的函数列表（仅 FormulaV2 等算子使用） */
  functions?: {
    name: string       // 函数名
    signature: string  // 调用签名，如 IF(条件, 真值, 假值)
    desc: string       // 功能说明
    example: string    // 示例
  }[]
}

/**
 * 算子帮助元数据。
 * 新增算子时在这里添加对应条目，帮助页面会自动渲染。
 */
export const operatorHelpMap: Record<OperatorType, OperatorHelpEntry> = {
  [OperatorType.ExcelInput]: {
    inputDesc: '无（数据源头节点）',
    outputDesc: '一张表（指定 Sheet 解析后的全部行列，或勾选的部分列）',
    configs: [
      { name: '上传 Excel 文件', desc: '支持 .xlsx / .xls / .csv 格式' },
      { name: '选择 Sheet', desc: '下拉单选，来自已加载文件的所有 Sheet' },
      { name: '选择列', desc: '勾选需要参与后续流程的列；默认全部选中，取消勾选的列不会进入下游' },
    ],
    tips: [
      '选中节点后，右侧面板会展示表头列名，点击可一键复制到其他节点配置中',
      '可以放置多个 Excel 输入节点，分别加载不同的文件或 Sheet',
      '「取消全选」可快速清空，再逐列勾选所需列，方便对比数据',
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

  [OperatorType.FormulaV2]: {
    inputDesc: '1 张表',
    outputDesc: '原表 + 新增 1 列（表达式结果，支持字符串/布尔值）',
    configs: [
      { name: '公式表达式', desc: '用 [列名] 引用列值；支持函数调用和比较/逻辑运算' },
      { name: '输出列名', desc: '新增的结果列名' },
    ],
    tips: [
      '列名用方括号包裹：[列名]，列名含空格也支持',
      '字符串字面量用引号包裹："文本" 或 \'文本\'',
      'IF 可以嵌套：IF(条件A, IF(条件B, 值1, 值2), 值3)',
      '运算符优先级：! > * / > + - > 比较 > && > ||',
      '引用不存在的列时返回 null，可用 ISNULL([列名], 默认值) 兜底',
    ],
    functions: [
      // ── 条件 ──────────────────────────────────────────────
      {
        name: 'IF',
        signature: 'IF(条件, 真值, 假值)',
        desc: '条件为真时返回第二个参数，否则返回第三个参数',
        example: 'IF([绩效] >= 0.9, [工资] * 0.2, [工资] * 0.1)',
      },
      {
        name: 'ISNULL / IFNULL',
        signature: 'ISNULL(值, 默认值)',
        desc: '当值为 null / 空字符串时返回默认值，否则返回原值',
        example: 'ISNULL([奖金], 0)',
      },
      // ── 数学 ──────────────────────────────────────────────
      {
        name: 'ROUND',
        signature: 'ROUND(数值, 小数位数)',
        desc: '四舍五入到指定小数位',
        example: 'ROUND([金额] * 0.15, 2)',
      },
      {
        name: 'ABS',
        signature: 'ABS(数值)',
        desc: '返回绝对值',
        example: 'ABS([差值])',
      },
      {
        name: 'MAX',
        signature: 'MAX(值1, 值2, ...)',
        desc: '返回多个值中的最大值',
        example: 'MAX([实际销售], [保底金额])',
      },
      {
        name: 'MIN',
        signature: 'MIN(值1, 值2, ...)',
        desc: '返回多个值中的最小值',
        example: 'MIN([工资], 50000)',
      },
      {
        name: 'FLOOR',
        signature: 'FLOOR(数值)',
        desc: '向下取整',
        example: 'FLOOR([天数] / 7)',
      },
      {
        name: 'CEIL',
        signature: 'CEIL(数值)',
        desc: '向上取整',
        example: 'CEIL([工时] / 8)',
      },
      // ── 字符串 ────────────────────────────────────────────
      {
        name: 'CONCAT',
        signature: 'CONCAT(值1, 值2, ...)',
        desc: '拼接多个值为字符串',
        example: 'CONCAT([姓名], "-", [部门])',
      },
      {
        name: 'UPPER',
        signature: 'UPPER(文本)',
        desc: '转为大写',
        example: 'UPPER([编号])',
      },
      {
        name: 'LOWER',
        signature: 'LOWER(文本)',
        desc: '转为小写',
        example: 'LOWER([邮箱])',
      },
      {
        name: 'TRIM',
        signature: 'TRIM(文本)',
        desc: '去除首尾空格',
        example: 'TRIM([姓名])',
      },
      {
        name: 'LEN',
        signature: 'LEN(文本)',
        desc: '返回字符串长度',
        example: 'LEN([备注])',
      },
      {
        name: 'SUBSTR / SUBSTRING',
        signature: 'SUBSTR(文本, 起始位置, 结束位置?)',
        desc: '截取子字符串，位置从 0 开始，结束位置可省略（取到末尾）',
        example: 'SUBSTR([编号], 0, 4)',
      },
      {
        name: 'REPLACE',
        signature: 'REPLACE(文本, 查找内容, 替换内容)',
        desc: '替换字符串中所有匹配的子串',
        example: 'REPLACE([备注], "无", "")',
      },
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
      '属于结构整理类：直接减少数据行数，列不变',
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
    inputDesc: '2 张表（左表 + 右表，节点顶部有两个输入接口：左侧 30% 为左表，右侧 70% 为右表）',
    outputDesc: '1 张合并后的表（列数 = 两表列的并集，具体取决于冲突列策略）',
    configs: [
      { name: '关联类型', desc: '内连接：仅保留两边都匹配的行；左连接：保留左表全部行，右表无匹配填空；右连接：保留右表全部行，左表无匹配填空；全连接：两边都全量保留' },
      { name: '关联键', desc: '选择左表和右表中用于匹配的列；先执行一次流程后可从下拉列表选择列名' },
      { name: '联合键', desc: '可添加多组左右键对，实现多列联合匹配（如同时用「工会ID」+「月份」来关联）' },
      { name: '同名列冲突策略', desc: '左表优先：同名列取左值；右表优先：取右值；右表重命名：冲突列加 _right 后缀；两边重命名：冲突列各加 _left / _right 后缀' },
    ],
    tips: [
      '典型用途：将用户明细表通过 user_id 关联组织关系表，或用「平台+主播ID」联合关联维表',
      '多列联合 key：点击「+ 添加联合键」可增加多组关联条件，所有条件同时满足才算匹配',
      '执行一次流程后，左右表的列名会填入下拉列表，无需手动输入',
      '可串联多个 Join 节点实现 用户 → A组织 → B组织 的多级关联',
      '右/全连接：左表无匹配的行，左侧列值为空，右侧列值正常输出',
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

  [OperatorType.Sort]: {
    inputDesc: '1 张表',
    outputDesc: '行数不变，按规则重新排序',
    configs: [
      { name: '排序规则', desc: '按优先级顺序配置多列排序；每列可选择升序（↑）或降序（↓）' },
    ],
    tips: [
      '多列排序：优先按第一列排序，第一列相同时再按第二列，以此类推',
      '支持中文字符串排序（使用 zh-CN locale 数字感知排序）',
      '执行一次流程后，列名可从下拉选择，无需手动输入',
    ],
  },

  [OperatorType.Deduplicate]: {
    inputDesc: '1 张表',
    outputDesc: '行数减少（每组唯一键保留一条），列不变',
    configs: [
      { name: '唯一键列', desc: '勾选用于判断重复的列；留空则全列参与去重（所有列完全相同才算重复）' },
      { name: '保留哪条', desc: '保留第一条：保留该 key 首次出现的行；保留最后一条：保留最后出现的行' },
    ],
    tips: [
      '典型场景：同一主播有多条记录，按 user_id 去重保留最新一条（配合排序先按时间降序，再去重保留第一条）',
      '联合键去重：同时勾选多列，多列值完全相同才算重复，如「工会ID + 月份」',
    ],
  },

  [OperatorType.ColumnOps]: {
    inputDesc: '1 张表',
    outputDesc: '列数可能减少或改名，行数不变',
    configs: [
      { name: '选择输出列', desc: '勾选需要保留的列，未勾选的列不会出现在输出中' },
      { name: '重命名', desc: '每列右侧的输入框可修改输出列名；留空保持原名' },
      { name: '调整顺序', desc: '点击 ▲▼ 按钮调整列的输出顺序' },
    ],
    tips: [
      '点击「全选」快速初始化所有列，再取消不需要的',
      '列重命名不会影响上游数据，只改变输出列名',
      '典型用途：去掉中间计算产生的临时列，只保留最终需要的列，并统一命名为业务字段名',
    ],
  },

  [OperatorType.ExcelOutput]: {
    inputDesc: '1 张表',
    outputDesc: '无（终端节点，执行后通过下载获取结果）',
    configs: [
      { name: 'Sheet 名称', desc: '导出文件中的 Sheet 名' },
      { name: '文件名', desc: '下载的文件名，默认 final_result.xlsx' },
      { name: '选择导出列', desc: '勾选需要输出的列；默认全部输出，取消勾选的列不会写入 Excel' },
      { name: '按列拆分（Sheet 模式）', desc: '勾选一个或多个导出列后，按这些列的值组合拆分为多个 Sheet，Sheet 名格式为「值1_值2」' },
      { name: '按列拆分（文件模式）', desc: '按列拆分时选择「每个值单独一个文件」，打包成 ZIP 下载，ZIP 包名与文件名相同，内部每个文件以拆分 key 命名' },
    ],
    tips: [
      '可以放置多个输出节点，分别导出不同阶段的计算结果',
      '节点右侧有「下载此节点结果」按钮，也可通过工具栏统一下载',
      '工具栏「合并下载」：所有输出节点合并到一个 Excel 的多个 Sheet；「全部单独下载」：每个节点各自导出一个文件',
      '按列拆分的可选项来自「选择导出列」中已勾选的列，未勾选的列不可用于拆分',
      '多列拆分 key 格式：如按「工会ID」+「月份」拆分，Sheet 名为「G001_2025-01」',
    ],
  },
}
