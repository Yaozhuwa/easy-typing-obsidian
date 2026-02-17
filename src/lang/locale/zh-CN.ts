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
        spaceBetweenChineseEnglish: {
            name: "中文与英文之间的空格",
            desc: "在中文和英文之间插入空格，可撤销"
        },
        spaceBetweenChineseNumber: {
            name: "中文与数字之间的空格",
            desc: "在中文和数字之间插入空格，可撤销"
        },
        spaceBetweenEnglishNumber: {
            name: "英文与数字之间的空格",
            desc: "在英文和数字之间插入空格，可撤销"
        },
        quoteSpace: {
            name: "引用符号 > 与文本之间自动空格",
            desc: "在引用符号 > 与文本之间自动插入空格，不可撤销"
        },
        deleteSpaceBetweenChinese: {
            name: "删除中文字符间的空格",
            desc: "去除中文字符之间的空格，不可撤销"
        },
        capitalizeFirstLetter: {
            name: "句首字母大写",
            desc: "英文每个句首字母大写，可撤销"
        },
        textPunctuationSpace: {
            name: "文本和标点间空格",
            desc: "在文本和标点之间智能插入空格"
        },
        spaceStrategyInlineCode: {
            name: "行内代码和文本之间的空格策略",
            desc: "无要求：对本类别块与左右文本没有空格的要求，" +
                     "软空格：对本类别块与周围区块只要求有软空格，软空格如当前块左边的临近文本为。，；？等全角标点，当前块右边的临近文本为所有全半角标点，" +
                     "严格空格：当前块与临近文本之间严格添加空格。"
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
				"这两个空格策略符号分别为匹配区块的左右两边的空格策略"
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
            name: "标题折叠保序",
            desc: "在折叠的同级标题行按回车不会展开，直接添加同级标题行"
        },
        puncRectify: {
            name: "自动标点转换",
            desc: "在中文/日文/韩文字符后输入时，自动将半角标点转换为全角：,。?!:; → ，。？！：；"
        },
        printDebugInfo: {
            name: "在控制台输出调试信息",
            desc: "在控制台输出调试信息"
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
            fieldTrigger: "触发器（左侧模式）",
            fieldTriggerRight: "触发器右侧（右侧模式）",
            fieldReplacement: "替换内容",
            fieldIsRegex: "正则表达式",
            fieldTriggerMode: "触发方式",
            fieldScope: "作用域",
            fieldScopeLanguage: "语言（可选）",
            fieldPriority: "优先级",
            fieldDescription: "描述",
            buttonSave: "保存",
            fieldIsFunction: "函数替换",
            functionHintInputDelete: "参数：leftMatches (string[])、rightMatches (string[])。返回字符串或 undefined 跳过。",
            functionHintSelectKey: "参数：selectionText (string)、key (string)。返回字符串或 undefined 跳过。",
            functionPlaceholder: "// 示例：\nconst d = new Date();\nreturn d.toISOString().slice(0,10) + '$0';",
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
        detailedSetting: "详细设置如下",
        customRegexpBlock: "自定义正则区块",
        excludeFoldersFiles: "指定文件不自动格式化",
        experimentalFeatures: "实验功能",
        aboutRegexp: {
            header:"正则表达式相关知识，见 ",
            text: "《阮一峰：正则表达式简明教程》",
        },
        instructionsRegexp: {
            header: "正则表达式规则使用说明与示例： ",
            text:"自定义正则表达式规则",
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
        onlyWhenTyping: "输入时生效",
        globally: "全局生效",
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
        resetAllRules: "重置所有内置规则为默认值",
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
        noticeInvalidPatternString:"Invalid pattern string!",
    },
    button: {
        update: "更新",
    }
};

export default locale;
