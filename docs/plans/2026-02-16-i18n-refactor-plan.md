# i18n 重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一两套独立的本地化系统，添加 TypeScript 类型安全、缓存和 fallback 机制。

**Architecture:** 创建 `Locale` 接口定义完整结构，统一 `getLocale()` 入口函数用 `moment.locale()` 检测语言 + 缓存 + en-US fallback。删除 main.ts 的 `getCommandNameMap()` 和 settings.ts 的手动 locale 选择，所有消费者改用 `getLocale()`。

**Tech Stack:** TypeScript, Obsidian API (`moment`)

---

### Task 1: 创建 Locale 类型定义

**Files:**
- Create: `src/lang/locale/types.ts`

**Step 1: 分析 en-US.ts 导出完整 Locale 接口**

从 `en-US.ts` 的对象结构提取接口。当前结构有 7 个顶级分类：`settings`、`headers`、`dropdownOptions`、`toolTip`、`placeHolder`、`button`。新增 `commands` 分类（9 个命令名）。

**Step 2: 创建 `src/lang/locale/types.ts`**

```typescript
export interface Locale {
    settings: {
        selectionReplace: { name: string; desc: string };
        fullWidthToHalfWidth: { name: string; desc: string };
        basicInputEnhance: { name: string; desc: string };
        codeblockEdit: { name: string; desc: string };
        backspaceEdit: { name: string; desc: string };
        tabOut: { name: string; desc: string };
        autoFormatting: { name: string; desc: string };
        spaceBetweenChineseEnglish: { name: string; desc: string };
        spaceBetweenChineseNumber: { name: string; desc: string };
        spaceBetweenEnglishNumber: { name: string; desc: string };
        quoteSpace: { name: string; desc: string };
        deleteSpaceBetweenChinese: { name: string; desc: string };
        capitalizeFirstLetter: { name: string; desc: string };
        textPunctuationSpace: { name: string; desc: string };
        spaceStrategyInlineCode: { name: string; desc: string };
        spaceStrategyInlineFormula: { name: string; desc: string };
        spaceStrategyLinkText: { name: string; desc: string };
        userDefinedRegexpSwitch: { name: string; desc: string };
        userDefinedRegexp: { name: string; desc: string };
        excludeFoldersFiles: { name: string; desc: string };
        fixMacOSContextMenu: { name: string; desc: string };
        fixMicrosoftIME: { name: string; desc: string };
        strictLineBreaks: { name: string; desc: string };
        enhanceModA: { name: string; desc: string };
        collapsePersistentEnter: { name: string; desc: string };
        puncRectify: { name: string; desc: string };
        printDebugInfo: { name: string; desc: string };
        selectionReplaceRule: { name: string; desc: string };
        deleteRule: { name: string; desc: string };
        convertRule: { name: string; desc: string };
        trigger: { name: string };
        left: { name: string };
        right: { name: string };
        oldPattern: { name: string };
        newPattern: { name: string };
        ruleEditModal: {
            addTitle: string;
            editTitle: string;
            fieldType: string;
            fieldTrigger: string;
            fieldTriggerRight: string;
            fieldReplacement: string;
            fieldIsRegex: string;
            fieldTriggerMode: string;
            fieldScope: string;
            fieldPriority: string;
            fieldDescription: string;
            buttonSave: string;
            fieldIsFunction: string;
            functionHintInputDelete: string;
            functionHintSelectKey: string;
            functionPlaceholder: string;
        };
        ruleType: {
            input: string;
            delete: string;
            selectKey: string;
        };
    };
    commands: {
        formatArticle: string;
        formatSelection: string;
        deleteBlankLine: string;
        insertCodeblock: string;
        switchAutoformat: string;
        pasteWithoutFormat: string;
        toggleComment: string;
        gotoNewLine: string;
        selectBlock: string;
    };
    headers: {
        main: string;
        githubDetail: string;
        enhancedEditing: string;
        customizeEditRule: string;
        autoformatSetting: string;
        detailedSetting: string;
        customRegexpBlock: string;
        excludeFoldersFiles: string;
        experimentalFeatures: string;
        aboutRegexp: { header: string; text: string };
        instructionsRegexp: { header: string; text: string };
        customizeSelectionRule: string;
        customizeDeleteRule: string;
        customizeConvertRule: string;
        editSelectionReplaceRule: string;
        builtinRulesSection: string;
        userRulesSection: string;
        deletedRulesSection: string;
        tabs: {
            editEnhance: string;
            autoFormat: string;
            builtinRules: string;
            userRules: string;
            other: string;
        };
    };
    dropdownOptions: {
        enterTwice: string;
        twoSpace: string;
        mixMode: string;
        onlyWhenTyping: string;
        globally: string;
        noRequire: string;
        softSpace: string;
        strictSpace: string;
        dummy: string;
        smart: string;
        scopeAll: string;
        scopeText: string;
        scopeFormula: string;
        scopeCode: string;
        triggerModeAuto: string;
        triggerModeTab: string;
        ruleTypeInput: string;
        ruleTypeDelete: string;
        ruleTypeSelectKey: string;
    };
    toolTip: {
        switch: string;
        editRule: string;
        removeRule: string;
        addRule: string;
        enableRule: string;
        restoreRule: string;
        resetAllRules: string;
    };
    placeHolder: {
        triggerSymbol: string;
        newLeftSideString: string;
        newRightSideString: string;
        addRule: string;
        noticeInvaidTrigger: string;
        noticeWarnTriggerExists: string;
        noticeMissingInput: string;
        beforeDelete: string;
        newPattern: string;
        noticeInvaidTriggerPatternContainSymbol: string;
        beforeConvert: string;
        noticeInvalidPatternString: string;
    };
    button: {
        update: string;
    };
}
```

