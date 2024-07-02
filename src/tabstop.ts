import { ChangeDesc, EditorSelection, SelectionRange } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";


const TABSTOP_DECO_CLASS = "easy-typing-tabstops";
const CURSOR_WIDGET_CLASS = "easy-typing-cursor-widget";

export interface TabstopSpec {
    number: number,
    from: number,
    to: number
}

function getMarkerDecoration(from: number, to: number) {
    const className = `${TABSTOP_DECO_CLASS}`;

    if (from==to){
        return Decoration.widget({
            widget: new CursorWidget(),
            side: 1,
        }).range(from);
    }

    return Decoration.mark({
        inclusive: true,
        class: className,
    }).range(from, to);
}

export class TabstopGroup {
    decos: DecorationSet;
    selections: SelectionRange[];
    hidden: boolean;

    constructor(tabstopSpecs: TabstopSpec[]) {
        // const tabstopSpecsRange = tabstopSpecs.filter(spec => spec.from != spec.to);
        const decos = tabstopSpecs.map(spec => getMarkerDecoration(spec.from, spec.to));
        this.selections = tabstopSpecs.map(spec => EditorSelection.range(spec.from, spec.to));
        this.decos = Decoration.set(decos, true);
        this.hidden = true;
    }

    select(view: EditorView, selectEndpoints: boolean) {
        const sel = this.toEditorSelection();
        const toSelect = selectEndpoints ? getEditorSelectionEndpoints(sel) : sel;

        view.dispatch({
            selection: toSelect,
        })

        this.hideFromEditor();
    }

    toSelectionRanges() {
        return this.selections;
    }

    toEditorSelection() {
        return EditorSelection.create(this.toSelectionRanges());
    }

    containsSelection(selection: EditorSelection) {
        function rangeLiesWithinSelection(range: SelectionRange, sel: SelectionRange[]) {
            for (const selRange of sel) {
                if (selRange.from <= range.from && selRange.to >= range.to) {
                    return true;
                }
            }
            return false;
        }
    
        const tabstopRanges = this.toSelectionRanges();
        let result = true;
    
        for (const range of selection.ranges) {
            if (!rangeLiesWithinSelection(range, tabstopRanges)) {
                result = false;
                break;
            }
        }
        return result;
    }

    hideFromEditor() {
        this.hidden = true;
    }

    showFromEditor() {
        this.hidden = false;
    }

    map(changes: ChangeDesc) {
        this.decos = this.decos.map(changes);
        this.selections = this.selections.map(range => {
            let rangeFrom = changes.mapPos(range.from, -1);
            let rangeTo = changes.mapPos(range.to, 1);
            return EditorSelection.range(rangeFrom, rangeTo);
        });
    }
    
    getDecoRanges() {
        const ranges = [];
        const cur = this.decos.iter();

        while (cur.value != null) {
            if (cur.from != cur.to){
                ranges.push(cur.value.range(cur.from, cur.to));
            }else{
                ranges.push(cur.value.range(cur.from));
            }
            // ranges.push(cur.value.range(cur.from, cur.to));
            cur.next();
        }

        return ranges;
    }
}

export function tabstopSpecsToTabstopGroups(tabstops: TabstopSpec[]):TabstopGroup[] {
    const tabstopsByNumber: {[n: string]: TabstopSpec[]} = {};
    console.log("tabstops", tabstops)

    for (const tabstop of tabstops) {
        const n = String(tabstop.number);

        if (tabstopsByNumber[n]) {
            tabstopsByNumber[n].push(tabstop);
		}
		else {
            tabstopsByNumber[n] = [tabstop];
		}
	}

    const result = [];
    const numbers = Object.keys(tabstopsByNumber);
    numbers.sort((a,b) => parseInt(a) - parseInt(b));
    console.log('tabstopsByNumber', tabstopsByNumber)

    for (const number of numbers) {
        const grp = new TabstopGroup(tabstopsByNumber[number]);
        result.push(grp);
    }

	return result;
}

export function getEditorSelectionEndpoints(sel: EditorSelection) {
    const endpoints = sel.ranges.map(range => EditorSelection.range(range.to, range.to));

    return EditorSelection.create(endpoints);
}

class CursorWidget extends WidgetType {

    eq(widget: WidgetType): boolean {
        return true;
    }

    toDOM(view: EditorView): HTMLElement {
        const cursorEl = document.createElement("span");
        cursorEl.className = `${CURSOR_WIDGET_CLASS}`;
        cursorEl.textContent = '|';
        return cursorEl;
    }
}
