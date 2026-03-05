import type { Locale } from './types';

const locale: Locale = {
    settings: {
        smartPaste: {
            name: "스마트 붙여넣기",
            desc: "목록이나 인용 블록에서 붙여넣을 때 적절한 들여쓰기와 목록/인용 기호를 자동으로 추가합니다."
        },
        codeblockEdit: {
            name: "코드 블록 편집 강화",
            desc: "코드 블록 내 편집 기능 강화 (Tab, 삭제, 붙여넣기, Cmd/Ctrl+A 선택)"
        },
        backspaceEdit: {
            name: "스마트 백스페이스",
            desc: "빈 목록 항목이나 빈 인용 줄에서 백스페이스 기능을 향상시킵니다."
        },
        tabOut: {
            name: "Tab으로 쌍 기호 밖으로 이동",
            desc: "Tab 키를 눌러 【】, （）, 《》, 따옴표, 인라인 코드 등의 쌍 기호 밖으로 커서를 이동합니다."
        },
        autoFormatting: {
            name: "입력 시 자동 서식",
            desc: "문서 편집 중 텍스트 자동 서식 지정을 켜거나 끕니다."
        },
        languagePairSpacing: {
            name: "언어 쌍 간격",
            desc: "서로 다른 언어/기호 쌍 사이의 자동 간격 규칙을 정의합니다."
        },
        prefixDictionary: {
            name: "접두사 사전",
            desc: "쉼표, 공백 또는 줄바꿈으로 구분합니다. 단어 또는 /정규식/을 지원합니다. 매칭된 토큰에는 공백이 삽입되지 않으며, 입력 중인 접두사도 공백 삽입이 억제됩니다."
        },
        softSpaceSymbols: {
            leftName: "사용자 정의 왼쪽 소프트 스페이스 기호",
            leftDesc: "일반적인 전각 문장부호는 내장되어 있습니다. 여기에 추가 기호를 추가하세요 (예: -).",
            rightName: "사용자 정의 오른쪽 소프트 스페이스 기호",
            rightDesc: "일반적인 전각 문장부호는 내장되어 있습니다. 여기에 추가 기호를 추가하세요 (예: -)."
        },
        customScriptCategories: {
            name: "사용자 정의 문자 범주",
            desc: "간격 전략을 위한 사용자 정의 언어 또는 기호 집합을 추가합니다.",
            namePlaceholder: "이름",
            patternPlaceholder: "문자 클래스 패턴"
        },

        capitalizeFirstLetter: {
            name: "문장 첫 글자 대문자화",
            desc: "영어 문장의 첫 글자를 대문자로 변환합니다."
        },
        spaceStrategyInlineCode: {
            name: "인라인 코드와 텍스트 사이 간격 전략",
            desc: "인라인 코드와 텍스트 사이의 간격 전략을 정의합니다."
        },
        spaceStrategyInlineFormula: {
            name: "인라인 수식과 텍스트 사이 간격 전략",
            desc: "인라인 수식과 텍스트 사이의 간격 전략을 정의합니다."
        },
        spaceStrategyLinkText: {
            name: "링크와 텍스트 사이 간격 전략",
            desc: "[[위키링크]] [마크다운 링크](...) 와 텍스트 사이의 간격 전략을 정의합니다."
        },
        userDefinedRegexpSwitch: {
            name: "사용자 정의 정규식 스위치",
            desc: "사용자 정의 정규식을 활성화하여 매칭된 콘텐츠의 서식을 방지하고, 매칭된 콘텐츠와 다른 텍스트 사이의 간격 전략을 설정합니다."
        },
        userDefinedRegexp: {
            name: "사용자 정의 정규식, 한 줄에 하나씩",
            desc: "사용자 정의 정규식으로 매칭된 콘텐츠는 서식이 적용되지 않습니다. 한 줄에 하나씩 작성하며, 줄 끝에 공백을 추가하지 마세요." +
                "각 줄의 마지막 3자는 |와 두 개의 간격 전략 기호로 고정됩니다. 간격 전략 기호는 - = +이며, 각각 간격 불필요(-), 소프트 스페이스(=), 엄격한 스페이스(+)를 의미합니다." +
                "이 두 간격 전략 기호는 매칭 블록의 왼쪽과 오른쪽의 간격 전략입니다."
        },
        excludeFoldersFiles: {
            name: "제외 폴더/파일",
            desc: "이 플러그인은 각 줄을 제외 폴더 또는 파일로 파싱합니다. 예: DailyNote/, DailyNote/WeekNotes/, DailyNote/test.md"
        },
        fixMacOSContextMenu: {
            name: "macOS 컨텍스트 메뉴 커서 위치 수정 (Obsidian 재시작 필요)",
            desc: "macOS에서 컨텍스트 메뉴 호출 시 커서가 다음 줄로 이동하는 문제를 수정합니다 (Obsidian 재시작 필요)."
        },
        fixMicrosoftIME: {
            name: "Microsoft 입력기 문제 수정",
            desc: "이전 버전의 Microsoft 입력기에 대한 호환성 처리."
        },
        strictLineBreaks: {
            name: "엄격한 줄바꿈 모드",
            desc: "엄격한 줄바꿈 모드에서 일반 텍스트 줄에서 Enter를 한 번 누르면 두 번의 줄바꿈 또는 두 개의 공백과 Enter가 생성됩니다."
        },
        enhanceModA: {
            name: "Ctrl/Cmd+A 선택 강화",
            desc: "첫 번째: 현재 줄 선택, 두 번째: 현재 텍스트 블록 선택, 세 번째: 전체 텍스트 선택."
        },
        collapsePersistentEnter: {
            name: "접힌 상태에서 Enter 유지",
            desc: "접힌 제목에서 Enter를 누르면 접힘을 펼치지 않고 아래에 같은 수준의 제목을 삽입합니다."
        },
        printDebugInfo: {
            name: "콘솔에 디버그 정보 출력",
            desc: "콘솔에 디버그 정보를 출력합니다."
        },
        selectionReplaceRule: {
            name: "선택 대체 규칙",
            desc: "사용자 정의 선택 대체 규칙"
        },
        deleteRule: {
            name: "삭제 규칙",
            desc: "규칙: |로 커서 위치를 표시합니다. 팁: |를 사용하여 커서 위치를 나타냅니다."
        },
        convertRule: {
            name: "변환 규칙",
            desc: "규칙: |로 커서 위치를 표시합니다. 팁: |를 사용하여 커서 위치를 나타냅니다."
        },
        trigger: {
            name: "트리거"
        },
        left: {
            name: "왼쪽"
        },
        right: {
            name: "오른쪽"
        },
        oldPattern: {
            name: "이전 패턴"
        },
        newPattern: {
            name: "새 패턴"
        },
        ruleEditModal: {
            addTitle: "규칙 추가",
            editTitle: "규칙 편집",
            fieldType: "유형",
            fieldTrigger: "커서 앞 매칭",
            fieldTriggerSelectKey: "트리거 키",
            fieldTriggerRight: "커서 뒤 매칭",
            fieldReplacement: "대체 내용",
            fieldReplacementDescSelectKey: "${SEL}: 선택된 텍스트, ${0:${SEL}}: 텍스트를 선택합니다.",
            fieldReplacementDescInputDelete: "[[0]]: 왼쪽 0번째 캡처 그룹, [[R1]]: 오른쪽 1번째 캡처 그룹.",
            fieldIsRegex: "정규식 사용",
            fieldTriggerMode: "트리거 방식",
            fieldScope: "범위",
            fieldScopeLanguage: "언어 (선택사항)",
            fieldPriority: "우선순위",
            fieldPriorityDesc: "숫자가 작을수록 우선순위가 높음, 기본값 100",
            fieldDescription: "설명",
            buttonSave: "저장",
            invalidRegex: "유효하지 않은 정규식",
            fieldIsFunction: "함수 대체",
            functionHintInputDelete: "인수: leftMatches (string[]), rightMatches (string[]). 문자열 또는 undefined를 반환하여 건너뜁니다.",
            functionHintSelectKey: "인수: selectionText (string), key (string). 문자열 또는 undefined를 반환하여 건너뜁니다.",
            functionPlaceholder: "// 예시:\nconst d = new Date();\nreturn d.toISOString().slice(0,10) + '$0';",
        },
        ruleType: {
            input: "입력",
            delete: "삭제",
            selectKey: "선택 대체",
        },
    },
    commands: {
        formatArticle: "현재 문서 서식 지정",
        formatSelection: "선택한 텍스트 또는 현재 줄 서식 지정",
        deleteBlankLine: "선택 영역 또는 전체 문서의 빈 줄 삭제",
        insertCodeblock: "코드 블록 삽입",
        switchAutoformat: "자동 서식 전환",
        pasteWithoutFormat: "서식 없이 붙여넣기",
        toggleComment: "주석 전환",
        gotoNewLine: "현재 줄 다음에 새 줄로 이동",
        selectBlock: "현재 텍스트 블록 선택",
    },
    headers: {
        main: "Obsidian EasyTyping 플러그인",
        githubDetail: "자세한 내용은 Github를 참조하세요: ",
        enhancedEditing: "편집 강화 설정",
        customizeEditRule: "편집 변환 규칙 사용자 정의",
        autoformatSetting: "자동 서식 설정",
        detailedSetting: "인라인 요소 간 간격",
        customRegexpBlock: "사용자 정의 정규식 블록",
        excludeFoldersFiles: "제외 폴더/파일",
        experimentalFeatures: "실험적 기능",
        languagePairSection: "언어 쌍 간격",
        addLanguagePair: "새 언어/기호 쌍 추가:",
        prefixDictSection: "접두사 사전",
        softSpaceSection: "소프트 스페이스 기호",
        customScriptSection: "사용자 정의 문자 범주",
        spaceStrategyIntro: "간격 전략 설명:\n불필요: 이 범주 블록과 주변 텍스트 사이에 간격이 필요 없습니다.\n소프트 스페이스: 이 범주 블록과 주변 블록 사이에 소프트 스페이스만 필요합니다 (예: 인접 텍스트가 문장부호인 경우 실제 공백이 추가되지 않음).\n엄격한 스페이스: 현재 블록과 인접 텍스트 사이에 엄격하게 실제 공백을 추가합니다.",
        aboutRegexp: {
            header: "정규식에 대한 자세한 내용은 다음을 참조하세요: ",
            text: "정규식 간결 튜토리얼",
        },
        instructionsRegexp: {
            header: "정규식 규칙 사용 안내 및 예시: ",
            text: "정규식 규칙 사용자 정의",
        },
        customizeSelectionRule: "선택 대체 규칙 사용자 정의",
        customizeDeleteRule: "삭제 규칙 사용자 정의",
        customizeConvertRule: "변환 규칙 사용자 정의",
        editSelectionReplaceRule: "선택 대체 규칙 편집",
        builtinRulesSection: "내장 규칙",
        userRulesSection: "사용자 규칙",
        deletedRulesSection: "삭제된 내장 규칙",
        tabs: {
            editEnhance: "편집 강화",
            autoFormat: "자동 서식",
            builtinRules: "내장 규칙",
            userRules: "사용자 규칙",
            other: "기타",
        },
    },
    dropdownOptions: {
        enterTwice: "Enter 두 번",
        twoSpace: "공백 두 개",
        mixMode: "혼합 모드",

        noRequire: "불필요",
        softSpace: "소프트 스페이스",
        strictSpace: "엄격한 스페이스",
        dummy: "더미",
        smart: "스마트",
        scopeAll: "전체",
        scopeText: "텍스트",
        scopeFormula: "수식",
        scopeCode: "코드",
        triggerModeAuto: "자동",
        triggerModeTab: "Tab",
        ruleTypeInput: "입력",
        ruleTypeDelete: "삭제",
        ruleTypeSelectKey: "선택 대체",
    },
    toolTip: {
        switch: "스위치",
        editRule: "규칙 편집",
        removeRule: "규칙 삭제",
        addRule: "규칙 추가",
        enableRule: "규칙 활성화/비활성화",
        restoreRule: "이 규칙 복원",
        resetAllRules: "모든 내장 규칙 초기화",
        resetSuccess: "내장 규칙이 성공적으로 초기화되었습니다",
        exportRules: "규칙 내보내기",
        importRules: "규칙 가져오기",
        noRulesToExport: "내보낼 사용자 규칙이 없습니다",
        importSuccess: "%d개 규칙을 가져왔으며, %d개 중복 규칙을 건너뛰었습니다",
        importInvalidJson: "잘못된 파일: 유효한 JSON이 아닙니다",
        importNoRules: "파일에서 가져올 수 있는 규칙이 없습니다",
    },
    placeHolder: {
        triggerSymbol: "트리거 기호",
        newLeftSideString: "새 왼쪽 문자열",
        newRightSideString: "새 오른쪽 문자열",
        addRule: "규칙 추가",
        noticeInvaidTrigger: "유효하지 않은 트리거, 트리거는 길이 1의 기호 또는 ——, …… 이어야 합니다",
        noticeWarnTriggerExists: "경고! 트리거 %s 이(가) 이미 존재합니다!",
        noticeMissingInput: "입력이 누락되었습니다",
        beforeDelete: "삭제 전",
        newPattern: "새 패턴",
        noticeInvaidTriggerPatternContainSymbol: "유효하지 않은 트리거, 패턴에 커서 위치를 나타내는 기호 |가 포함되어야 합니다",
        beforeConvert: "변환 전",
        noticeInvalidPatternString: "유효하지 않은 패턴 문자열입니다!",
    },
    button: {
        update: "업데이트",
    },
    scriptCategoryLabels: {
        chinese: "중국어",
        japanese: "일본어",
        korean: "한국어",
        cjk: "CJK",
        english: "영어",
        digit: "숫자",
        russian: "러시아어",
        unknown: "알 수 없음",
    },
    builtinRuleDescriptions: {
        'builtin-autopair-input': '전각 괄호/따옴표 입력 시 자동 완성',
        'builtin-autopair-jump': '닫는 쌍 기호를 입력할 때 자동으로 건너뛰어 중복 방지',
        'builtin-autopair-delete': '전각 괄호/따옴표 삭제 시 쌍으로 삭제',
        'builtin-conv-backtick': '중간점 ·· 연속 입력 시 인라인 코드로 변환',
        'builtin-conv-codeblock': '인라인 코드 내에서 · 입력 시 코드 블록으로 업그레이드',
        'builtin-conv-formula': '￥/$ 조합으로 인라인 또는 블록 수식으로 변환',
        'builtin-conv-linestart': '줄 시작에서 》 → 인용 표시, 、 → 슬래시',
        'builtin-conv-hw2fw': 'CJK 문자 뒤 반각 문장부호를 전각으로 변환',
        'builtin-fw2hw-double': '동일한 전각 문장부호 두 번 입력 시 반각으로 변환',
        'builtin-del-inline-formula': '인라인 수식 $...$ 쌍 삭제',
        'builtin-del-highlight': '하이라이트 ==...== 쌍 삭제',
        'builtin-del-block-formula': '블록 수식 $$...$$ 쌍 삭제',
        'builtin-del-codeblock': '빈 코드 블록 빠른 삭제',
        'builtin-del-wikilink': '위키링크 및 임베드(![[]])  빠른 삭제',
        'builtin-sel-wrap-backtick': '· 로 선택 텍스트를 백틱으로 감싸기',
        'builtin-sel-wrap-symbols': '선택한 텍스트를 【/¥/￥로 []/$$로 감싸기',
        'builtin-sel-wrap-quotes': '선택한 텍스트를 전각 따옴표로 감싸기',
        'builtin-sel-wrap-cjk-brackets': '선택한 텍스트를 《》 또는 （） 괄호로 감싸기',
        'builtin-quote-convert': '> 또는 》를 Markdown 인용 표시로 변환',
        'builtin-quote-space': '인용 표시 > 뒤에 자동으로 공백 삽입',
    },
};

export default locale;
