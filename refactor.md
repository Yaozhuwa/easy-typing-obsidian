## Easy Typing 插件重构规划（refactor.md）

本文件是对当前插件的一次“架构级重构”路线图，目标是让代码更清晰、可维护、可扩展，并完善多语言（i18n）。你可以按阶段实施，逐步迁移，保证平滑过渡。

---

### 1. 目标与设计原则
- 精简 `src/main.ts`：入口只负责“初始化/装配/注册”，不承载业务细节。
- 统一“规则引擎”：将“基础编辑增强”与“自定义规则转换”合并为同一套执行模型（预置规则 + 用户规则）。
- 自定义规则增强：支持触发模式（自动/按键/快捷键）、可配置触发键位与作用域（文本/列表/引用/代码等）。
- 设置面板现代化：规则备注、拖拽排序、分组、搜索、预览、导入/导出。
- 自动格式化改为“管线/策略”架构，替换超长函数，提升可测性与可维护性。
- 多语言重构：统一键名、类型安全、参数化/复数支持、运行时切换与回退。

---

### 2. 总体架构与目录建议
把代码分层，职责单一、边界清晰：

- `src/integrations/`：与 Obsidian/CodeMirror6 的事件与扩展装配（如 EditorExtensions、Transaction/ViewUpdate 桥）。
- `src/app/`：命令注册、应用服务装配。
- `src/app/services/`：核心服务（规则引擎、格式化管线、粘贴/退格/回车增强、注释切换等）。
- `src/domain/rules/`：规则模型、仓库（预置+用户）、匹配与执行器。
- `src/domain/formatters/`：格式化“管线/策略”（按场景组合阶段）。
- `src/ui/settings/`：设置面板、规则编辑器、拖拽列表、预览组件。
- `src/i18n/`：多语言资源与 i18n 服务（详见第 7 节）。
- `src/shared/`：工具函数、公共类型、常量与错误定义。

“薄入口” `src/main.ts` 只做：
1) 加载设置 → 2) 构建依赖容器 → 3) 注册编辑器扩展/命令 → 4) 加载设置面板。

---

### 3. 统一规则引擎（合并基础增强与自定义规则）
把“基础编辑增强”改写为“预置规则（preset）”，与“用户规则（user）”共用同一数据模型与执行流程。

建议的数据模型：

```ts
export type RuleTriggerMode = 'auto' | 'onKey' | 'onTab' | 'onShortcut';
export type RuleScope = 'text' | 'quote' | 'list' | 'code' | 'table';

export interface ConvertRule {
  id: string;
  name: string;
  description?: string;           // 备注
  enabled: boolean;
  source: 'preset' | 'user';
  triggerMode: RuleTriggerMode;   // 触发模式
  triggerKeys?: string[];         // 如 ['Tab']、['Mod-/']
  scope: RuleScope[];             // 生效范围
  priority: number;               // 排序优先级（配合拖拽）
  match: { left: string; right: string; isRegex: boolean };
  action: {
    replace: string;              // 支持 [[0]] 占位符
    tabstops?: { from: number; to: number; index: number }[];
    cursorOffsetStrategy?: 'center' | 'end' | number;
  };
  conflicts?: string[];           // 互斥规则 id（可选）
  examples?: { before: string; after: string }[];
}
```

执行流程（管线思想）：
- 事件 → 触发过滤（根据 triggerMode/triggerKeys/IME compose 结束）→ 作用域过滤（scope）→ 左右匹配（正则/字面）→ 生成替换文本与 Tabstops → 合并变更 → 一次 dispatch。

性能要点：
- 只在“变更附近片段”匹配；命中规则可短路；合并 changes 减少多次 dispatch。

---

### 4. 触发机制设计
- 自动触发（auto）：输入/粘贴后自动尝试规则。
- 按键触发（onKey/onTab）：仅在指定按键时触发（可配置）。
- 快捷键触发（onShortcut）：为某条规则或规则组注册命令并绑定快捷键。
- IME 合成（compose）收敛：在 compose 结束时统一尝试规则与格式化，避免重复计算与闪烁。

---

### 5. 设置面板重构（现代、美观、可拖拽）
功能与交互：
- 规则列表虚拟化（大列表也流畅）。
- 搜索/筛选（按触发模式/作用域/来源）。
- 分组显示（预置/用户），支持展开/折叠。
- 规则卡片：启用开关、名称、备注、触发模式切换、作用域选择、快捷键设置、拖拽排序、上移/下移。
- 预览/测试：输入 before，实时显示 after；正则即时校验（错误提示）。
- 导入/导出：支持只导出用户规则；JSON 格式校验。

