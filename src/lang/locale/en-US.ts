const locale = {
    settings: {
        symbolAutoPair: {
            name: "Symbol auto pair and delete with pair",
            desc: "Add auto-pairing and auto-deletion for various symbols such as 《》, “”, 「」, 『』, 【】, etc."
        },
        selectionReplace: {
            name: "Selection Replace Enhancement",
            desc: "Enhanced editing for selected text, e.g., pressing ￥ → $selected text$, pressing · → `selected text`, 《 → 《selected text》, etc."
        },
        fullWidthToHalfWidth: {
            name: "Convert successive full width symbol to half width symbol",
            desc: "Convert consecutive full-width symbols to half-width, e.g., 。。→ ., ！！→ !, 》》→ >"
        },
        basicInputEnhance: {
            name: "Basic symbol input enhance for Obsidian",
            desc: "Basic input enhancement for Obsidian, e.g., 【【| → [[|]], starting with 、→ /, starting with 》→ >, ··| → `|`, `·|` becomes code block, ￥￥| → $|$"
        },
        codeblockEdit: {
            name: "Enhance codeblock edit",
            desc: "Improve editing in codeblocks (Tab, delete, paste, Cmd/Ctrl+A select)."
        },
        backspaceEdit: {
            name: "Enhance backspace edit",
            desc: "Improve backspace featurefor empty list item or empty quote line."
        },
        tabOut: {
            name: "Tabout",
            desc: "Tab out of inline code or paired symbols."
        },
        autoFormatting: {
            name: "Auto formatting when typing",
            desc: "Toggle auto-formatting of text while editing the document."
        },
        spaceBetweenChineseEnglish: {
            name: "Space between Chinese and English",
            desc: "Insert space between Chinese and English characters."
        },
        spaceBetweenChineseNumber: {
            name: "Space between Chinese and Number",
            desc: "Insert space between Chinese characters and numbers."
        },
        spaceBetweenEnglishNumber: {
            name: "Space between English and Number",
            desc: "Insert space between English characters and numbers."
        },
        quoteSpace: {
            name: "Space between quote character > and text",
            desc: "Insert space between quote character > and text."
        },
        deleteSpaceBetweenChinese: {
            name: "Delete the Space between Chinese characters",
            desc: "Remove spaces between Chinese characters."
        },
        capitalizeFirstLetter: {
            name: "Capitalize the first letter of every sentence",
            desc: "Capitalize the first letter of each sentence in English."
        },
        smartInsertSpace: {
            name: "Smartly insert space between text and punctuation",
            desc: "Insert space between text and punctuation intelligently."
        },
        spaceStrategyInlineCode: {
            name: "Space strategy between inline code and text",
            desc: "No requirement: No space requirement between this category block and the surrounding text. " +
                      "Soft space: Only requires a soft space between this category block and the surrounding blocks. " +
                      "Soft space example: If the adjacent text on the left side of the current block is full-width punctuation like . , ; ? etc., and the adjacent text on the right side of the current block is all full-width or half-width punctuation. " +
                      "Strict space: Strictly add spaces between the current block and the adjacent text."
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
            desc: "User-defined regular expression, matched to the content is not formatted, one expression per line, do not feel free to add spaces at the end of the line."+
                "The end of each line of three characters fixed as | and two space strategy symbols, space strategy symbols for - = +, respectively, on behalf of not requiring spaces (-), soft spaces (=), strict spaces (+)."+
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
            name: "Strict Line breaks Mode Enter Twice",
            desc: "In strict line breaks mode, pressing Enter once in normal text lines will produce two line breaks."
        },
        enhanceModA: {
            name: "Enhance Mod+A selection in text",
            desc: "First select the current line, second select the current text block, third select the entire text."
        },
        puncRectify: {
            name: "Punc rectify",
            desc: "Automatically convert English punctuation (, . ? !) between Chinese characters to full-width punctuation during typing (reversible)."
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
        }
    },
    headers: {
        main: "Obsidian EasyTyping Plugin",
        githubDetail: "More detail is in Github: ",
        enhancedEditing: "Enhanced Editing Setting",
        customizeEditRule: "Customize Edit Convertion Rule",
        autoformatSetting: "Autoformat Setting",
        detailedSetting: "Detailed Setting Below",
        customRegexpBlock: "Custom regular expressions block",
        excludeFoldersFiles: "Exclude Folders/Files",
        experimentalFeatures: "Experimental Features",
        aboutRegexp: {
            header: "For knowledge about regular expressions, see ",
            text: "Yifeng Nguyen: A Concise Tutorial on Regular Expressions",
        },
        instructionsRegexp: {
            header: "Instructions and examples for using regular expression rules: ",
            text:"Customizing Regular Expression Rules",
        },
        customizeSelectionRule: "Customize Selection Replace Rule",
        customizeDeleteRule: "Customize Delete Rule",
        customizeConvertRule: "Customize Convert Rule",
        editSelectionReplaceRule: "Edit Selection Replace Rule",
    },
    dropdownOptions: {
        onlyWhenTyping: "Only When Typing",
        globally: "Work Globally",
        noRequire: "No Require",
        softSpace: "Soft Space",
        strictSpace: "Strict Space",
        dummy: "Dummy",
        smart: "Smart"
    },
    toolTip: {
        switch: "Switch",
        editRule: "Edit rule",
        removeRule: "Remove rule",
        addRule: "Add Rule",
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
        noticeInvalidPatternString:"Invalid pattern string!",
    },
    button: {
        update: "Update",
    }
};

export default locale;
