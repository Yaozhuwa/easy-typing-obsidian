import type { Locale } from './types';

const locale: Locale = {
    settings: {
        smartPaste: {
            name: "智慧粘貼",
            desc: "在列表或引用塊中粘貼時，自動添加縮進和列表/引用符號"
        },
        codeblockEdit: {
            name: "增强代碼塊編輯",
            desc: "增强代碼塊內的編輯（Cmd/Ctrl+A 選中、Tab、刪除、粘貼）"
        },
        backspaceEdit: {
            name: "智慧退格鍵",
            desc: "增強刪除空列表項或空引用行的功能"
        },
        tabOut: {
            name: "Tab 跳出配對符號",
            desc: "按 Tab 鍵跳出配對符號，如【】、（）、《》、引號、行內代碼等"
        },
        autoFormatting: {
            name: "輸入時自動格式化",
            desc: "是否在編輯文檔時自動格式化文本，自動格式化的總開關"
        },
        languagePairSpacing: {
            name: "語言間空格策略",
            desc: "定義不同語言/符號類型之間是否自動添加空格"
        },
        prefixDictionary: {
            name: "前綴詞典",
            desc: "每行一個詞或 /正則/，匹配的 token 不會被插入空格，正在輸入的前綴也會暫不插入空格"
        },
        softSpaceSymbols: {
            leftName: "自定義左側軟空格額外符號",
            leftDesc: "常見的全角標點已內置支持。在此添加額外的符號（如-）",
            rightName: "自定義右側軟空格額外符號",
            rightDesc: "常見的全角標點已內置支持。在此添加額外的符號（如-）"
        },
        customScriptCategories: {
            name: "自定義語言/符號集",
            desc: "添加自定義語言或符號集用於空格策略",
            namePlaceholder: "名稱",
            patternPlaceholder: "字元類模式"
        },
        capitalizeFirstLetter: {
            name: "句首字母大寫",
            desc: "英文每個句首字母大寫，可取消"
        },
        textPunctuationSpace: {
            name: "文本和標點間空格",
            desc: "在文本和標點之間智能插入空格"
        },
        spaceStrategyInlineCode: {
            name: "行內代碼和文本之間的空格策略",
            desc: "定義行內代碼和文本之間的空格策略"
        },
        spaceStrategyInlineFormula: {
            name: "行內公式和文本之間的空格策略",
            desc: "定義行內公式和文本之間的空格策略"
        },
        spaceStrategyLinkText: {
            name: "連結和文本之間的空格策略",
            desc: "定義 [[wikilink]] [mdlink](...) 和文本之間的空格策略"
        },
        userDefinedRegexpSwitch: {
            name: "用戶定義的正則表達式開關",
            desc: "自定義正則表達式開關，匹配到的內容不進行格式化，且可以設置匹配到的內容塊與其他內容之間的空格策略"
        },
        userDefinedRegexp: {
            name: "用戶定義的正則表達式",
            desc: "用戶自定義正則表達式，匹配到的內容不進行格式化，每行一個表達式，行尾不要隨意加空格。" +
                "每行末尾3個字符的固定為|和兩個空格策略符號，空格策略符號為-=+，分別代表不要求空格(-)，軟空格(=)，嚴格空格(+)。" +
                "這兩個空格策略符號分別為匹配區塊的左右兩邊的空格策略"
        },
        excludeFoldersFiles: {
            name: "排除文件夾/文件",
            desc: "該插件將每行解析為一個排除文件夾或文件。例如：DailyNote/, DailyNote/WeekNotes/, DailyNote/test.md"
        },
        fixMacOSContextMenu: {
            name: "修復 MacOS 右鍵菜單光標位置",
            desc: "修復 MacOS 鼠標右鍵呼出菜單時光標跳到下一行的問題 (需要重啟 Obsidian 生效)"
        },
        fixMicrosoftIME: {
            name: "修復微軟輸入法問題",
            desc: "適配舊版微軟輸入法"
        },
        strictLineBreaks: {
            name: "嚴格換行模式回車增強",
            desc: "嚴格換行的設置下，在普通文本行進行一次回車會根據模式產生兩個換行符或者兩個空格和回車"
        },
        enhanceModA: {
            name: "增強 Mod+A 功能",
            desc: "第一次選中當前行，第二次選中當前文本塊，第三次選中全文。"
        },
        collapsePersistentEnter: {
            name: "標題折叠保序",
            desc: "在折叠的同级標題行按回車不會展開，直接添加同級標題行"
        },
        printDebugInfo: {
            name: "在控制台輸出調試資訊",
            desc: "在控制台輸出調試資訊"
        },
        selectionReplaceRule: {
            name: "選中替換規則",
            desc: "用戶定義的選中替換規則"
        },
        deleteRule: {
            name: "刪除規則",
            desc: "規則：用 | 代表光標位置，必須包含光標。提示：使用 | 表示光標位置。"
        },
        convertRule: {
            name: "轉換規則",
            desc: "規則：用 | 代表光標位置，必須包含光標。提示：使用 | 表示光標位置。"
        },
        trigger: {
            name: "觸發器"
        },
        left: {
            name: "左"
        },
        right: {
            name: "右"
        },
        oldPattern: {
            name: "舊模式"
        },
        newPattern: {
            name: "新模式"
        },
        ruleEditModal: {
            addTitle: "新增規則",
            editTitle: "編輯規則",
            fieldType: "類型",
            fieldTrigger: "游標前匹配",
            fieldTriggerSelectKey: "觸發按鍵字符",
            fieldTriggerRight: "游標後匹配",
            fieldReplacement: "替換內容",
            fieldReplacementDescSelectKey: "${SEL}：選中的文本內容，${0:${SEL}}：游標繼續選中。",
            fieldReplacementDescInputDelete: "[[0]]：左側第0捕獲組，[[R1]]：右側第1捕獲組。",
            fieldIsRegex: "正則表達式",
            fieldTriggerMode: "觸發方式",
            fieldScope: "作用域",
            fieldScopeLanguage: "語言（可選）",
            fieldPriority: "優先級",
            fieldDescription: "描述",
            buttonSave: "儲存",
            fieldIsFunction: "函式替換",
            functionHintInputDelete: "參數：leftMatches (string[])、rightMatches (string[])。回傳字串或 undefined 跳過。",
            functionHintSelectKey: "參數：selectionText (string)、key (string)。回傳字串或 undefined 跳過。",
            functionPlaceholder: "// 範例：\nconst d = new Date();\nreturn d.toISOString().slice(0,10) + '$0';",
        },
        ruleType: {
            input: "輸入",
            delete: "刪除",
            selectKey: "選中替換",
        },
    },
    commands: {
        formatArticle: "格式化全文",
        formatSelection: "格式化選中部分/當前行",
        deleteBlankLine: "刪除選中部分/全文的多餘空白行",
        insertCodeblock: "插入代碼塊",
        switchAutoformat: "切換自動格式化開關",
        pasteWithoutFormat: "無格式化粘貼",
        toggleComment: "切換註釋",
        gotoNewLine: "跳到當前行後的新行",
        selectBlock: "選擇當前文本塊",
    },
    headers: {
        main: "Obsidian EasyTyping 插件",
        githubDetail: "詳情見 Github：",
        enhancedEditing: "增強編輯設置",
        customizeEditRule: "自定義編輯轉換規則",
        autoformatSetting: "自動格式化設置",
        detailedSetting: "行內元素間空格",
        customRegexpBlock: "自定義正則區塊",
        excludeFoldersFiles: "指定文件不自動格式化",
        experimentalFeatures: "實驗功能",
        languagePairSection: "語言間空格策略",
        addLanguagePair: "新增語言/符號對：",
        prefixDictSection: "前綴詞典",
        softSpaceSection: "自定義軟空格符號",
        customScriptSection: "自定義語言/符號集",
        spaceStrategyIntro: "空格策略說明：\n無要求：對相關區塊與左右文本沒有空格要求。\n軟空格：對相關區塊與周圍區塊只要求有軟空格（例如當前塊左右臨近文本為標點符號時，不需要再插入真實空格）。\n嚴格空格：當前塊與臨近文本之間嚴格添加真實空格。",
        aboutRegexp: {
            header: "正則表達式相關知識，見 ",
            text: "《阮一峰：正則表達式簡明教程》",
        },
        instructionsRegexp: {
            header: "正則表達式規則使用說明與示例： ",
            text: "自定義正則表達式規則",
        },
        customizeSelectionRule: "自定義選中文本編輯增强規則",
        customizeDeleteRule: "自定義刪除編輯增强規則",
        customizeConvertRule: "自定義編輯轉換規則",
        editSelectionReplaceRule: "編輯選中替換規則",
        builtinRulesSection: "內建規則",
        userRulesSection: "使用者規則",
        deletedRulesSection: "已刪除的內建規則",
        tabs: {
            editEnhance: "編輯增強",
            autoFormat: "自動格式化",
            builtinRules: "內建規則",
            userRules: "自訂規則",
            other: "其他設定",
        },
    },
    dropdownOptions: {
        enterTwice: "兩次回車",
        twoSpace: "加兩個空格",
        mixMode: "混合模式",

        noRequire: "無要求",
        softSpace: "軟空格",
        strictSpace: "嚴格空格",
        dummy: "呆空格",
        smart: "智能空格",
        scopeAll: "全部",
        scopeText: "文本",
        scopeFormula: "公式",
        scopeCode: "程式碼",
        triggerModeAuto: "自動",
        triggerModeTab: "Tab 鍵",
        ruleTypeInput: "輸入",
        ruleTypeDelete: "刪除",
        ruleTypeSelectKey: "選中替換",
    },
    toolTip: {
        switch: "功能開關",
        editRule: "編輯規則",
        removeRule: "刪除規則",
        addRule: "添加規則",
        enableRule: "啟用/停用規則",
        restoreRule: "恢復此規則",
        resetAllRules: "重置內建規則",
        resetSuccess: "內建規則已重置",
    },
    placeHolder: {
        triggerSymbol: "觸發符",
        newLeftSideString: "左邊符號",
        newRightSideString: "右邊符號",
        addRule: "添加規則",
        noticeInvaidTrigger: "無效的觸發符, 觸發符必須是單字符或者是 ——、……",
        noticeWarnTriggerExists: "無效規則! 觸發符 %s 已存在",
        noticeMissingInput: "missing input",
        beforeDelete: "刪除前|",
        newPattern: "觸發規則後字串模式",
        noticeInvaidTriggerPatternContainSymbol: "無效規則, 轉換前模式必須包含代表光標位置的符號 |",
        beforeConvert: "轉換前|",
        noticeInvalidPatternString: "Invalid pattern string!",
    },
    button: {
        update: "更新",
    },
    scriptCategoryLabels: {
        chinese: "中文",
        japanese: "日文",
        korean: "韓文",
        cjk: "中日韓",
        english: "英文",
        digit: "數字",
        russian: "俄文",
        unknown: "未知",
    },
};

export default locale;