技术实现建议：
- 拖拽用 `SortableJS` 或同类库；
- 组件化拆分：规则列表（虚拟滚动）、规则编辑器（对话框）、搜索条、分组头；
- 一致的主题风格与暗色模式适配（遵循 Obsidian SettingTab 视觉）。

---

### 6. 自动格式化重构（替换超长函数）
将“自动格式化”改为“多阶段管线 + 策略”的组合，每个阶段职责单一、纯函数化，便于测试：

建议阶段：
1) 场景识别：表格/代码块/列表/引用/正文 → 决定策略组合；
2) 标点修正：中英混排（与你现有的 half→full 逻辑统一）；
3) 前缀/缩进：列表、引用延续与对齐；
4) 空格规范：中英文、数字、链接等边界；
5) 行内代码/代码块特殊处理；
6) 空行规则：与“删除空白行”策略对齐；
7) 变更合并：统一 dispatch。

粘贴格式化与输入后格式化复用同一管线，避免重复逻辑。

---

### 7. 多语言（i18n）重构方案
现状问题：键名零散、混用硬编码文本与资源、缺少类型与占位符支持，难以维护。

目标：统一的、可类型检查、可参数化、可回退的 i18n 体系。

目录与文件：
- `src/i18n/index.ts`：i18n 服务（加载语言、切换、格式化、回退）。
- `src/i18n/locales/en-US.ts`
- `src/i18n/locales/zh-CN.ts`
- `src/i18n/locales/zh-TW.ts`
- `src/i18n/locales/ru-RU.ts`

键名规范：
- 命名空间.模块.语义，如：
  - `command.format_article`
  - `settings.rules.add`
  - `settings.rules.triggerMode.auto`
  - `notice.autoformat_on`

类型安全：
- 在 `index.ts` 中导出 `t(key, params?)`，通过类型映射限制合法键名；
- 可在构建时生成 `keys.d.ts` 类型（基于 locale 对象），实现 IDE 自动提示；
- 占位符采用简单模板：`{name}`，内部用 `format(message, params)` 替换（后续可升级 ICU MessageFormat）。

运行时：
- 语言来源优先级：用户设置 > Obsidian 语言 > 浏览器/系统语言；
- 回退链：`zh-TW → zh-CN → en-US`（示例）；
- 支持热切换：切换语言后，刷新 SettingTab 与命令名称（如需，重新注册命令名或使用动态 name getter）。

落地要点：
- 把 `main.ts` 和 UI 中的硬编码文本替换为 `t('...')`；
- `getCommandNameMap()` 合并到 i18n 服务，由 `t('command.xxx')` 直接提供；
- 设置面板所有 label/placeholder/helpText 使用 i18n；
- 为预置规则也本地化“显示名/描述”（规则数据与文案解耦：规则 id 固定，显示名走 i18n）。

质量保障：
- 脚本检查：对齐各语言的键集合（缺失/多余键报错）；
- 运行时报错时回退到默认语言并输出控制台警告；
- 文案提取与校验：简单 Node 脚本扫描 `t('...')` 收集键名，核对 locale 文件。

---

### 8. 兼容与迁移策略
- 先保留现有行为，逐步用新引擎接管个别“基础增强”条目（灰度迁移）。
- 将旧的 `userConvertRulesStrList` 映射为新 `ConvertRule`（默认 auto + scope=['text']）；
- 预置规则以 `source='preset'` 存储，用户可禁用但不可删除；
- 提供“重置预置规则”“仅导出用户规则”的设置项。

---

### 9. 数据模型与设置迁移
- 新增 `settings.version`；编写迁移器：
  - v1 → v2：将 `[before, after]` 结构迁移为 `ConvertRule`；
  - 填充默认字段（triggerMode、scope、priority 等）。
- 导入/导出：稳定的 JSON schema，向后兼容。

---

### 10. 测试与性能
- 单元测试：规则匹配/替换、Tabstops 生成、compose 结束行为；格式化阶段纯函数；i18n t() 的键名与占位符校验。
- 基准测试：长文粘贴、列表/引用大段编辑、IME 输入；记录规则命中耗时。
- 调试模式：统一从“引擎层/管线层”输出日志（事件类型、命中规则 id、耗时）。

