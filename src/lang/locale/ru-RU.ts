import { enUS } from ".";

// machine translation
const locale: typeof enUS = {
    settings: {
        symbolAutoPair: {
            name: "Автоматическое добавление и удаление символов пара",
            desc: "Добавить автозакрытие и автозакрытие для различных символов, таких как 《》, “”, 「」, 『』, 【】 и т.д."
        },
        selectionReplace: {
            name: "Улучшение замены выделенного текста",
            desc: "Улучшенное редактирование выделенного текста, например, нажатие ￥ → $выделенный текст$, нажатие · → `выделенный текст`, 《 → 《выделенный текст》 и т.д."
        },
        fullWidthToHalfWidth: {
            name: "Конвертация последовательных полноширинных символов в полуширинные",
            desc: "Конвертация последовательных полноширинных символов в полуширинные, например, 。。→ ., ！！→ !, 》》→ >"
        },
        basicInputEnhance: {
            name: "Улучшение базового ввода символов для Obsidian",
            desc: "Улучшение базового ввода для Obsidian, например, 【【| → [[|]], начало с 、→ /, начало с 》→ >, ··| → `|`, `·|` становится кодовым блоком, ￥￥| → $|$"
        },
        codeblockEdit: {
            name: "Улучшение редактирования кодовых блоков",
            desc: "Улучшение редактирования в кодовых блоках (Tab, удаление, вставка, Cmd/Ctrl+A выделение)."
        },
        backspaceEdit: {
            name: "Улучшение удаления",
            desc: "Улучшение удаления пустых элементов списка или пустых строк ссылок."
        },
        tabOut: {
            name: "Tabout",
            desc: "Выйти из встроенного кода или парных символов."
        },
        autoFormatting: {
            name: "Автоформатирование при наборе текста",
            desc: "Включение/выключение автоформатирования текста во время редактирования документа."
        },
        spaceBetweenChineseEnglish: {
            name: "Пробел между китайскими и английскими символами",
            desc: "Вставка пробела между китайскими и английскими символами."
        },
        spaceBetweenChineseNumber: {
            name: "Пробел между китайскими символами и числами",
            desc: "Вставка пробела между китайскими символами и числами."
        },
        spaceBetweenEnglishNumber: {
            name: "Пробел между английскими символами и числами",
            desc: "Вставка пробела между английскими символами и числами."
        },
        deleteSpaceBetweenChinese: {
            name: "Удаление пробела между китайскими символами",
            desc: "Удаление пробелов между китайскими символами."
        },
        capitalizeFirstLetter: {
            name: "Заглавная буква в начале каждого предложения",
            desc: "Преобразование первой буквы каждого предложения в английском в заглавную."
        },
        smartInsertSpace: {
            name: "Интеллектуальная вставка пробела между текстом и пунктуацией",
            desc: "Интеллектуальная вставка пробела между текстом и пунктуацией."
        },
        spaceStrategyInlineCode: {
            name: "Стратегия пробелов между встроенным кодом и текстом",
            desc: "Нет требований: Нет требований к пробелам между этим блоком категории и окружающим текстом. " +
                      "Мягкий пробел: Требуется только мягкий пробел между этим блоком категории и окружающими блоками. " +
                      "Пример мягкого пробела: Если прилегающий текст слева от текущего блока - это полноширинная пунктуация, такая как . , ; ? и т.д., а прилегающий текст справа от текущего блока - это вся полноширинная или полуширинная пунктуация. " +
                      "Строгий пробел: Строгое добавление пробелов между текущим блоком и прилегающим текстом."
        },
        spaceStrategyInlineFormula: {
            name: "Стратегия пробелов между встроенной формулой и текстом",
            desc: "Определение стратегии пробелов между встроенными формулами и текстом."
        },
        spaceStrategyLinkText: {
            name: "Стратегия пробелов между ссылкой и текстом",
            desc: "Определение стратегии пробелов между [[викиссылками]] [markdown-ссылками](...) и текстом."
        },
        userDefinedRegexpSwitch: {
            name: "Переключение пользовательских регулярных выражений",
            desc: "Включение/выключение пользовательских регулярных выражений, предотвращение форматирования и установка стратегии пробелов между совпадающим содержимым и другим текстом."
        },
        userDefinedRegexp: {
            name: "Пользовательское регулярное выражение, одно выражение на строку",
            desc: "Пользовательское регулярное выражение, совпадающее с содержимым, не форматируется, одно выражение на строку, не добавляйте пробелы в конце строки."+
                "Конец каждой строки фиксирован тремя символами: | и двумя символами стратегии пробелов, символы стратегии пробелов - это - = +, которые соответственно обозначают отсутствие требования пробелов (-), мягкие пробелы (=), строгие пробелы (+)."+
                "Эти два символа стратегии пробелов являются стратегией пробелов для левой и правой сторон совпадающего блока соответственно"
        },
        excludeFoldersFiles: {
            name: "Исключить папки/файлы",
            desc: "Этот плагин будет обрабатывать каждую строку как исключаемую папку или файл. Например: DailyNote/, DailyNote/WeekNotes/, DailyNote/test.md"
        },
        fixMacOSContextMenu: {
            name: "Исправление положения курсора контекстного меню MacOS (требуется перезапуск Obsidian)",
            desc: "Исправление проблемы, когда курсор перескакивает на следующую строку при вызове контекстного меню на MacOS (требуется перезапуск Obsidian)."
        },
        fixMicrosoftIME: {
            name: "Исправление проблемы с Microsoft Input Method",
            desc: "Адаптация для старых версий Microsoft Input Method."
        },
        strictLineBreaks: {
            name: "Режим строгих разрывов строк, дважды нажмите Enter",
            desc: "В режиме строгих разрывов строк, однократное нажатие Enter в обычных текстовых строках создаст два разрыва строки."
        },
        puncRectify: {
            name: "Коррекция пунктуации",
            desc: "Автоматическая конвертация английской пунктуации (, . ? !) между китайскими символами в полноширинную пунктуацию при наборе текста (обратимо)."
        },
        printDebugInfo: {
            name: "Вывод отладочной информации в консоль",
            desc: "Вывод отладочной информации в консоль."
        },
        selectionReplaceRule: {
            name: "Правило замены выделенного текста",
            desc: "Пользовательское правило замены выделенного текста"
        },
        deleteRule: {
            name: "Правило удаления",
            desc: "Правило: Используйте | для указания позиции курсора. Подсказка: Использование | для указания позиции курсора."
        },
        convertRule: {
            name: "Правило преобразования",
            desc: "Правило: Используйте | для указания позиции курсора. Подсказка: Использование | для указания позиции курсора."
        },
        trigger: {
            name: "Триггер"
        },
        left: {
            name: "Левый"
        },
        right: {
            name: "Правый"
        },
        oldPattern: {
            name: "Старый шаблон"
        },
        newPattern: {
            name: "Новый шаблон"
        }
    },
    headers: {
        main: "Плагин Obsidian EasyTyping",
        githubDetail: "Подробнее на Github: ",
        enhancedEditing: "Настройка улучшенного редактирования",
        customizeEditRule: "Настройка правила преобразования редактирования",
        autoformatSetting: "Настройка автоформатирования",
        detailedSetting: "Подробная настройка ниже",
        customRegexpBlock: "Блок пользовательских регулярных выражений",
        excludeFoldersFiles: "Исключить папки/файлы",
        experimentalFeatures: "Экспериментальные функции",
        aboutRegexp: {
            header: "Для информации о регулярных выражениях см. ",
            text: "Yifeng Nguyen: Краткое руководство по регулярным выражениям",
        },
        instructionsRegexp: {
            header: "Инструкции и примеры использования правил регулярных выражений: ",
            text:"Настройка пользовательских правил регулярных выражений",
        },
        customizeSelectionRule: "Настройка правила замены выделенного текста",
        customizeDeleteRule: "Настройка правила удаления",
        customizeConvertRule: "Настройка правила преобразования",
        editSelectionReplaceRule: "Редактирование правила замены выделенного текста",
    },
    dropdownOptions: {
        onlyWhenTyping: "Только при наборе текста",
        globally: "Работать глобально",
        noRequire: "Нет требований",
        softSpace: "Мягкий пробел",
        strictSpace: "Строгий пробел",
        dummy: "Фиктивный",
        smart: "Умный"
    },
    toolTip: {
        switch: "Переключить",
        editRule: "Редактировать правило",
        removeRule: "Удалить правило",
        addRule: "Добавить правило",
    },
    placeHolder: {
        triggerSymbol: "Символ триггера",
        newLeftSideString: "Новая строка с левой стороны",
        newRightSideString: "Новая строка с правой стороны",
        addRule: "Добавить правило",
        noticeInvaidTrigger: "Недействительный триггер, триггер должен быть символом длиной 1 или символом ——, ……",
        noticeWarnTriggerExists: "Внимание! Триггер %s уже существует!",
        noticeMissingInput: "Отсутствует ввод",
        beforeDelete: "До удаления",
		newPattern: "Новый шаблон",
        noticeInvaidTriggerPatternContainSymbol: "Недействительный триггер, шаблон должен содержать символ \|, указывающий на позицию курсора",
        beforeConvert: "До преобразования",
        noticeInvalidPatternString:"Недействительная строка шаблона!",
    },
    button: {
        update: "Обновить",
    }
};

export default locale;
