import { EditorView } from '@codemirror/view';
import { PluginContext } from './plugin_context';
import { RuleType, TxContext } from './rule_engine';
import { tabstopSpecsToTabstopGroups } from './tabstop';
import { addTabstopsEffect } from './tabstops_state_field';
import { detectRuleScope } from './syntax';

export function triggerCvtRule(ctx: PluginContext, view: EditorView, cursor_pos: number, changeType: string = 'input.type'): boolean {
	const inputScope = detectRuleScope(view.state, cursor_pos);
	const cvtCtx: TxContext = {
		kind: RuleType.Input,
		docText: view.state.doc.toString(),
		selection: { from: cursor_pos, to: cursor_pos },
		inserted: '',
		changeType: changeType,
		scopeHint: inputScope.scope,
		scopeLanguage: inputScope.language,
		debug: ctx.settings?.debug,
	};
	const cvtResult = ctx.ruleEngine.process(cvtCtx);
	if (cvtResult) {
		const tabstopGroups = tabstopSpecsToTabstopGroups(cvtResult.tabstops);
		if (tabstopGroups.length > 0) {
			view.dispatch({
				changes: {
					from: cvtResult.matchRange.from,
					to: cvtResult.matchRange.to,
					insert: cvtResult.newText,
				},
				selection: tabstopGroups[0].toEditorSelection(),
				effects: [addTabstopsEffect.of(tabstopGroups)],
				userEvent: "EasyTyping.change"
			});
		} else {
			view.dispatch({
				changes: {
					from: cvtResult.matchRange.from,
					to: cvtResult.matchRange.to,
					insert: cvtResult.newText,
				},
				selection: { anchor: cvtResult.cursor },
				userEvent: "EasyTyping.change"
			});
		}
		return true;
	}
	return false;
}

export function triggerPuncRectify(ctx: PluginContext, view: EditorView, change_from_pos: number): boolean {
	if (!ctx.settings.PuncRectify) return false;

	const pos = change_from_pos - 1;
	if (pos < 0) return false;

	const char = view.state.doc.sliceString(pos, pos + 1);
	const fullWidth = ctx.halfToFullSymbolMap.get(char);
	if (!fullWidth) return false;

	// 前一个字符
	const prevChar = pos > 0 ? view.state.doc.sliceString(pos - 1, pos) : '';

	// 判断是否应该转换为全角：
	// 当前一个字符是 CJK (中文/日文/韩文) 或行首/边界时，转换为全角
	const CJK_REGEX = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
	const shouldConvert = !prevChar || CJK_REGEX.test(prevChar);

	if (shouldConvert) {
		view.dispatch({
			changes: {
				from: pos,
				to: pos + 1,
				insert: fullWidth,
			},
			userEvent: "EasyTyping.change"
		});
		return true;
	}
	return false;
}