---

### 11. 分阶段实施计划
阶段 0（瘦身入口）
- 新建 `integrations/app/ui` 目录与空实现；
- main.ts 改为装配/注册，功能不变。

阶段 1（规则引擎 MVP）
- 引入 `RuleEngine` + `RuleRepository`；
- 迁移 1-2 条“基础增强”为预置规则，验证触发/作用域/短路。

阶段 2（规则统一）
- 迁移全部“基础增强”为预置规则；
- 用户规则接入统一模型（暂时复用旧 UI）。

阶段 3（设置面板重构）
- 新 UI：规则列表/编辑器/拖拽/预览/导入导出；
- 支持规则备注、排序与搜索。

阶段 4（格式化管线）
- 拆分超长函数为多阶段策略；
- 粘贴与输入格式化共用管线；覆盖测试。

阶段 5（i18n 重构）
- 上线 `src/i18n`，替换硬编码文案；
- 为命令名/设置项/规则显示名接入 t()；
- 加入键一致性检查脚本。

阶段 6（清理与打磨）
- 移除旧路径与重复逻辑；
- 补充边界测试与性能验证。

---

### 12. 关键接口与伪代码（示例）

规则引擎入口：
```ts
// app/services/RuleEngine.ts
export class RuleEngine {
  constructor(private readonly repo: RuleRepository) {}

  apply(ctx: TxContext): EngineResult {
    const rules = this.repo.getActiveRulesFor(ctx)
      .sort((a, b) => b.priority - a.priority);

    const changes: ChangeSpec[] = [];
    for (const rule of rules) {
      if (!this.triggerMatch(rule, ctx)) continue;
      if (!this.scopeMatch(rule, ctx)) continue;
      const match = this.tryMatch(rule, ctx);
      if (!match) continue;
      const change = this.applyRule(rule, match, ctx);
      if (change) {
        changes.push(change);
        if (ctx.options?.shortCircuit) break; // 可配置短路
      }
    }
    return { changes };
  }
}
```

编辑器集成（瘦适配层）：
```ts
// integrations/obsidian.ts
export function buildPluginContainer(plugin: Plugin) {
  const ruleRepo = new RuleRepository(/* 预置 + 用户 */);
  const ruleEngine = new RuleEngine(ruleRepo);
  const formatPipeline = new FormatPipeline(/* 策略集合 */);
  const i18n = createI18nService(plugin); // t()

  const integrations = new EditorIntegrations(plugin.app, {
    onTransaction: (ctx) => ruleEngine.apply(ctx),
    onPaste: (ctx) => formatPipeline.onPaste(ctx),
    onComposeEnd: (ctx) => ruleEngine.apply(ctx),
  });

  return { ruleEngine, formatPipeline, integrations, ruleRepo, i18n };
}
```

i18n 服务（要点）：
```ts
// i18n/index.ts
import enUS from './locales/en-US';
import zhCN from './locales/zh-CN';
import zhTW from './locales/zh-TW';
import ruRU from './locales/ru-RU';

type Locales = typeof enUS; // 基准类型

const locales = { 'en-US': enUS, 'zh-CN': zhCN, 'zh-TW': zhTW, 'ru-RU': ruRU };

export function createI18nService(plugin: Plugin) {
  let cur = detectInitialLang(plugin);
  function t<K extends keyof Locales>(key: K, params?: Record<string, string | number>) {
    const msg = (locales[cur] as any)[key] ?? (locales['en-US'] as any)[key] ?? key;
    return format(msg, params);
  }
  function setLang(lang: keyof typeof locales) { cur = lang; /* 刷新 UI*/ }
  return { t, setLang, get lang(){ return cur; } };
}
```

---

### 13. 附录：规则导入/导出 JSON 示例
```json
{
  "version": 2,
  "rules": [
    {
      "id": "preset.quote.space",
      "name": "引用后自动空格",
      "description": "在 > 后补一个空格",
      "enabled": true,
      "source": "preset",
      "triggerMode": "auto",
      "scope": ["quote"],
      "priority": 100,
      "match": { "left": "r/(?<=^|\\n)(>+)", "right": "r/\u0020?", "isRegex": true },
      "action": { "replace": "[[0]] " }
    }
  ]
}
```

---

如需，我可以先为“阶段 0/1”产出最小骨架文件与空实现，帮助你快速起步，并在迁移过程中提供针对性的单元测试样例与脚本。 


