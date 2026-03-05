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
		trigger: '[（《「『“”‘’《]',
		replacement: "const p={'【':'【$0】','（':'（$0）','《':'《$0》','「':'「$0」','『':'『$0』','“':'“$0”','”':'“$0”','‘':'‘$0’','’':'‘$0’','《':'《$0》'}; return p[leftMatches[0]];",
		options: 'rF',
		priority: 10,
		description: '输入全角括号/引号时自动补全配对',
	},
	{
		id: 'builtin-autopair-jump',
		trigger: "《》|“”|““|‘’|‘‘|（）",
		trigger_right: "》|”|’|）",
		replacement: "const map = {\n  \"《》\": [\"》\", \"《》\"],\n  \"（）\": [\"）\", \"（）\"],\n  \"“”\": [\"”\", \"“”\"],\n  \"““\": [\"”\", \"“”\"],\n  \"‘’\": [\"’\", \"‘’\"],\n  \"‘‘\": [\"’\", \"‘’\"]\n}\nif(map[leftMatches[0]][0]==rightMatches[0]){\n  return map[leftMatches[0]][1];\n}\nreturn undefined;",
		options: 'rF',
		priority: 5,
		description: '输入右侧配对符号时自动跳过，避免重复插入'
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
		id: 'builtin-conv-codeblock',
		trigger: '(?<=^|\\n)([ \\t]*)`·',
		trigger_right: '`',
		replacement: '[[1]]```$0\n[[1]]```',
		options: 'r',
		priority: 10,
		description: '行内代码中继续输入 · 升级为代码块',
	},
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
		id: 'builtin-conv-hw2fw',
		trigger: '([\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af])([,.:?!;\(])',
		trigger_right: '\\)?',
		replacement: "const m={',':'，','.':'。','?':'？','!':'！',':':'：',';':'；','(':'（$0）'}; return leftMatches[1] + m[leftMatches[2]];",
		options: 'rF',
		priority: 15,
		description: 'CJK字符后半角标点转全角',
	},

	// ===== 全角转半角 (priority 20) =====
	{
		id: 'builtin-fw2hw-double',
		trigger: "([。！；，：？》｜（《])\\1",
		trigger_right: '[）》]?',
		replacement: "const p={'（':['）','($0)'],'《':['》','<$0']};\nconst m={'。':'.$0','！':'!$0','；':';$0','，':',$0','：':':$0','？':'?$0','》':'>$0','｜':'|$0','（':'($0)','《':'<$0'};\nconst c=leftMatches[1],r=rightMatches[0]||'',e=p[c]; \nreturn e&&e[0]===r?e[1]:m[c];",
		options: 'rF',
		priority: 3,
		description: '连续输入两个相同全角标点转对应半角',
	},

	// ===== 删除配对 (priority 30) =====
	{ id: 'builtin-del-inline-formula', trigger: '$', trigger_right: '$', replacement: '', options: 'd', priority: 30, description: '删除行内公式 $...$ 配对' },
	{ id: 'builtin-del-highlight', trigger: '==', trigger_right: '==', replacement: '', options: 'd', priority: 30, description: '删除高亮 ==...== 配对' },
	{ id: 'builtin-del-block-formula', trigger: '$$\n', trigger_right: '\n$$', replacement: '', options: 'd', priority: 30, description: '删除块级公式 $$...$$ 配对' },
	{
		id: 'builtin-del-codeblock',
		trigger: '(?<=^|\\n)([ \\t]*)```',
		trigger_right: '[ \\t]*\\n([ \\t]*)```',
		replacement: '[[1]]',
		options: 'dr',
		priority: 30,
		description: '快速删除空代码块',
	},
	{
		id: 'builtin-del-wikilink',
		trigger: ' ?!?\\[\\[[^\\n\\[\\]]*\\]\\]',
		replacement: '',
		options: 'dr',
		priority: 30,
		description: '快速删除双链及嵌入（![[]]）',
	},

	// ===== 选中替换 (priority 40) =====
	{
		id: 'builtin-sel-wrap-backtick',
		trigger: '·',
		replacement: '`${0:${SEL}}`',
		options: 's',
		priority: 40,
		description: '选中文字后输入 · 包裹为行内代码',
	},
	{
		id: 'builtin-sel-wrap-symbols',
		trigger: `【¥￥`,
		replacement: "const m={'¥': ['$', '$'], '￥': ['$', '$'], '【': ['[', ']']}; \nreturn m[key][0] + '${0:${SEL}}' + m[key][1];",
		options: 'sF',
		priority: 40,
		description: '选中文字后输入 【/¥/￥ 包裹为 []/$$',
	},
	{
		id: 'builtin-sel-wrap-quotes',
		trigger: `“”‘’`,
		replacement: "const m={'“': ['“','”'], '”': ['“','”'], '‘': ['‘','’'], '’': ['‘','’']}; return m[key][0] + '${0:${SEL}}' + m[key][1];",
		options: 'sF',
		priority: 40,
		description: '选中文字后输入全角引号，配对引号包裹',
	},
	{
		id: 'builtin-sel-wrap-cjk-brackets',
		trigger: `《（`,
		replacement: "const m={'《': ['《','》'], '（': ['（','）']}; return m[key][0] + '${0:${SEL}}' + m[key][1];",
		options: 'sF',
		priority: 40,
		description: '选中文字后输入《（，配对括号包裹',
	},

	// ===== 引用处理 (priority 50) =====
	{ id: 'builtin-quote-convert', trigger: '((?:^|\\n)\\s*>*) ?[>》]', replacement: '[[1]]> $0', options: 'r', priority: 50, description: '输入 > 或 》 转为 Markdown 引用标记' },
	{ id: 'builtin-quote-space', trigger: '((?:^|\\n)\\s*>+)([^ >》]+)', replacement: '[[1]] [[2]]$0', options: 'r', priority: 50, description: '引用标记 > 后自动补空格' },
];
