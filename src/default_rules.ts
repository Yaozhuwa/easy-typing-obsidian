import { SimpleRule } from './rule_engine';

// 优先级分层（数字越小越优先）:
//   10: 自动配对 + 基础转换
//   15: 半角转全角（CJK字符后）
//   20: 全角转半角（连续两个相同全角标点）
//   30: 删除配对
//   40: 选中替换
//   50: 引用处理
//   100+: 用户自定义规则

export const DEFAULT_BUILTIN_RULES: (SimpleRule & { id: string })[] = [
	// ===== 自动配对 (priority 10) =====
	{
		id: 'builtin-autopair-input',
		trigger: '[（《「『“‘《]',
		replacement: "const p={'【':'【$0】','（':'（$0）','《':'《$0》','「':'「$0」','『':'『$0』','“':'“$0”','‘':'‘$0’','《':'《$0》'}; return p[leftMatches[0]];",
		options: 'rF',
		priority: 10,
		description: '输入全角括号/引号时自动补全配对',
	},
	{
		id: 'builtin-autopair-delete',
		trigger: "[【（《「『“‘]",
		trigger_right: "[】）》」』”’]",
		replacement: "const p={'【':'】','（':'）','《':'》','「':'」','『':'』','“':'”','‘':'’'}; return p[leftMatches[0]]===rightMatches[0] ? '' : undefined;",
		options: 'drF',
		priority: 10,
		description: '删除全角括号/引号时同时删除配对',
	},

	// ===== 基础转换 (priority 10) =====
	{ id: 'builtin-conv-backtick', trigger: '··', replacement: '`$0`', priority: 10, description: '连续中文间隔号 ·· 转行内代码' },
	{
		id: 'builtin-conv-formula',
		trigger: '(￥￥|¥¥|\\$￥|\\$¥|\\$\\$)',
		trigger_right: '\\$?',
		replacement: "return rightMatches[0] === '$' ? '$$\\n$0\\n$$' : '$$0$';",
		options: 'rF',
		priority: 10,
		description: '￥/$ 符号组合转行内或块级公式',
	},
	{
		id: 'builtin-conv-linestart',
		trigger: '(^|\\n)([》、])',
		replacement: "const m = {'》': '[[1]]> $0', '、': '[[1]]/$0'}; return m[leftMatches[2]];",
		options: 'rF',
		priority: 10,
		description: '行首 》 转引用标记、行首 、 转斜杠',
	},

	// ===== 半角转全角 (priority 15) =====
	{
		id: 'builtin-punc-cjk',
		trigger: '([\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af])([,.:?!;])',
		replacement: "const m={',':'，','.':'。','?':'？','!':'！',':':'：',';':'；'}; return leftMatches[1] + m[leftMatches[2]];",
		options: 'rF',
		priority: 15,
		description: 'CJK字符后半角标点转全角',
	},

	// ===== 全角转半角 (priority 20) =====
	{
		id: 'builtin-fw2hw-double',
		trigger: '([。！；，：？》｜（《“”‘’])\\1',
		trigger_right: '[）》”’]?',
		replacement: "const p={'\uFF08':['\uFF09','($0)'],'\u300A':['\u300B','<$0'],'\u201c':['\u201d','\"$0\"'],'\u201d':['\u201d','\"$0\"'],'\u2018':['\u2019',\"'$0'\"],'\u2019':['\u2019',\"'$0'\"]}; const m={'\u3002':'.$0','\uFF01':'!$0','\uFF1B':';$0','\uFF0C':',$0','\uFF1A':':$0','\uFF1F':'?$0','\u300B':'>$0','\uFF5C':'|$0','\uFF08':'($0)','\u300A':'<$0','\u201c':'\"$0\"','\u201d':'\"$0\"','\u2018':\"'$0'\",'\u2019':\"'$0'\"}; const c=leftMatches[1],r=rightMatches[0]||'',e=p[c]; return e&&e[0]===r?e[1]:m[c];",
		options: 'rF',
		priority: 20,
		description: '连续输入两个相同全角标点转对应半角',
	},

	// ===== 删除配对 (priority 30) =====
	{ id: 'builtin-del-inline-formula', trigger: '$', trigger_right: '$', replacement: '', options: 'd', priority: 30, description: '删除行内公式 $...$ 配对' },
	{ id: 'builtin-del-highlight', trigger: '==', trigger_right: '==', replacement: '', options: 'd', priority: 30, description: '删除高亮 ==...== 配对' },
	{ id: 'builtin-del-block-formula', trigger: '$$\n', trigger_right: '\n$$', replacement: '', options: 'd', priority: 30, description: '删除块级公式 $$...$$ 配对' },

	// ===== 选中替换 (priority 40) =====
	{
		id: 'builtin-sel-wrap',
		trigger: `[【¥“”]`,
		replacement: "const m={'¥': ['$', '$'], '【': ['[', ']'], '“': ['“','”'], '”': ['“','”']}; \nreturn m[key][0] + '${0:${SELECTION}}' + m[key][1];",
		options: 'sF',
		priority: 40,
		description: '选中文字后输入全角符号包裹为对应半角',
	},

	// ===== 引用处理 (priority 50) =====
	{ id: 'builtin-quote-convert', trigger: '((?:^|\\n)\\s*>*) ?[>》]', replacement: '[[1]]> $0', options: 'r', priority: 50, description: '输入 > 或 》 转为 Markdown 引用标记' },
	{ id: 'builtin-quote-space', trigger: '((?:^|\\n)\\s*>+)([^ >》]+)', replacement: '[[1]] [[2]]$0', options: 'r', priority: 50, description: '引用标记 > 后自动补空格' },
];
