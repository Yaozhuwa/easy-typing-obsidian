# i18n 重构设计

## 目标

统一两套独立的本地化系统（settings.ts 的 locale 对象 + main.ts 的 getCommandNameMap），添加 TypeScript 类型安全和 fallback 机制。

## 现状问题

1. **双系统并行** — settings.ts 用 locale 文件 + `moment.locale()` 检测；main.ts 用手写 4 个 Map + `localStorage` 检测
2. **语言检测不一致** — `moment.locale()` 返回 `zh-tw`（小写），`localStorage` 匹配 `zh-TW`（大小写混合），导致繁体中文用户命令名可能显示英文
3. **无类型安全** — locale 对象无 TypeScript 类型定义，缺失 key 无编译期提醒
4. **无 fallback** — 缺失 key 直接显示 undefined
5. **重复代码** — 9 个命令名 × 4 语言 = 36 个硬编码字符串在 main.ts 中

## 方案：统一 locale + TypeScript 类型

### 1. Locale 类型定义 — `src/lang/locale/types.ts`

新建 TypeScript 接口，覆盖 locale 对象的完整结构：

```typescript
export interface Locale {
    settings: { /* ~27 个 setting 条目 */ };
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
    headers: { ... };
    dropdownOptions: { ... };
    toolTip: { ... };
    placeHolder: { ... };
    button: { ... };
}
```

每个 locale 文件添加 `const locale: Locale = { ... }`，编译期检查所有 key 完整性。

### 2. 统一 getLocale() — `src/lang/locale/index.ts`

重写为统一入口，取代各消费者自行检测语言：

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
```

- 统一用 `moment.locale()`，key 全小写匹配
- 首次调用后缓存，`resetLocaleCache()` 留作安全阀
- 未知语言 fallback 到英文

### 3. 消费者适配

**main.ts：**
- 删除 `getCommandNameMap()` 方法（65 行）和 `lang` 属性
- 命令注册改为 `getLocale().commands.formatArticle` 等

**settings.ts：**
- 删除 `import { enUS, ruRU, zhCN, zhTW }` 和模块级 `var locale` 及 if/else 检测
- 改为 `import { getLocale } from './lang/locale'`，在 display() 中 `const locale = getLocale()`

**4 个 locale 文件：**
- 各添加 `commands` 分类（9 个 key）
- 添加 `import type { Locale } from './types'` 和类型标注

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lang/locale/types.ts` | 新建，Locale 接口 |
| `src/lang/locale/index.ts` | 重写为 getLocale() + 缓存 |
| `src/lang/locale/en-US.ts` | 添加 commands + Locale 类型标注 |
| `src/lang/locale/zh-CN.ts` | 同上 |
| `src/lang/locale/zh-TW.ts` | 同上 |
| `src/lang/locale/ru-RU.ts` | 同上 |
| `src/main.ts` | 删除 getCommandNameMap + lang，改用 locale.commands |
| `src/settings.ts` | 删除手动 locale 选择，改用 getLocale() |

## 迁移顺序

每步保证 `npm run build` 通过，单独 commit。

| 步骤 | 改动 | 原因 |
|------|------|------|
| 1 | 创建 `types.ts` | 后续文件依赖类型定义 |
| 2 | 给 4 个 locale 文件添加 commands + 类型标注 | 补充命令名数据 |
| 3 | 重写 `index.ts` 为 getLocale() | 统一入口 |
| 4 | 适配 settings.ts | 改用 getLocale() |
| 5 | 适配 main.ts | 删除 getCommandNameMap，改用 locale.commands |
| 6 | 清理 | 删除未使用的导入和代码 |
