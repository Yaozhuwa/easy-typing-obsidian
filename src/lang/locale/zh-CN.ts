import type { Locale } from './types';

const locale: Locale = {
    settings: {
        smartPaste: {
            name: "智能粘贴",
            desc: "在列表或引用块中粘贴时，自动添加缩进和列表/引用符号"
        },
        codeblockEdit: {
            name: "增强代码块编辑",
            desc: "增强代码块内的编辑（Cmd/Ctrl+A 选中、Tab、删除、粘贴）"
        },
        backspaceEdit: {
            name: "智能退格键",
            desc: "增强删除空列表项或空引用行的功能"
        },
        tabOut: {
            name: "Tab 跳出配对符号",
            desc: "按 Tab 键跳出配对符号，如【】、（）、《》、引号、行内代码等"
        },
        autoFormatting: {
            name: "输入时自动格式化",
            desc: "是否在编辑文档时自动格式化文本，自动格式化的总开关"
        },
        autoFormatPaste: {
            name: "粘贴时自动格式化",
            desc: "粘贴时是否自动格式化，CMD/CTRL+SHIFT+V 无格式粘贴时不触发。"
        },
        languagePairSpacing: {
            name: "语言间空格策略",
            desc: "定义不同语言/符号类型之间是否自动添加空格"
        },
        prefixDictionary: {
            name: "前缀词典",
            desc: "用逗号、空格或换行分隔，支持词或 /正则/。匹配的 token 不会被插入空格，正在输入的前缀也会暂不插入空格"
        },
        softSpaceSymbols: {
            leftName: "自定义左侧软空格额外符号",
            leftDesc: "常见的全角标点及英文双引号（\"）已内置支持。在此添加额外的符号（如 -）",
            rightName: "自定义右侧软空格额外符号",
            rightDesc: "常见的全角标点及英文双引号（\"）已内置支持。在此添加额外的符号（如 -）"
        },
        customScriptCategories: {
            name: "自定义语言/符号集",
            desc: "添加自定义语言或符号集用于空格策略",
            namePlaceholder: "名称",
            patternPlaceholder: "字符类模式"
        },

        capitalizeFirstLetter: {
            name: "句首字母大写",
            desc: "英文每个句首字母大写，可撤销"
        },
        spaceStrategyInlineCode: {
            name: "行内代码和文本之间的空格策略",
            desc: "定义行内代码和文本之间的空格策略"
        },
        spaceStrategyInlineFormula: {
            name: "行内公式和文本之间的空格策略",
            desc: "定义行内公式和文本之间的空格策略"
        },
        spaceStrategyLinkText: {
            name: "链接和文本之间的空格策略",
            desc: "定义 [[wikilink]] [mdlink](...) 和文本之间的空格策略"
        },
        userDefinedRegexpSwitch: {
            name: "用户定义的正则表达式开关",
            desc: "自定义正则表达式开关，匹配到的内容不进行格式化，且可以设置匹配到的内容块与其他内容之间的空格策略"
        },
        userDefinedRegexp: {
            name: "用户定义的正则表达式",
            desc: "用户自定义正则表达式，匹配到的内容不进行格式化，每行一个表达式，行尾不要随意加空格。" +
                "每行末尾3个字符的固定为|和两个空格策略符号，空格策略符号为-=+，分别代表不要求空格(-)，软空格(=)，严格空格(+)。" +
                "这两个空格策略符号分别为匹配区块的左右两边的空格策略。以 // 开头的行作为注释"
        },
        excludeFoldersFiles: {
            name: "排除文件夹/文件",
            desc: "该插件将每行解析为一个排除文件夹或文件。例如：DailyNote/, DailyNote/WeekNotes/, DailyNote/test.md"
        },
        fixMacOSContextMenu: {
            name: "修复 MacOS 右键菜单光标位置",
            desc: "修复 MacOS 鼠标右键呼出菜单时光标跳到下一行的问题 (需要重启 Obsidian 生效)"
        },
        fixMicrosoftIME: {
            name: "修复微软输入法问题",
            desc: "适配旧版微软输入法"
        },
        strictLineBreaks: {
            name: "严格换行模式回车增强",
            desc: "严格换行的设置下，在普通文本行进行一次回车会根据模式产生两个换行符或者两个空格和回车"
        },
        enhanceModA: {
            name: "增强 Ctrl/Cmd+A 功能",
            desc: "第一次选中当前行，第二次选中当前文本块，第三次选中全文。"
        },
        collapsePersistentEnter: {
            name: "折叠标题回车不展开",
            desc: "在折叠的标题行按回车时，不展开折叠内容，直接在下方添加同级标题行"
        },
        printDebugInfo: {
            name: "在控制台输出调试信息",
            desc: "在控制台输出调试信息"
        },
        rulesStoragePath: {
            name: "规则文件存储路径",
            desc: "设置规则文件的存储路径（相对于库根目录），选择默认则存储在插件目录内",
            defaultOption: "默认（插件目录）",
            migrateButton: "迁移",
            migrateDesc: "将规则文件从上次加载的路径迁移到当前设置的路径",
            migrateSuccess: "规则文件迁移成功"
        },
        selectionReplaceRule: {
            name: "选中替换规则",
            desc: "用户定义的选择替换规则"
        },
        deleteRule: {
            name: "删除规则",
            desc: "规则：用 | 代表光标位置，必须包含光标。提示：使用 | 表示光标位置。"
        },
        convertRule: {
            name: "转换规则",
            desc: "规则：用 | 代表光标位置，必须包含光标。提示：使用 | 表示光标位置。"
        },
        trigger: {
            name: "触发器"
        },
        left: {
            name: "左"
        },
        right: {
            name: "右"
        },
        oldPattern: {
            name: "旧模式"
        },
        newPattern: {
            name: "新模式"
        },
        ruleEditModal: {
            addTitle: "添加规则",
            editTitle: "编辑规则",
            fieldType: "类型",
            fieldTrigger: "光标前匹配",
            fieldTriggerSelectKey: "触发按键字符",
            fieldTriggerRight: "光标后匹配",
            hintTriggerEscape: "\\\\：反斜杠，\\n：换行，\\t：制表符",
            fieldReplacement: "替换内容",
            fieldReplacementDescSelectKey: "${SEL}：选中的文本内容，${0:${SEL}}：光标继续选中。",
            fieldReplacementDescInputDelete: "[[0]]：左侧第0捕获组，[[R1]]：右侧第1捕获组。",
            fieldIsRegex: "使用正则表达式匹配",
            fieldTriggerMode: "触发方式",
            fieldScope: "作用域",
            fieldScopeLanguage: "语言（可选）",
            fieldRegexFlags: "正则标志",
            fieldRegexFlagsDesc: "仅支持 i / m / u，例如 im",
            fieldPriority: "优先级",
            fieldPriorityDesc: "数值越小，优先级越高，默认 100",
            fieldDescription: "描述",
            buttonSave: "保存",
            invalidRegex: "正则表达式无效",
            fieldIsFunction: "使用函数式替换",
            functionHintInputDelete: "参数：leftMatches (string[])、rightMatches (string[])。返回字符串或 undefined 跳过。",
            functionHintSelectKey: "参数：selectionText (string)、key (string)。返回字符串或 undefined 跳过。",
            hintTabstop: "$0：光标位置，$1/$2：按 Tab 跳转的位置，${1:text}：跳转并选中 text。",
            functionPlaceholder: "// 示例：\nconst d = new Date();\nreturn d.toISOString().slice(0,10) + '$0';",
            groupMatch: "匹配条件",
            groupReplacement: "替换",
            groupOther: "其他",
        },
        ruleType: {
            input: "输入",
            delete: "删除",
            selectKey: "选中替换",
        },
    },
    commands: {
        formatArticle: "格式化全文",
        formatSelection: "格式化选中部分/当前行",
        deleteBlankLine: "刪除选中部分/全文的多余空白行",
        insertCodeblock: "插入代码块",
        switchAutoformat: "切换自动格式化开关",
        pasteWithoutFormat: "无格式化粘贴",
        toggleComment: "切换注释",
        gotoNewLine: "跳到当前行后新行",
        selectBlock: "选择当前文本块",
    },
    headers: {
        main: "Obsidian EasyTyping 插件",
        githubDetail: "详情见 Github：",
        enhancedEditing: "增强编辑设置",
        customizeEditRule: "自定义编辑转换规则",
        autoformatSetting: "自动格式化设置",
        detailedSetting: "行内元素间空格",
        customRegexpBlock: "自定义正则区块",
        excludeFoldersFiles: "指定文件不自动格式化",
        experimentalFeatures: "实验功能",
        languagePairSection: "语言间空格策略",
        addLanguagePair: "添加新语言/符号对：",
        prefixDictSection: "前缀词典",
        softSpaceSection: "自定义软空格符号",
        customScriptSection: "自定义语言/符号集",
        spaceStrategyIntro: "空格策略说明：\n无要求：对相关区块与左右文本没有空格要求。\n软空格：对相关区块与周围区块只要求有软空格（例如当前块左右临近文本为标点符号时，不需要再插入真实空格）。\n严格空格：当前块与临近文本之间严格添加真实空格。",
        aboutRegexp: {
            header: "正则表达式相关知识，见 ",
            text: "《阮一峰：正则表达式简明教程》",
        },
        customizeSelectionRule: "自定义选中文本编辑增强规则",
        customizeDeleteRule: "自定义删除编辑增强规则",
        customizeConvertRule: "自定义编辑转换规则",
        editSelectionReplaceRule: "编辑选中替换规则",
        builtinRulesSection: "内置规则",
        userRulesSection: "用户规则",
        deletedRulesSection: "已删除的内置规则",
        tabs: {
            editEnhance: "编辑增强",
            autoFormat: "自动格式化",
            builtinRules: "内置规则",
            userRules: "自定义规则",
            other: "其他设置",
        },
    },
    dropdownOptions: {
        enterTwice: "两次回车",
        twoSpace: "加两个空格",
        mixMode: "混合模式",

        noRequire: "无要求",
        softSpace: "软空格",
        strictSpace: "严格空格",
        dummy: "呆空格",
        smart: "智能空格",
        scopeAll: "全部",
        scopeText: "文本",
        scopeFormula: "公式",
        scopeCode: "代码",
        triggerModeAuto: "自动",
        triggerModeTab: "Tab 键",
        ruleTypeInput: "输入",
        ruleTypeDelete: "删除",
        ruleTypeSelectKey: "选中替换",
    },
    toolTip: {
        switch: "功能开关",
        editRule: "编辑规则",
        removeRule: "删除规则",
        addRule: "添加规则",
        enableRule: "启用/禁用规则",
        restoreRule: "恢复此规则",
        resetAllRules: "重置内置规则",
        resetSuccess: "内置规则已重置",
        exportRules: "导出规则",
        importRules: "导入规则",
        noRulesToExport: "没有可导出的用户规则",
        importSuccess: "导入了 %d 条规则，跳过 %d 条重复规则",
        importInvalidJson: "文件格式错误：不是有效的 JSON",
        importNoRules: "文件中没有可导入的规则",
    },
    placeHolder: {
        triggerSymbol: "触发符",
        newLeftSideString: "左边符号",
        newRightSideString: "右边符号",
        addRule: "添加规则",
        noticeInvaidTrigger: "无效的触发符, 触发符必须是单字符或者是 ——、……",
        noticeWarnTriggerExists: "无效规则! 触发符 %s 已存在",
        noticeMissingInput: "missing input",
        beforeDelete: "删除前|",
        newPattern: "触发规则后字符串模式",
        noticeInvaidTriggerPatternContainSymbol: "无效规则, 转换前模式必须包含代表光标位置的符号 \|",
        beforeConvert: "转换前|",
        noticeInvalidPatternString: "Invalid pattern string!",
    },
    button: {
        update: "更新",
    },
    scriptCategoryLabels: {
        chinese: "中文",
        japanese: "日文",
        korean: "韩文",
        cjk: "中日韩",
        english: "英文",
        digit: "数字",
        russian: "俄文",
        unknown: "未知",
    },
    builtinRuleDescriptions: {
        'builtin-autopair-input': '输入全角括号/引号时自动补全配对',
        'builtin-autopair-jump': '输入右侧配对符号时自动跳过，避免重复插入',
        'builtin-autopair-delete': '删除全角括号/引号时同时删除配对',
        'builtin-conv-backtick': '连续中文间隔号 ·· 转行内代码',
        'builtin-conv-codeblock': '行内代码中继续输入 · 升级为代码块',
        'builtin-conv-formula': '￥/$ 符号组合转行内或块级公式',
        'builtin-conv-linestart': '行首 》 转引用标记、行首 、 转斜杠',
        'builtin-conv-hw2fw': 'CJK字符后半角标点转全角',
        'builtin-fw2hw-double': '连续输入两个相同全角标点转对应半角',
        'builtin-del-inline-formula': '删除行内公式 $...$ 配对',
        'builtin-del-highlight': '删除高亮 ==...== 配对',
        'builtin-del-block-formula': '删除块级公式 $$...$$ 配对',
        'builtin-del-codeblock': '快速删除空代码块',
        'builtin-del-wikilink': '快速删除双链及嵌入（![[]]）',
        'builtin-sel-wrap-symbols': '选中文字后输入 【/¥/￥ 包裹为 []/$$',
        'builtin-sel-wrap-backtick': '选中文字后输入 · 包裹为行内代码',
        'builtin-sel-wrap-quotes': '选中文字后输入全角引号，配对引号包裹',
        'builtin-sel-wrap-cjk-brackets': '选中文字后输入《（，配对括号包裹',
        'builtin-quote-convert': '输入 > 或 》 转为 Markdown 引用标记',
        'builtin-quote-space': '引用标记 > 后自动补空格',
    },
};

export default locale;