**Step 3: 构建验证**

Run: `npm run build`
Expected: PASS（新文件无消费者，不影响现有代码）

**Step 4: Commit**

```bash
git add src/lang/locale/types.ts
git commit -m "feat(i18n): add Locale type definition"
```

---

### Task 2: 给 4 个 locale 文件添加 commands + 类型标注

**Files:**
- Modify: `src/lang/locale/en-US.ts`
- Modify: `src/lang/locale/zh-CN.ts`
- Modify: `src/lang/locale/zh-TW.ts`
- Modify: `src/lang/locale/ru-RU.ts`

**Step 1: 修改 en-US.ts**

添加 `import type { Locale } from './types'`，将 `const locale = {` 改为 `const locale: Locale = {`，在 `settings` 之后添加 `commands` 分类。

命令名来源于 `main.ts:257-267` 的 `command_name_map_en`：

```typescript
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
```

**Step 2: 修改 zh-CN.ts**

改 `import { enUS } from "."` 为 `import type { Locale } from './types'`，将 `const locale: typeof enUS = {` 改为 `const locale: Locale = {`。

添加 commands（来自 `main.ts:282-291` 的 `command_name_map_zh`）：

```typescript
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
```

**Step 3: 修改 zh-TW.ts**

同样改为 `import type { Locale } from './types'` + `const locale: Locale = {`。

添加 commands（来自 `main.ts:270-279` 的 `command_name_map_zh_TW`）：

```typescript
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
```

**Step 4: 修改 ru-RU.ts**

同样改为 `import type { Locale } from './types'` + `const locale: Locale = {`。

添加 commands（来自 `main.ts:294-303` 的 `command_name_map_ru`）：

```typescript
commands: {
    formatArticle: "Форматировать текущую статью",
    formatSelection: "Форматировать выделенный текст или текущую строку",
    deleteBlankLine: "Удалить пустые строки в выделенном или всей статье",
    insertCodeblock: "Вставить блок кода с/без выделением",
    switchAutoformat: "Переключить автоформатирование",
    pasteWithoutFormat: "Вставить без форматирования",
    toggleComment: "Переключить комментарий",
    gotoNewLine: "Перейти к новой строке после текущей",
    selectBlock: "Выбрать текущий текстовый блок",
},
```

**Step 5: 构建验证**

Run: `npm run build`
Expected: PASS。如果任何 locale 文件缺少 key 或 key 类型不匹配，TypeScript 会在编译期报错。

**Step 6: Commit**

```bash
git add src/lang/locale/en-US.ts src/lang/locale/zh-CN.ts src/lang/locale/zh-TW.ts src/lang/locale/ru-RU.ts
git commit -m "feat(i18n): add commands category and Locale type to all locale files"
```

---

### Task 3: 重写 index.ts 为 getLocale()

**Files:**
- Modify: `src/lang/locale/index.ts`

**Step 1: 重写 `src/lang/locale/index.ts`**

替换全部内容为统一的 `getLocale()` + 缓存 + fallback：

