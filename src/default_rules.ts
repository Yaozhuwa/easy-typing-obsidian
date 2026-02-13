import { SimpleRule } from './rule_engine';

// Priority bands:
//   10: Basic conversion rules (immediate, transactionFilter)
//   20: FW2HW symbol rules (immediate, transactionFilter)
//   25: Auto pair patch rules (immediate, transactionFilter)
//   30: Intrinsic delete rules
//   40: Selection replace rules
//   50: Quote/extra rules (regex, deferred via triggerCvtRule)
//   100+: User rules (default)

export const DEFAULT_BUILTIN_RULES: (SimpleRule & { id: string })[] = [
	// ===== Basic Conversion Rules =====
	// Original: BasicConvRuleStringList in main.ts:72-74
	{ id: 'builtin-conv-001', trigger: '··', replacement: '`$0`', priority: 10, description: '中文点转代码' },
	{ id: 'builtin-conv-002', trigger: '(^|\\n)！【【', trigger_right: '】', replacement: '[[1]]![[$0]]', options: 'r', priority: 10, description: '中文感叹号+双方括号转嵌入' },
	{ id: 'builtin-conv-003', trigger: '！【【', replacement: '![[$0]]', priority: 10, description: '中文感叹号+双方括号转嵌入(无右)' },
	{ id: 'builtin-conv-004', trigger: '【【', trigger_right: '】', replacement: '[[$0]]', priority: 10, description: '中文方括号转 wiki link' },
	{ id: 'builtin-conv-005', trigger: '【【', replacement: '[[$0]]', priority: 10, description: '中文方括号转 wiki link(无右)' },
	{ id: 'builtin-conv-006', trigger: '￥￥', replacement: '$$0$', priority: 10, description: '人民币符号转行内公式' },
	{ id: 'builtin-conv-007', trigger: '$￥', trigger_right: '$', replacement: '$$\n$0\n$$', priority: 10, description: '混合符号转公式块' },
	{ id: 'builtin-conv-008', trigger: '¥¥', replacement: '$$0$', priority: 10, description: '半角人民币转行内公式' },
	{ id: 'builtin-conv-009', trigger: '$¥', trigger_right: '$', replacement: '$$\n$0\n$$', priority: 10, description: '半角混合转公式块' },
	// $$|$ must come before $$| (more specific pattern first)
	{ id: 'builtin-conv-010', trigger: '$$', trigger_right: '$', replacement: '$$\n$0\n$$', priority: 10, description: '三美元转公式块' },
	{ id: 'builtin-conv-011', trigger: '$$', replacement: '$$0$', priority: 10, description: '双美元转行内公式' },
	{ id: 'builtin-conv-012', trigger: '(^|\\n)》', replacement: '[[1]]> $0', options: 'r', priority: 10, description: '中文书名号转引用' },
	{ id: 'builtin-conv-013', trigger: '(^|\\n)、', replacement: '[[1]]/$0', options: 'r', priority: 10, description: '中文顿号转斜杠' },

	// ===== FW2HW Symbol Rules =====
	// Original: FW2HWSymbolRulesStrList in main.ts:81-86
	{ id: 'builtin-fw2hw-001', trigger: '。。', replacement: '.$0', priority: 20, description: '全角句号转半角' },
	{ id: 'builtin-fw2hw-002', trigger: '！！', replacement: '!$0', priority: 20, description: '全角感叹号转半角' },
	{ id: 'builtin-fw2hw-003', trigger: '；；', replacement: ';$0', priority: 20, description: '全角分号转半角' },
	{ id: 'builtin-fw2hw-004', trigger: '，，', replacement: ',$0', priority: 20, description: '全角逗号转半角' },
	{ id: 'builtin-fw2hw-005', trigger: '：：', replacement: ':$0', priority: 20, description: '全角冒号转半角' },
	{ id: 'builtin-fw2hw-006', trigger: '？？', replacement: '?$0', priority: 20, description: '全角问号转半角' },
	{ id: 'builtin-fw2hw-007', trigger: '（（', trigger_right: '）', replacement: '($0)', priority: 20, description: '全角括号转半角' },
	{ id: 'builtin-fw2hw-008', trigger: '（（', replacement: '($0)', priority: 20, description: '全角括号转半角(无右)' },
	{ id: 'builtin-fw2hw-009', trigger: '\u201c\u201c', trigger_right: '\u201d', replacement: '"$0"', priority: 20, description: '中文左双引号转半角' },
	{ id: 'builtin-fw2hw-010', trigger: '\u201d\u201d', trigger_right: '\u201d', replacement: '"$0"', priority: 20, description: '中文右双引号转半角' },
	{ id: 'builtin-fw2hw-011', trigger: '\u2018\u2018', trigger_right: '\u2019', replacement: "'$0'", priority: 20, description: '中文左单引号转半角' },
	{ id: 'builtin-fw2hw-012', trigger: '\u2019\u2019', trigger_right: '\u2019', replacement: "'$0'", priority: 20, description: '中文右单引号转半角' },
	{ id: 'builtin-fw2hw-013', trigger: '》》', replacement: '>$0', priority: 20, description: '全角右书名号转半角' },
	{ id: 'builtin-fw2hw-014', trigger: '《《', trigger_right: '》', replacement: '<$0', priority: 20, description: '全角左书名号转半角' },
	{ id: 'builtin-fw2hw-015', trigger: '《《', replacement: '<$0', priority: 20, description: '全角左书名号转半角(无右)' },
	{ id: 'builtin-fw2hw-016', trigger: '｜｜', replacement: '|$0', priority: 20, description: '全角竖线转半角' },

	// ===== Auto Pair Patch Rules =====
	// Original: autoPairRulesPatchStrList in main.ts:91-95
	// Prevent duplicate closing symbols when auto-pairing
	{ id: 'builtin-pair-001', trigger: '【】', trigger_right: '】', replacement: '【】$0', priority: 25, description: '防止重复右方括号' },
	{ id: 'builtin-pair-002', trigger: '（）', trigger_right: '）', replacement: '（）$0', priority: 25, description: '防止重复右圆括号' },
	{ id: 'builtin-pair-003', trigger: '<>', trigger_right: '>', replacement: '<>$0', priority: 25, description: '防止重复右尖括号' },
	{ id: 'builtin-pair-004', trigger: '《》', trigger_right: '》', replacement: '《》$0', priority: 25, description: '防止重复右书名号' },
	{ id: 'builtin-pair-005', trigger: '「」', trigger_right: '」', replacement: '「」$0', priority: 25, description: '防止重复右单角括号' },
	{ id: 'builtin-pair-006', trigger: '『』', trigger_right: '』', replacement: '『』$0', priority: 25, description: '防止重复右双角括号' },
	{ id: 'builtin-pair-007', trigger: '()', trigger_right: ')', replacement: '()$0', priority: 25, description: '防止重复右圆括号(英)' },
	{ id: 'builtin-pair-008', trigger: '[]', trigger_right: ']', replacement: '[]$0', priority: 25, description: '防止重复右方括号(英)' },
	{ id: 'builtin-pair-009', trigger: '{}', trigger_right: '}', replacement: '{}$0', priority: 25, description: '防止重复右花括号' },
	{ id: 'builtin-pair-010', trigger: "''", trigger_right: "'", replacement: "''$0", priority: 25, description: '防止重复右单引号(英)' },
	{ id: 'builtin-pair-011', trigger: '""', trigger_right: '"', replacement: '""$0', priority: 25, description: '防止重复右双引号(英)' },

	// ===== Intrinsic Delete Rules =====
	// Original: DeleteRulesStrList in main.ts:88
	{ id: 'builtin-del-001', trigger: '$', trigger_right: '$', replacement: '', options: 'd', priority: 30, description: '删除行内公式对' },
	{ id: 'builtin-del-002', trigger: '==', trigger_right: '==', replacement: '', options: 'd', priority: 30, description: '删除高亮对' },
	{ id: 'builtin-del-003', trigger: '$$\n', trigger_right: '\n$$', replacement: '', options: 'd', priority: 30, description: '删除公式块对' },

	// ===== Selection Replace Rules =====
	// Original: selectionReplaceMapInitalData in main.ts:54-59
	{ id: 'builtin-sel-001', trigger: '【', replacement: '[${SELECTION}]', options: 's', priority: 40, description: '选中文字加方括号' },
	{ id: 'builtin-sel-002', trigger: '￥', replacement: '$${SELECTION}$', options: 's', priority: 40, description: '选中文字加公式' },
	{ id: 'builtin-sel-003', trigger: '·', replacement: '`${SELECTION}`', options: 's', priority: 40, description: '选中文字加代码' },
	{ id: 'builtin-sel-004', trigger: '¥', replacement: '$${SELECTION}$', options: 's', priority: 40, description: '选中文字加公式(半角)' },
	{ id: 'builtin-sel-005', trigger: '《', replacement: '《${SELECTION}》', options: 's', priority: 40, description: '选中文字加书名号' },
	{ id: 'builtin-sel-006', trigger: '\u201c', replacement: '\u201c${SELECTION}\u201d', options: 's', priority: 40, description: '选中文字加中文双引号(左)' },
	{ id: 'builtin-sel-007', trigger: '\u201d', replacement: '\u201c${SELECTION}\u201d', options: 's', priority: 40, description: '选中文字加中文双引号(右)' },
	{ id: 'builtin-sel-008', trigger: '（', replacement: '（${SELECTION}）', options: 's', priority: 40, description: '选中文字加中文圆括号' },
	{ id: 'builtin-sel-009', trigger: '<', replacement: '<${SELECTION}>', options: 's', priority: 40, description: '选中文字加尖括号' },
	{ id: 'builtin-sel-010', trigger: '"', replacement: '"${SELECTION}"', options: 's', priority: 40, description: '选中文字加英文双引号' },
	{ id: 'builtin-sel-011', trigger: "'", replacement: "'${SELECTION}'", options: 's', priority: 40, description: '选中文字加英文单引号' },
	{ id: 'builtin-sel-012', trigger: '「', replacement: '「${SELECTION}」', options: 's', priority: 40, description: '选中文字加单角括号' },
	{ id: 'builtin-sel-013', trigger: '『', replacement: '『${SELECTION}』', options: 's', priority: 40, description: '选中文字加双角括号' },

	// ===== Quote/Extra Rules (regex, deferred) =====
	// Original: ExtraBasicConvRuleStringList and QuoteSpaceRuleStringList in main.ts:75-76
	{ id: 'builtin-extra-001', trigger: '((?:^|\\n)\\s*>*) ?[>》]', replacement: '[[1]]> $0', options: 'r', priority: 50, description: '引用符号转换' },
	{ id: 'builtin-extra-002', trigger: '((?:^|\\n)\\s*>+)([^ >》]+)', replacement: '[[1]] [[2]]$0', options: 'r', priority: 50, description: '引用后加空格' },
];
