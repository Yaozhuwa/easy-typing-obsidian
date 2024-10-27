import { enUS } from ".";

const locale: typeof enUS = {
    settings: {
        symbolAutoPair: {
            name: "符號自動配對及刪除配對",
            desc: "增加多種符號配對輸入，配對刪除，如《》, “”, 「」, 『』, 【】等"
        },
        selectionReplace: {
            name: "選中文本替換增强",
            desc: "選中文本情況下的編輯增强，按￥→$選中的文本$, 按·→`選中的文本`，《 → 《選中的文本》等等"
        },
        fullWidthToHalfWidth: {
            name: "連續輸入全角符號轉半角符號",
            desc: "連續輸入全角符號轉半角，。。→ .，！！→ !， 》》→ >"
        },
        basicInputEnhance: {
            name: "Obsidian 的基礎符號輸入增强",
            desc: "Obsidian 的基礎輸入增强，如【【| → [[|]]，句首的、→ /，句首的》→ >，··| → `|`， `·|` 變成代碼塊，￥￥| → $|$"
        },
        codeblockEdit: {
            name: "增强代碼塊編輯",
            desc: "增强代碼塊內的編輯（Cmd/Ctrl+A 選中、Tab、刪除、粘貼）"
        },
        tabOut: {
            name: "Tab 键光标跳出",
            desc: "Tab 键跳出行內代碼塊或配對符號塊"
        },
        autoFormatting: {
            name: "輸入時自動格式化",
            desc: "是否在編輯文檔時自動格式化文本，自動格式化的總開關"
        },
        spaceBetweenChineseEnglish: {
            name: "中文與英文之間的空格",
            desc: "在中文和英文之間插入空格，可取消"
        },
        spaceBetweenChineseNumber: {
            name: "中文與數字之間的空格",
            desc: "在中文和數字之間插入空格，可取消"
        },
        spaceBetweenEnglishNumber: {
            name: "英文與數字之間的空格",
            desc: "在英文和數字之間插入空格，可取消"
        },
        deleteSpaceBetweenChinese: {
            name: "刪除中文字符間的空格",
            desc: "去除中文字符之間的空格，不可取消"
        },
        capitalizeFirstLetter: {
            name: "句首字母大寫",
            desc: "英文每個句首字母大寫，可取消"
        },
        smartInsertSpace: {
            name: "智能插入空格",
            desc: "在文本和標點之間智能插入空格"
        },
        spaceStrategyInlineCode: {
            name: "行內代碼和文本之間的空格策略",
            desc: "無要求：對本類別塊與左右文本沒有空格的要求，" +
                "軟空格：對本類別塊與周圍區塊只要求有軟空格，軟空格如當前塊左邊的臨近文本為。，；？等全角標點，當前塊右邊的臨近文本為所有全半角標點，" +
                "嚴格空格：當前塊與臨近文本之間嚴格添加空格。"
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
            name: "嚴格換行模式下按兩次回車",
            desc: "嚴格換行的設置下，在普通文本行進行一次回車會產生兩個換行符"
        },
        puncRectify: {
            name: "標點矫正",
            desc: "僅在輸入過程中，中文間的英文標點（,.?!）自動轉換為全角（可取消）"
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
        }
    },
    headers: {
        main: "Obsidian EasyTyping 插件",
        githubDetail: "詳情見 Github：",
        enhancedEditing: "增強編輯設置",
        customizeEditRule: "自定義編輯轉換規則",
        autoformatSetting: "自動格式化設置",
        detailedSetting: "詳細設置如下",
        customRegexpBlock: "自定義正則區塊",
        excludeFoldersFiles: "指定文件不自動格式化",
        experimentalFeatures: "實驗功能",
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
    },
    dropdownOptions: {
        onlyWhenTyping: "輸入時生效",
        globally: "全局生效",
        noRequire: "無要求",
        softSpace: "軟空格",
        strictSpace: "嚴格空格",
        dummy: "呆空格",
        smart: "智能空格"
    },
    toolTip: {
        switch: "功能開關",
        editRule: "編輯規則",
        removeRule: "刪除規則",
        addRule: "添加規則",
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
    }
};

export default locale;