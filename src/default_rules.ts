import { SimpleRule } from './rule_engine';

// Priority bands:
//   5:  Auto pair rules (Chinese symbol pairing)
//   10: Basic conversion rules (immediate, transactionFilter)
//   20: FW2HW symbol rules (immediate, transactionFilter)
//   30: Intrinsic delete rules
//   40: Selection replace rules
//   50: Quote/extra rules (regex, deferred via triggerCvtRule)
//   100+: User rules (default)

export const DEFAULT_BUILTIN_RULES: (SimpleRule & { id: string })[] = [
	// ===== Auto Pair Rules =====
	// Chinese symbol auto-pairing via function rules
	{
		id: 'builtin-autopair-input',
		trigger: '[（《「『“‘]',
		replacement: "const p={'【':'【$0】','（':'（$0）','《':'《$0》','「':'「$0」','『':'『$0』','“':'“$0”','‘':'‘$0’'}; return p[leftMatches[0]];",
		options: 'rF',
		priority: 10,
		description: '中文符号自动配对',
	},
	{
		id: 'builtin-autopair-delete',
		trigger: '[\u3010\uFF08\u300A\u300C\u300E\u201c\u2018]',
		trigger_right: '[\u3011\uFF09\u300B\u300D\u300F\u201d\u2019]',
		replacement: "const p={'\u3010':'\u3011','\uFF08':'\uFF09','\u300A':'\u300B','\u300C':'\u300D','\u300E':'\u300F','\u201c':'\u201d','\u2018':'\u2019'}; return p[leftMatches[0]]===rightMatches[0] ? '' : undefined;",
		options: 'drF',
		priority: 10,
		description: '删除中文符号配对',
	},

	// ===== Basic Conversion Rules =====
	// Original: BasicConvRuleStringList in main.ts:72-74
	{ id: 'builtin-conv-001', trigger: '··', replacement: '`$0`', priority: 10, description: '中文点转代码' },
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
	// Doubled full-width symbol → half-width. If right counterpart exists and matches, consume it too.
	{
		id: 'builtin-fw2hw',
		trigger: '([。！；，：？》｜（《“”‘’])\\1',
		trigger_right: '[）》”’]?',
		replacement: "const p={'\uFF08':['\uFF09','($0)'],'\u300A':['\u300B','<$0'],'\u201c':['\u201d','\"$0\"'],'\u201d':['\u201d','\"$0\"'],'\u2018':['\u2019',\"'$0'\"],'\u2019':['\u2019',\"'$0'\"]}; const m={'\u3002':'.$0','\uFF01':'!$0','\uFF1B':';$0','\uFF0C':',$0','\uFF1A':':$0','\uFF1F':'?$0','\u300B':'>$0','\uFF5C':'|$0','\uFF08':'($0)','\u300A':'<$0','\u201c':'\"$0\"','\u201d':'\"$0\"','\u2018':\"'$0'\",'\u2019':\"'$0'\"}; const c=leftMatches[1],r=rightMatches[0]||'',e=p[c]; return e&&e[0]===r?e[1]:m[c];",
		options: 'rF',
		priority: 20,
		description: '连续全角符号转半角',
	},

	// ===== Intrinsic Delete Rules =====
	// Original: DeleteRulesStrList in main.ts:88
	{ id: 'builtin-del-001', trigger: '$', trigger_right: '$', replacement: '', options: 'd', priority: 30, description: '删除行内公式对' },
	{ id: 'builtin-del-002', trigger: '==', trigger_right: '==', replacement: '', options: 'd', priority: 30, description: '删除高亮对' },
	{ id: 'builtin-del-003', trigger: '$$\n', trigger_right: '\n$$', replacement: '', options: 'd', priority: 30, description: '删除公式块对' },

	// ===== Selection Replace Rules =====
	{
		id: 'builtin-sel',
		trigger: `[【¥“”]`,
		replacement: "const m={'¥': ['$', '$'], '【': ['[', ']'], '“': ['“','”'], '”': ['“','”']}; \nreturn m[key][0] + '${0:${SELECTION}}' + m[key][1];",
		options: 'sF',
		priority: 40,
		description: '选中文字加符号',
	},

	// ===== Quote/Extra Rules (regex, deferred) =====
	// Original: ExtraBasicConvRuleStringList and QuoteSpaceRuleStringList in main.ts:75-76
	{ id: 'builtin-extra-001', trigger: '((?:^|\\n)\\s*>*) ?[>》]', replacement: '[[1]]> $0', options: 'r', priority: 50, description: '引用符号转换' },
	{ id: 'builtin-extra-002', trigger: '((?:^|\\n)\\s*>+)([^ >》]+)', replacement: '[[1]] [[2]]$0', options: 'r', priority: 50, description: '引用后加空格' },
];
