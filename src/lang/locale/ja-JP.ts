import type { Locale } from './types';

const locale: Locale = {
    settings: {
        smartPaste: {
            name: "スマート貼り付け",
            desc: "リストや引用ブロック内で貼り付ける際、適切なインデントとリスト/引用マーカーを自動的に追加します。"
        },
        codeblockEdit: {
            name: "コードブロック編集の強化",
            desc: "コードブロック内の編集を改善します（Tab、削除、貼り付け、Cmd/Ctrl+A 選択）。"
        },
        backspaceEdit: {
            name: "スマートバックスペース",
            desc: "空のリスト項目や引用行でのバックスペース機能を向上させます。"
        },
        tabOut: {
            name: "Tabでペア記号の外へ移動",
            desc: "Tab キーを押して【】、（）、《》、引用符、インラインコードなどのペア記号の外へカーソルを移動します。"
        },
        autoFormatting: {
            name: "入力時の自動書式設定",
            desc: "ドキュメント編集中のテキスト自動書式設定を切り替えます。"
        },
        languagePairSpacing: {
            name: "言語ペアスペーシング",
            desc: "異なる言語/記号ペア間の自動スペーシングルールを定義します。"
        },
        prefixDictionary: {
            name: "接頭辞辞書",
            desc: "カンマ、スペース、改行で区切ります。単語または /正規表現/ に対応。マッチしたトークンにはスペースが挿入されず、入力中の接頭辞もスペース挿入が抑制されます。"
        },
        softSpaceSymbols: {
            leftName: "カスタム左側ソフトスペース記号",
            leftDesc: "一般的な全角句読点は内蔵されています。ここに追加の記号を追加してください（例：-）。",
            rightName: "カスタム右側ソフトスペース記号",
            rightDesc: "一般的な全角句読点は内蔵されています。ここに追加の記号を追加してください（例：-）。"
        },
        customScriptCategories: {
            name: "カスタム文字カテゴリ",
            desc: "スペーシング戦略用のカスタム言語または記号セットを追加します。",
            namePlaceholder: "名前",
            patternPlaceholder: "文字クラスパターン"
        },

        capitalizeFirstLetter: {
            name: "文頭の大文字化",
            desc: "英語の各文の最初の文字を大文字にします。"
        },
        spaceStrategyInlineCode: {
            name: "インラインコードとテキスト間のスペーシング戦略",
            desc: "インラインコードとテキスト間のスペーシング戦略を定義します。"
        },
        spaceStrategyInlineFormula: {
            name: "インライン数式とテキスト間のスペーシング戦略",
            desc: "インライン数式とテキスト間のスペーシング戦略を定義します。"
        },
        spaceStrategyLinkText: {
            name: "リンクとテキスト間のスペーシング戦略",
            desc: "[[ウィキリンク]] [マークダウンリンク](...) とテキスト間のスペーシング戦略を定義します。"
        },
        userDefinedRegexpSwitch: {
            name: "ユーザー定義正規表現スイッチ",
            desc: "カスタム正規表現を有効にし、マッチしたコンテンツの書式設定を防止し、マッチしたコンテンツと他のテキスト間のスペーシング戦略を設定します。"
        },
        userDefinedRegexp: {
            name: "ユーザー定義正規表現（1行に1つ）",
            desc: "ユーザー定義の正規表現で、マッチしたコンテンツは書式設定されません。1行に1つの式を記述し、行末にスペースを追加しないでください。" +
                "各行の末尾3文字は | と2つのスペーシング戦略記号で固定されます。スペーシング戦略記号は - = + で、それぞれスペース不要(-)、ソフトスペース(=)、厳密スペース(+)を意味します。" +
                "これら2つのスペーシング戦略記号は、マッチブロックの左右のスペーシング戦略です。"
        },
        excludeFoldersFiles: {
            name: "除外フォルダ/ファイル",
            desc: "このプラグインは各行を除外フォルダまたはファイルとして解析します。例：DailyNote/、DailyNote/WeekNotes/、DailyNote/test.md"
        },
        fixMacOSContextMenu: {
            name: "macOS コンテキストメニューのカーソル位置を修正（Obsidianの再起動が必要）",
            desc: "macOS でコンテキストメニューを呼び出した際にカーソルが次の行にジャンプする問題を修正します（Obsidianの再起動が必要）。"
        },
        fixMicrosoftIME: {
            name: "Microsoft IME の問題を修正",
            desc: "旧バージョンの Microsoft IME に対応します。"
        },
        strictLineBreaks: {
            name: "厳密改行モード",
            desc: "厳密改行モードでは、通常のテキスト行で Enter を1回押すと、2つの改行または2つのスペースと Enter が生成されます。"
        },
        enhanceModA: {
            name: "Ctrl/Cmd+A 選択の強化",
            desc: "1回目：現在の行を選択、2回目：現在のテキストブロックを選択、3回目：全テキストを選択。"
        },
        collapsePersistentEnter: {
            name: "折りたたみ時のEnter動作維持",
            desc: "折りたたまれた見出しで Enter を押すと、折りたたみを展開せずに下に同レベルの見出しを挿入します。"
        },
        printDebugInfo: {
            name: "コンソールにデバッグ情報を出力",
            desc: "コンソールにデバッグ情報を出力します。"
        },
        selectionReplaceRule: {
            name: "選択置換ルール",
            desc: "ユーザー定義の選択置換ルール"
        },
        deleteRule: {
            name: "削除ルール",
            desc: "ルール：| でカーソル位置を示します。ヒント：| を使用してカーソル位置を表します。"
        },
        convertRule: {
            name: "変換ルール",
            desc: "ルール：| でカーソル位置を示します。ヒント：| を使用してカーソル位置を表します。"
        },
        trigger: {
            name: "トリガー"
        },
        left: {
            name: "左"
        },
        right: {
            name: "右"
        },
        oldPattern: {
            name: "旧パターン"
        },
        newPattern: {
            name: "新パターン"
        },
        ruleEditModal: {
            addTitle: "ルールを追加",
            editTitle: "ルールを編集",
            fieldType: "タイプ",
            fieldTrigger: "カーソル前マッチ",
            fieldTriggerSelectKey: "トリガーキー",
            fieldTriggerRight: "カーソル後マッチ",
            fieldReplacement: "置換内容",
            fieldReplacementDescSelectKey: "${SEL}: 選択されたテキスト、${0:${SEL}}: テキストを選択します。",
            fieldReplacementDescInputDelete: "[[0]]: 左側第0キャプチャグループ、[[R1]]: 右側第1キャプチャグループ。",
            fieldIsRegex: "正規表現",
            fieldTriggerMode: "トリガー方式",
            fieldScope: "スコープ",
            fieldScopeLanguage: "言語（任意）",
            fieldPriority: "優先度",
            fieldPriorityDesc: "数値が小さいほど優先度が高い、デフォルト100",
            fieldDescription: "説明",
            buttonSave: "保存",
            invalidRegex: "無効な正規表現",
            fieldIsFunction: "関数置換",
            functionHintInputDelete: "引数: leftMatches (string[])、rightMatches (string[])。文字列または undefined を返してスキップ。",
            functionHintSelectKey: "引数: selectionText (string)、key (string)。文字列または undefined を返してスキップ。",
            functionPlaceholder: "// 例:\nconst d = new Date();\nreturn d.toISOString().slice(0,10) + '$0';",
        },
        ruleType: {
            input: "入力",
            delete: "削除",
            selectKey: "選択置換",
        },
    },
    commands: {
        formatArticle: "現在の記事を書式設定",
        formatSelection: "選択したテキストまたは現在の行を書式設定",
        deleteBlankLine: "選択範囲または記事全体の空白行を削除",
        insertCodeblock: "コードブロックを挿入",
        switchAutoformat: "自動書式を切り替え",
        pasteWithoutFormat: "書式なしで貼り付け",
        toggleComment: "コメントを切り替え",
        gotoNewLine: "現在の行の後に新しい行へ移動",
        selectBlock: "現在のテキストブロックを選択",
    },
    headers: {
        main: "Obsidian EasyTyping プラグイン",
        githubDetail: "詳細は Github をご覧ください：",
        enhancedEditing: "編集強化設定",
        customizeEditRule: "編集変換ルールのカスタマイズ",
        autoformatSetting: "自動書式設定",
        detailedSetting: "インライン要素間のスペーシング",
        customRegexpBlock: "カスタム正規表現ブロック",
        excludeFoldersFiles: "除外フォルダ/ファイル",
        experimentalFeatures: "実験的機能",
        languagePairSection: "言語ペアスペーシング",
        addLanguagePair: "新しい言語/記号ペアを追加：",
        prefixDictSection: "接頭辞辞書",
        softSpaceSection: "ソフトスペース記号",
        customScriptSection: "カスタム文字カテゴリ",
        spaceStrategyIntro: "スペーシング戦略の説明：\n不要：このカテゴリブロックと周囲のテキスト間にスペーシングは不要です。\nソフトスペース：このカテゴリブロックと周囲のブロック間にソフトスペースのみ必要です（例：隣接テキストが句読点の場合、実際のスペースは追加されません）。\n厳密スペース：現在のブロックと隣接テキスト間に厳密に実際のスペースを追加します。",
        aboutRegexp: {
            header: "正規表現についての詳細は以下を参照してください：",
            text: "正規表現の簡潔なチュートリアル",
        },
        instructionsRegexp: {
            header: "正規表現ルールの使用方法と例：",
            text: "正規表現ルールのカスタマイズ",
        },
        customizeSelectionRule: "選択置換ルールのカスタマイズ",
        customizeDeleteRule: "削除ルールのカスタマイズ",
        customizeConvertRule: "変換ルールのカスタマイズ",
        editSelectionReplaceRule: "選択置換ルールの編集",
        builtinRulesSection: "組み込みルール",
        userRulesSection: "ユーザールール",
        deletedRulesSection: "削除された組み込みルール",
        tabs: {
            editEnhance: "編集強化",
            autoFormat: "自動書式",
            builtinRules: "組み込みルール",
            userRules: "ユーザールール",
            other: "その他",
        },
    },
    dropdownOptions: {
        enterTwice: "Enter 2回",
        twoSpace: "スペース2つ",
        mixMode: "ミックスモード",

        noRequire: "不要",
        softSpace: "ソフトスペース",
        strictSpace: "厳密スペース",
        dummy: "ダミー",
        smart: "スマート",
        scopeAll: "すべて",
        scopeText: "テキスト",
        scopeFormula: "数式",
        scopeCode: "コード",
        triggerModeAuto: "自動",
        triggerModeTab: "Tab",
        ruleTypeInput: "入力",
        ruleTypeDelete: "削除",
        ruleTypeSelectKey: "選択置換",
    },
    toolTip: {
        switch: "スイッチ",
        editRule: "ルールを編集",
        removeRule: "ルールを削除",
        addRule: "ルールを追加",
        enableRule: "ルールの有効化/無効化",
        restoreRule: "このルールを復元",
        resetAllRules: "すべての組み込みルールをリセット",
        resetSuccess: "組み込みルールが正常にリセットされました",
        exportRules: "ルールをエクスポート",
        importRules: "ルールをインポート",
        noRulesToExport: "エクスポートするユーザールールがありません",
        importSuccess: "%d件のルールをインポートし、%d件の重複をスキップしました",
        importInvalidJson: "無効なファイル：有効なJSONではありません",
        importNoRules: "ファイルにインポート可能なルールが見つかりません",
    },
    placeHolder: {
        triggerSymbol: "トリガー記号",
        newLeftSideString: "新しい左側文字列",
        newRightSideString: "新しい右側文字列",
        addRule: "ルールを追加",
        noticeInvaidTrigger: "無効なトリガーです。トリガーは長さ1の記号または ——、…… である必要があります",
        noticeWarnTriggerExists: "警告！トリガー %s は既に存在します！",
        noticeMissingInput: "入力が不足しています",
        beforeDelete: "削除前",
        newPattern: "新しいパターン",
        noticeInvaidTriggerPatternContainSymbol: "無効なトリガーです。パターンにはカーソル位置を示す記号 | が含まれている必要があります",
        beforeConvert: "変換前",
        noticeInvalidPatternString: "無効なパターン文字列です！",
    },
    button: {
        update: "更新",
    },
    scriptCategoryLabels: {
        chinese: "中国語",
        japanese: "日本語",
        korean: "韓国語",
        cjk: "CJK",
        english: "英語",
        digit: "数字",
        russian: "ロシア語",
        unknown: "不明",
    },
    builtinRuleDescriptions: {
        'builtin-autopair-input': '全角括弧/引用符の入力時に自動補完',
        'builtin-autopair-jump': '閉じペア記号の入力時に自動スキップして重複を防止',
        'builtin-autopair-delete': '全角括弧/引用符の削除時にペアごと削除',
        'builtin-conv-backtick': '中点 ·· の連続入力でインラインコードに変換',
        'builtin-conv-codeblock': 'インラインコード内で · を入力するとコードブロックにアップグレード',
        'builtin-conv-formula': '￥/$ の組み合わせでインラインまたはブロック数式に変換',
        'builtin-conv-linestart': '行頭の 》 → 引用マーカー、、 → スラッシュ',
        'builtin-conv-hw2fw': 'CJK文字の後の半角句読点を全角に変換',
        'builtin-fw2hw-double': '同じ全角句読点を2回入力すると半角に変換',
        'builtin-del-inline-formula': 'インライン数式 $...$ のペアを削除',
        'builtin-del-highlight': 'ハイライト ==...== のペアを削除',
        'builtin-del-block-formula': 'ブロック数式 $$...$$ のペアを削除',
        'builtin-del-codeblock': '空のコードブロックをすばやく削除',
        'builtin-del-wikilink': 'ウィキリンクと埋め込み(![[]])をすばやく削除',
        'builtin-sel-wrap-symbols': '選択テキストを【/¥/￥で []/$$で囲む',
        'builtin-sel-wrap-quotes': '選択テキストを全角引用符で囲む',
        'builtin-sel-wrap-cjk-brackets': '選択テキストを《》または（）括弧で囲む',
        'builtin-quote-convert': '> または 》を Markdown 引用マーカーに変換',
        'builtin-quote-space': '引用マーカー > の後にスペースを自動挿入',
    },
};

export default locale;
