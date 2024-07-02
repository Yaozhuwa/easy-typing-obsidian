import { EditorView, Decoration } from "@codemirror/view";
import { EditorSelection, StateEffect, StateField, Transaction } from "@codemirror/state";
import { TabstopGroup } from "./tabstop";

const addTabstopsEffect = StateEffect.define<TabstopGroup[]>();
const filterTabstopsEffect = StateEffect.define<EditorSelection>();
const removeTabstopEffect = StateEffect.define();
const removeAllTabstopsEffect = StateEffect.define();

export const tabstopsStateField = StateField.define<TabstopGroup[]>({
    create(){
        return [];
    },

    update(value: TabstopGroup[], transaction: Transaction){
        let tabstopGroups = value;
		tabstopGroups.forEach(grp => grp.map(transaction.changes));

		for (const effect of transaction.effects) {
			if (effect.is(addTabstopsEffect)) {
                tabstopGroups = [];
				tabstopGroups.unshift(...effect.value);
			}
			else if (effect.is(filterTabstopsEffect)) {
				// Show next tabstops
                tabstopGroups.forEach((value: TabstopGroup) => {
					value.hideFromEditor();
				})

				const editorSel = effect.value;
                let showGroupIndex = -1;
                for (let i=0; i<tabstopGroups.length; i++) {
                    if (editorSel.eq(tabstopGroups[i].toEditorSelection())) {
                        // tabstopGroups[i].hideFromEditor();
                        showGroupIndex = i+1 < tabstopGroups.length ? i+1 : -1;
                    }
                }
                if (showGroupIndex != -1) {
                    tabstopGroups[showGroupIndex].showFromEditor();
                }
			}
			else if (effect.is(removeTabstopEffect)) {
				tabstopGroups.shift();
			}
			else if (effect.is(removeAllTabstopsEffect)) {
				tabstopGroups = [];
			}
		}


		return tabstopGroups;
    },

    provide: (field) => {
		return EditorView.decorations.of(view => {
			// "Flatten" the array of DecorationSets to produce a single DecorationSet
			const tabstopGroups = view.state.field(field);
            
			const decos = [];

			for (const tabstopGroup of tabstopGroups) {
				if (!tabstopGroup.hidden){
                    console.log('tabstopGroup', tabstopGroup.getDecoRanges())
                    decos.push(...tabstopGroup.getDecoRanges());
                }
			}

			return Decoration.set(decos, true);
		});
	}
});


export function getTabstopGroupsFromView(view: EditorView) {
	const currentTabstopGroups = view.state.field(tabstopsStateField);

	return currentTabstopGroups;
}

export function addTabstops(view: EditorView, tabstopGroups: TabstopGroup[]) {
	view.dispatch({
		effects: [addTabstopsEffect.of(tabstopGroups)],
	});
}

export function filterTabstops(view: EditorView) {
	view.dispatch({
		effects: [filterTabstopsEffect.of(view.state.selection)],
	});
}

export function removeTabstop(view: EditorView) {
	view.dispatch({
		effects: [removeTabstopEffect.of(null)],
	});
}

export function removeAllTabstops(view: EditorView) {
	view.dispatch({
		effects: [removeAllTabstopsEffect.of(null)],
	});
}

export function addTabstopsAndSelect(view: EditorView, tabstopGroups: TabstopGroup[]) {
    addTabstops(view, tabstopGroups);
    tabstopGroups[0].select(view, false);
    filterTabstops(view);
}




export function tidyTabstops(view: EditorView) {
	// Hide (filter out) tabstops equivalent to the editor's current selection
	filterTabstops(view);

	// Clear all tabstop groups if there's just one remaining
	const currentTabstopGroups = getTabstopGroupsFromView(view);

	if (currentTabstopGroups.length === 1) {
		removeAllTabstops(view);
	}
}

export function isInsideATabstop(view: EditorView):boolean {
	const currentTabstopGroups = getTabstopGroupsFromView(view);

	for (const tabstopGroup of currentTabstopGroups) {
		if (tabstopGroup.containsSelection(view.state.selection)) {
			return true;
		}
	}

	return false;
}

export function consumeAndGotoNextTabstop(view: EditorView): boolean {
    // console.log('before-consume', getTabstopGroupsFromView(view))
	// Check whether there are currently any tabstops
	if (getTabstopGroupsFromView(view).length === 0) return false;

	// Remove the tabstop that we're inside of
	removeTabstop(view);

	// Select the next tabstop
	const oldSel = view.state.selection;
	const nextGrp = getTabstopGroupsFromView(view)[0];
	if (!nextGrp) return false;

	// If the old tabstop(s) lie within the new tabstop(s), simply move the cursor
	const shouldMoveToEndpoints = nextGrp.containsSelection(oldSel);
	nextGrp.select(view, shouldMoveToEndpoints);

	// If we haven't moved, go again
	const newSel = view.state.selection;

	if (oldSel.eq(newSel))
		return consumeAndGotoNextTabstop(view);

	// If this was the last tabstop group waiting to be selected, remove it
	tidyTabstops(view);
    // console.log('after-consume', getTabstopGroupsFromView(view))
	return true;
}