```typescript
import { moment } from 'obsidian';
import enUS from './en-US';
import zhCN from './zh-CN';
import zhTW from './zh-TW';
import ruRU from './ru-RU';
import type { Locale } from './types';

const localeMap: Record<string, Locale> = {
    'en': enUS,
    'zh': zhCN,
    'zh-cn': zhCN,
    'zh-tw': zhTW,
    'ru': ruRU,
};

let cached: Locale | null = null;

export function getLocale(): Locale {
    if (cached) return cached;
    const lang = moment.locale().toLowerCase();
    cached = localeMap[lang] ?? enUS;
    return cached;
}

export function resetLocaleCache(): void {
    cached = null;
}

export type { Locale } from './types';
```

关键点：
- 统一使用 `moment.locale()` 检测，key 全小写匹配
- `zh-cn` 和 `zh` 都映射到 `zhCN`
- `zh-tw` 正确映射到 `zhTW`（修复当前 main.ts 中 `zh-TW` 大小写不匹配的 bug）
- 未知语言 fallback 到英文
- 导出 default import 改为 named import（`import enUS from './en-US'` 而非 `export { default as enUS }`）

**注意：** 这一步会破坏 settings.ts 中的 `import { enUS, ruRU, zhCN, zhTW } from './lang/locale'`，所以 Task 4 必须紧跟着改。但由于 zh-CN.ts 和 zh-TW.ts 已不再 `import { enUS } from "."`（Task 2 中已改为 `import type { Locale } from './types'`），所以 index.ts 的改动不会造成循环依赖。

**Step 2: 暂不构建**（需先完成 Task 4 settings.ts 适配，否则编译会失败）

---

### Task 4: 适配 settings.ts

**Files:**
- Modify: `src/settings.ts:1-4` — 修改 import
- Modify: `src/settings.ts:100` — 删除模块级 `var locale = enUS`
- Modify: `src/settings.ts:112-124` — display() 中改用 `getLocale()`

**Step 1: 修改 import**

将 `src/settings.ts:4`：
```typescript
import { enUS, ruRU, zhCN, zhTW } from './lang/locale';
```
改为：
```typescript
import { getLocale } from './lang/locale';
import type { Locale } from './lang/locale';
```

**Step 2: 删除模块级 locale 变量**

删除 `src/settings.ts:100`：
```typescript
var locale = enUS;
```

**Step 3: 修改 display() 方法**

将 `src/settings.ts:112-125` 中的语言检测逻辑：
```typescript
display(): void {
    const { containerEl } = this;

    // 根据系统语言选择对应的语言包
    if (moment.locale() == "zh" || moment.locale() == "zh-cn") {
        locale = zhCN;
    }
    else if (moment.locale().toLowerCase() == "zh-tw"){
        locale = zhTW;
    }
    else if (moment.locale() == "ru") {
        locale = ruRU;
    }
```
替换为：
```typescript
display(): void {
    const { containerEl } = this;
    const locale = getLocale();
```

**Step 4: 处理 locale 作用域**

`locale` 从模块级变量变为 `display()` 的局部变量后，需要确认所有使用 `locale` 的地方能正确访问到它。

当前代码中 `locale` 被以下方法使用：
- `display()` 及其调用的 `buildEditEnhanceTab()`、`buildAutoFormatTab()`、`buildBuiltinRulesSection()`、`buildUserRulesSection()`、`buildOtherTab()` — 这些方法直接在 `display()` 中调用，但它们不是闭包，**它们是类的方法**，所以需要访问 `locale`。
- `buildRuleItem()`、`getRuleTypeLabel()`、`getRuleTypeCls()`
- `RuleEditModal.onOpen()` 和 `refreshVisibility()` 中也用到 `locale`

解决方案：将 `locale` 改为在每个方法内调用 `const locale = getLocale()`。由于 `getLocale()` 有缓存，多次调用没有性能问题。

具体改动列表：
- `display()` 已在 Step 3 中处理
- `buildEditEnhanceTab(el)` — 方法开头加 `const locale = getLocale();`
- `buildAutoFormatTab(el)` — 方法开头加 `const locale = getLocale();`
- `buildBuiltinRulesSection(el)` — 方法开头加 `const locale = getLocale();`
- `buildUserRulesSection(el)` — 方法开头加 `const locale = getLocale();`
- `buildRuleItem(container, rule, isBuiltin)` — 方法开头加 `const locale = getLocale();`
- `getRuleTypeLabel(type)` — 方法开头加 `const locale = getLocale();`
- `buildOtherTab(el)` — 方法开头加 `const locale = getLocale();`
- `RuleEditModal.onOpen()` — 方法开头加 `const locale = getLocale();`
- `RuleEditModal.refreshVisibility(contentEl)` — 方法开头加 `const locale = getLocale();`

