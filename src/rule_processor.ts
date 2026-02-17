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


