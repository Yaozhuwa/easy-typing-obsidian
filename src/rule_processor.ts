import { EditorView } from '@codemirror/view';
import { PluginContext } from './plugin_context';
import { RuleType, TxContext, RuleScope } from './rule_engine';
import { tabstopSpecsToTabstopGroups } from './tabstop';
import { addTabstopsEffect } from './tabstops_state_field';
import { getPosLineType, LineType } from './core';

export function triggerCvtRule(ctx: PluginContext, view: EditorView, cursor_pos: number, changeType: string = 'input.type'): boolean {
	const cvtCtx: TxContext = {
		kind: RuleType.Input,
		docText: view.state.doc.toString(),
		selection: { from: cursor_pos, to: cursor_pos },
		inserted: '',
		changeType: changeType,
		scopeHint: RuleScope.All,
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
	if (ctx.settings.PuncRectify &&
		/[,.?!]/.test(view.state.doc.sliceString(change_from_pos - 1, change_from_pos))) {
		let punc = view.state.doc.sliceString(change_from_pos - 1, change_from_pos)
		if (change_from_pos > 2 && /[^\u4e00-\u9fa5]/.test(view.state.doc.sliceString(change_from_pos - 2, change_from_pos - 1))) { }
		else {
			view.dispatch({
				changes: {
					from: change_from_pos - 1,
					to: change_from_pos,
					insert: ctx.halfToFullSymbolMap.get(punc)
				},
				// selection: { anchor: toB - rule.before.left.length + rule.after.left.length },
				userEvent: "EasyTyping.change"
			})
			return true;
		}
	}
	return false;
}

export function handleEndComposeTypeKey(ctx: PluginContext, event: KeyboardEvent, view: EditorView): void {
	if ((['Enter', 'Process', ' ', 'Shift'].contains(event.key) || /\d/.test(event.key)) &&
		ctx.compose_need_handle) {
		let cursor = view.state.selection.asSingle().main;
		if (cursor.head != cursor.anchor) return;
		let insertedStr = view.state.doc.sliceString(ctx.compose_begin_pos, cursor.anchor);
		// console.log("inserted str", insertedStr);
		ctx.compose_need_handle = false;
		if (triggerCvtRule(ctx, view, cursor.anchor)) return;
		if (triggerPuncRectify(ctx, view, ctx.compose_begin_pos)) return;
		if (ctx.settings.AutoFormat && !ctx.isCurrentFileExclude()){
			if (getPosLineType(view.state, cursor.anchor) != LineType.text) return;
			let changes = ctx.Formater.formatLineOfDoc(view.state, ctx.settings,
				ctx.compose_begin_pos, cursor.anchor, insertedStr);
			if (changes != null) {
				view.dispatch(...changes[0]);
				view.dispatch(changes[1]);
				return;
			}
		}
	}
}