注：`import { moment } from 'obsidian'` 已存在于 settings.ts:2，无需额外导入。

**Step 5: 构建验证**

Run: `npm run build`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lang/locale/index.ts src/settings.ts
git commit -m "refactor(i18n): unify locale detection in settings.ts via getLocale()"
```

---

### Task 5: 适配 main.ts

**Files:**
- Modify: `src/main.ts:26` — 删除 `lang` 属性
- Modify: `src/main.ts:106-107` — 删除 `this.lang` 和 `getCommandNameMap()` 调用
- Modify: `src/main.ts:109-202` — 命令注册改用 `locale.commands.*`
- Modify: `src/main.ts:254-318` — 删除 `getCommandNameMap()` 方法

**Step 1: 添加 getLocale import**

在 `src/main.ts` 顶部 imports 中添加：
```typescript
import { getLocale } from './lang/locale';
```

**Step 2: 删除 `lang` 属性**

删除 `src/main.ts:26`：
```typescript
lang: string;
```

**Step 3: 修改 onload() 中的命令注册**

将 `src/main.ts:106-107`：
```typescript
this.lang = window.localStorage.getItem('language');
let command_name_map = this.getCommandNameMap();
```
替换为：
```typescript
const locale = getLocale();
```

然后将所有 `command_name_map.get("xxx")` 替换为对应的 `locale.commands.yyy`：

| 原来 | 替换为 |
|------|--------|
| `command_name_map.get("format_article")` | `locale.commands.formatArticle` |
| `command_name_map.get("select_block")` | `locale.commands.selectBlock` |
| `command_name_map.get("format_selection")` | `locale.commands.formatSelection` |
| `command_name_map.get("delete_blank_line")` | `locale.commands.deleteBlankLine` |
| `command_name_map.get("goto_new_line_after_cur_line")` | `locale.commands.gotoNewLine` |
| `command_name_map.get("insert_codeblock")` | `locale.commands.insertCodeblock` |
| `command_name_map.get("switch_autoformat")` | `locale.commands.switchAutoformat` |
| `command_name_map.get("paste_wo_format")` | `locale.commands.pasteWithoutFormat` |
| `command_name_map.get("toggle_comment")` | `locale.commands.toggleComment` |

**Step 4: 删除 getCommandNameMap() 方法**

删除 `src/main.ts:254-318` 整个 `getCommandNameMap()` 方法（65 行）。

**Step 5: 构建验证**

Run: `npm run build`
Expected: PASS

**Step 6: Commit**

```bash
git add src/main.ts
git commit -m "refactor(i18n): replace getCommandNameMap with locale.commands in main.ts"
```

---

### Task 6: 清理 + 从 PluginContext 移除 lang

**Files:**
- Verify: `src/plugin_context.ts` — 确认无 `lang` 属性（已无）
- Verify: 全局搜索无残留的 `getCommandNameMap`、`command_name_map`、`import { enUS` 等

**Step 1: 全局搜索残留引用**

搜索以下字符串确认已清理干净：
- `getCommandNameMap` — 应为 0 结果
- `command_name_map` — 应为 0 结果
- `import { enUS` 或 `import { zhCN` 或 `import { ruRU` 或 `import { zhTW` — 应为 0 结果
- `var locale = enUS` — 应为 0 结果
- `localStorage.getItem('language')` — 应为 0 结果（main.ts 中已删除）

**Step 2: 最终构建验证**

Run: `npm run build`
Expected: PASS

**Step 3: Commit（如有清理改动）**

```bash
git add -A
git commit -m "chore(i18n): final cleanup of removed locale references"
```

---

## 验证清单

- [ ] `npm run build` 通过
- [ ] 所有 4 个 locale 文件都有 `commands` 分类（9 个 key）
- [ ] 所有 locale 文件都标注 `Locale` 类型（编译期检查完整性）
- [ ] `getLocale()` 统一语言检测，修复繁体中文 `zh-tw` vs `zh-TW` 大小写 bug
- [ ] settings.ts 不再直接 import 各 locale 文件
- [ ] main.ts 不再有 `getCommandNameMap()`、`lang` 属性、`localStorage` 语言检测
- [ ] 未知语言 fallback 到英文
