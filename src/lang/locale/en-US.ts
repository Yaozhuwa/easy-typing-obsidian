import type { Locale } from './types';

const locale: Locale = {
    settings: {
        smartPaste: {
            name: "Smart Paste in Lists & Quotes",
            desc: "In lists or quote blocks, paste content automatically with proper indentation and list/quote markers."
        },
        codeblockEdit: {
            name: "Enhance Codeblock Edit",
            desc: "Improve editing in codeblocks (Tab, delete, paste, Cmd/Ctrl+A select)."
        },
        backspaceEdit: {
            name: "Smart Backspace",
            desc: "Improve backspace feature for empty list item or empty quote line."
        },
        tabOut: {
            name: "Tab Out of Paired Symbols",
            desc: "Press Tab to move cursor outside paired symbols like 【】, （）, 《》, quotes, or inline code."
        },
        autoFormatting: {
            name: "Auto formatting when typing",
            desc: "Toggle auto-formatting of text while editing the document."
        },
        languagePairSpacing: {
            name: "Language Pair Spacing",
            desc: "Define which language/symbol pairs should have automatic spacing"
        },
        prefixDictionary: {
            name: "Prefix Dictionary",
            desc: "One word or /regex/ per line. Matching tokens won't have spaces inserted; prefixes being typed are also suppressed"
        },
        softSpaceSymbols: {
            leftName: "Custom Extra Left Soft Space Symbols",
            leftDesc: "Common full-width punctuations are built-in. Add extra symbols here (like -).",
            rightName: "Custom Extra Right Soft Space Symbols",
            rightDesc: "Common full-width punctuations are built-in. Add extra symbols here (like -)."
        },
        customScriptCategories: {
            name: "Custom Script Categories",
            desc: "Add custom language or symbol sets for spacing strategies",
            namePlaceholder: "Name",
            patternPlaceholder: "Char class pattern"
        },

        capitalizeFirstLetter: {
            name: "Capitalize the first letter of every sentence",
            desc: "Capitalize the first letter of each sentence in English."
        },
        spaceStrategyInlineCode: {
            name: "Space strategy between inline code and text",
            desc: "Define the spacing strategy between inline code and text."
        },
        spaceStrategyInlineFormula: {
            name: "Space strategy between inline formula and text",
            desc: "Define the spacing strategy between inline formulas and text."
        },
        spaceStrategyLinkText: {
            name: "Space strategy between link and text",
            desc: "Define the spacing strategy between [[wikilink]] [mdlink](...) and text."
        },
        userDefinedRegexpSwitch: {
            name: "User Defined RegExp Switch",
            desc: "Toggle custom regular expressions, preventing formatting and setting space strategy between matched content and other text."
        },
        userDefinedRegexp: {
            name: "User-defined Regular Expression, one expression per line",
            desc: "User-defined regular expression, matched to the content is not formatted, one expression per line, do not feel free to add spaces at the end of the line." +
                "The end of each line of three characters fixed as | and two space strategy symbols, space strategy symbols for - = +, respectively, on behalf of not requiring spaces (-), soft spaces (=), strict spaces (+)." +
                "These two space strategy symbols are the space strategy for the left and right sides of the matching block respectively"
        },
        excludeFoldersFiles: {
            name: "Exclude Folders/Files",
            desc: "This plugin will parse each line as an exclude folder or file. For example: DailyNote/, DailyNote/WeekNotes/, DailyNote/test.md"
        },
        fixMacOSContextMenu: {
            name: "Fix MacOS context-menu cursor position (Need to restart Obsidian)",
            desc: "Fix the issue where the cursor jumps to the next line when the context menu is invoked on MacOS (requires restarting Obsidian)."
        },
        fixMicrosoftIME: {
            name: "Fix Microsoft Input Method Issue",
            desc: "Adapt for older versions of Microsoft Input Method."
        },
        strictLineBreaks: {
            name: "Strict Line breaks Mode",
            desc: "In strict line breaks mode, pressing Enter once in normal text lines will produce two line breaks or two spaces and Enter."
        },
        enhanceModA: {
            name: "Enhance Mod+A selection in text",
            desc: "First select the current line, second select the current text block, third select the entire text."
        },
        collapsePersistentEnter: {
            name: "Keep Collapsed on Enter",
            desc: "Pressing Enter on a collapsed heading inserts a same-level heading below without expanding the fold."
        },
        printDebugInfo: {
            name: "Print debug info in console",
            desc: "Print debug information in the console."
        },
        selectionReplaceRule: {
            name: "Selection Replace Rule",
            desc: "User defined Selection Replace Rule"
        },
        deleteRule: {
            name: "Delete Rule",
            desc: "Rule: Use | to indicate the cursor position. Tips: Using | to indicate the cursor position."
        },
        convertRule: {
            name: "Convert Rule",
            desc: "Rule: Use | to indicate the cursor position. Tips: Using | to indicate the cursor position."
        },
        trigger: {
            name: "Trigger"
        },
        left: {
            name: "Left"
        },
        right: {
            name: "Right"
        },
        oldPattern: {
            name: "Old Pattern"
        },
        newPattern: {
            name: "New Pattern"
        },
        ruleEditModal: {
            addTitle: "Add Rule",
            editTitle: "Edit Rule",
            fieldType: "Type",
            fieldTrigger: "Match Before Cursor",
            fieldTriggerSelectKey: "Trigger Key",
            fieldTriggerRight: "Match After Cursor",
            fieldReplacement: "Replacement",
            fieldReplacementDescSelectKey: "${SEL}: selected text, ${0:${SEL}}: select the text.",
            fieldReplacementDescInputDelete: "[[0]]: 0th left capture group, [[R1]]: 1st right capture group.",
            fieldIsRegex: "Is Regex",
            fieldTriggerMode: "Trigger Mode",
            fieldScope: "Scope",
            fieldScopeLanguage: "Language (optional)",
            fieldPriority: "Priority",
            fieldDescription: "Description",
            buttonSave: "Save",
            invalidRegex: "Invalid regex",
            fieldIsFunction: "Is Function",
            functionHintInputDelete: "Args: leftMatches (string[]), rightMatches (string[]). Return string or undefined to skip.",
            functionHintSelectKey: "Args: selectionText (string), key (string). Return string or undefined to skip.",
            functionPlaceholder: "// Example:\nconst d = new Date();\nreturn d.toISOString().slice(0,10) + '$0';",
        },
        ruleType: {
            input: "Input",
            delete: "Delete",
            selectKey: "SelectKey",
        },
    },
    commands: {
        formatArticle: "Format current article",
        formatSelection: "Format selected text or current line",
        deleteBlankLine: "Delete blank lines of the selected or whole article",
        insertCodeblock: "Insert code block w/wo selection",
        switchAutoformat: "Switch autoformat",
        pasteWithoutFormat: "Paste without format",
        toggleComment: "Toggle comment",
        gotoNewLine: "Go to new line after current line",
        selectBlock: "Select current text block",
    },
    headers: {
        main: "Obsidian EasyTyping Plugin",
        githubDetail: "More detail is in Github: ",
        enhancedEditing: "Enhanced Editing Setting",
        customizeEditRule: "Customize Edit Convertion Rule",
        autoformatSetting: "Autoformat Setting",
        detailedSetting: "Spacing Between Inline Elements",
        customRegexpBlock: "Custom regular expressions block",
        excludeFoldersFiles: "Exclude Folders/Files",
        experimentalFeatures: "Experimental Features",
        languagePairSection: "Language Pair Spacing",
        addLanguagePair: "Add New Language/Symbol Pair:",
        prefixDictSection: "Prefix Dictionary",
        softSpaceSection: "Soft Space Symbols",
        customScriptSection: "Custom Script Categories",
        spaceStrategyIntro: "Spacing Strategy:\nNo Require: No space requirement between this category block and the surrounding text.\nSoft Space: Only requires a soft space between this category block and the surrounding blocks (e.g., if adjacent text is punctuation, no real space is added).\nStrict Space: Strictly add real spaces between the current block and the adjacent text.",
        aboutRegexp: {
            header: "For knowledge about regular expressions, see ",
            text: "Yifeng Nguyen: A Concise Tutorial on Regular Expressions",
        },
        instructionsRegexp: {
            header: "Instructions and examples for using regular expression rules: ",
            text: "Customizing Regular Expression Rules",
        },
        customizeSelectionRule: "Customize Selection Replace Rule",
        customizeDeleteRule: "Customize Delete Rule",
        customizeConvertRule: "Customize Convert Rule",
        editSelectionReplaceRule: "Edit Selection Replace Rule",
        builtinRulesSection: "Built-in Rules",
        userRulesSection: "User Rules",
        deletedRulesSection: "Deleted Built-in Rules",
        tabs: {
            editEnhance: "Edit Enhance",
            autoFormat: "Auto Format",
            builtinRules: "Built-in Rules",
            userRules: "User Rules",
            other: "Other",
        },
    },
    dropdownOptions: {
        enterTwice: "Enter Twice",
        twoSpace: "Two Space",
        mixMode: "Mix Mode",

        noRequire: "No Require",
        softSpace: "Soft Space",
        strictSpace: "Strict Space",
        dummy: "Dummy",
        smart: "Smart",
        scopeAll: "All",
        scopeText: "Text",
        scopeFormula: "Formula",
        scopeCode: "Code",
        triggerModeAuto: "Auto",
        triggerModeTab: "Tab",
        ruleTypeInput: "Input",
        ruleTypeDelete: "Delete",
        ruleTypeSelectKey: "SelectKey",
    },
    toolTip: {
        switch: "Switch",
        editRule: "Edit rule",
        removeRule: "Remove rule",
        addRule: "Add Rule",
        enableRule: "Enable/Disable rule",
        restoreRule: "Restore this rule",
        resetAllRules: "Reset all built-in rules",
        resetSuccess: "Built-in rules reset successfully",
        exportRules: "Export Rules",
        importRules: "Import Rules",
        noRulesToExport: "No user rules to export",
        importSuccess: "Imported %d rules, skipped %d duplicates",
        importInvalidJson: "Invalid file: not valid JSON",
        importNoRules: "No importable rules found in file",
    },
    placeHolder: {
        triggerSymbol: "Trigger Symbol",
        newLeftSideString: "New Left Side String",
        newRightSideString: "New Right Side String",
        addRule: "Add Rule",
        noticeInvaidTrigger: "Inlvalid trigger, trigger must be a symbol of length 1 or symbol ——, ……",
        noticeWarnTriggerExists: "warning! Trigger %s is already exist!",
        noticeMissingInput: "missing input",
        beforeDelete: "Before Delete",
        newPattern: "New Pattern",
        noticeInvaidTriggerPatternContainSymbol: "Inlvalid trigger, pattern must contain symbol \| which indicate cursor position",
        beforeConvert: "Before Convert",
        noticeInvalidPatternString: "Invalid pattern string!",
    },
    button: {
        update: "Update",
    },
    scriptCategoryLabels: {
        chinese: "Chinese",
        japanese: "Japanese",
        korean: "Korean",
        cjk: "CJK",
        english: "English",
        digit: "Digit",
        russian: "Russian",
        unknown: "Unknown",
    },
    builtinRuleDescriptions: {
        'builtin-autopair-input': 'Auto-complete paired full-width brackets/quotes',
        'builtin-autopair-jump': 'Skip over closing paired symbol to avoid duplicates',
        'builtin-autopair-delete': 'Delete both sides of full-width bracket/quote pairs',
        'builtin-conv-backtick': 'Double middle dot ·· converts to inline code',
        'builtin-conv-codeblock': 'Type · inside inline code to upgrade to code block',
        'builtin-conv-formula': '￥/$ combinations convert to inline or block formula',
        'builtin-conv-linestart': '》 at line start → blockquote, 、 at line start → slash',
        'builtin-conv-hw2fw': 'Convert half-width punctuation to full-width after CJK characters',
        'builtin-fw2hw-double': 'Double identical full-width punctuation converts to half-width',
        'builtin-del-inline-formula': 'Delete inline formula $...$ pair',
        'builtin-del-highlight': 'Delete highlight ==...== pair',
        'builtin-del-block-formula': 'Delete block formula $$...$$ pair',
        'builtin-del-codeblock': 'Quickly delete empty code block',
        'builtin-del-wikilink': 'Quickly delete wikilink and embed (![[]])',
        'builtin-sel-wrap-symbols': 'Wrap selection with []/$ using 【/¥/￥',
        'builtin-sel-wrap-quotes': 'Wrap selection with paired full-width quotes',
        'builtin-sel-wrap-cjk-brackets': 'Wrap selection with 《》 or （） brackets',
        'builtin-quote-convert': 'Convert > or 》 to Markdown blockquote marker',
        'builtin-quote-space': 'Auto-insert space after blockquote marker >',
    },
};

export default locale;
