/**
 * Text formatting functions extracted from formatLine.
 * Each function processes text content within an InlinePart of type 'text'.
 */

import { buildPairRegexps, classifyChar, ScriptCategory, CustomScriptDef } from './script_category';
import { PrefixDictionary } from './prefix_dictionary';
import { SpaceState } from '../core';
import { isParamDefined } from '../utils';

export interface LanguagePair {
    a: ScriptCategory | string;
    b: ScriptCategory | string;
}

export interface TextFormatContext {
    content: string;
    curCh: number;       // cursor position in the whole line
    prevCh: number | undefined;
    offset: number;      // character offset of this part's start in the line
}

// ──────────── Capitalization ────────────

/**
 * Capitalize the first letter of the line's first text part.
 * Only applies when typing (prevCh is defined) and the target char
 * falls within the editing range [prevCh, curCh).
 */
export function capitalizeFirstLetter(
    ctx: TextFormatContext,
    isFirstPart: boolean,
    isCursorInPart: boolean,
): TextFormatContext {
    if (!isFirstPart) return ctx;

    const { content, prevCh, curCh } = ctx;
    const regFirstSentence = /^\s*(?:\- (?:\[[x ]\] )?)?"?(?:\*{1,3}|_{1,3}|==|~~)?[a-z\u0401\u0451\u0410-\u044f]/g;
    const regHeaderSentence = /^(?:#+ |>+ ?|")(?:\*{1,3}|_{1,3}|==|~~)?[a-z\u0401\u0451\u0410-\u044f]/g;

    let textcopy = content;
    let match = regFirstSentence.exec(textcopy);
    let matchHeader = regHeaderSentence.exec(textcopy);
    let dstCharIndex = -1;

    if (match) {
        dstCharIndex = regFirstSentence.lastIndex - 1;
    } else if (matchHeader) {
        dstCharIndex = regHeaderSentence.lastIndex - 1;
    }

    // Only capitalize if the char was just typed (within prevCh..curCh range)
    if (isParamDefined(prevCh) && !isCursorInPart) {
        return ctx;
    }
    if (!(isParamDefined(prevCh) && dstCharIndex >= prevCh! && dstCharIndex < curCh)) {
        dstCharIndex = -1;
    }

    if (dstCharIndex !== -1) {
        const newContent = textcopy.substring(0, dstCharIndex)
            + textcopy.charAt(dstCharIndex).toUpperCase()
            + textcopy.substring(dstCharIndex + 1);
        return { ...ctx, content: newContent };
    }
    return ctx;
}

/**
 * Capitalize letters after sentence-ending punctuation (.?!。！？).
 * Only applies when typing (within prevCh..curCh range).
 */
export function capitalizeMidSentence(ctx: TextFormatContext): TextFormatContext {
    let { content, curCh, prevCh, offset } = ctx;
    const reg = /(?:[.?!]\s+|[。！？]\s*)(?:\*{1,3}|_{1,3}|==|~~)?[a-z\u0401\u0451\u0410-\u044f]/g;

    while (true) {
        const match = reg.exec(content);
        if (!match) break;
        const tempIndex = reg.lastIndex - 1;
        const isSpaceDot = tempIndex - 2 < 0 || content.substring(tempIndex - 2, tempIndex) === ' .';

        if (isParamDefined(prevCh) && tempIndex >= prevCh! - offset && tempIndex < curCh - offset && !isSpaceDot) {
            content = content.substring(0, tempIndex)
                + content.charAt(tempIndex).toUpperCase()
                + content.substring(reg.lastIndex);
        }
    }
    return { ...ctx, content };
}

// ──────────── Language Pair Spacing ────────────

/**
 * Find the token boundaries [left, right) surrounding a given position.
 * A token is a contiguous run of non-whitespace characters (excluding \0 marker).
 */
function findTokenBounds(content: string, pos: number): [number, number] {
    let left = pos;
    while (left > 0 && !/[\s\0]/.test(content.charAt(left - 1))) {
        left--;
    }
    let right = pos;
    while (right < content.length && !/[\s\0]/.test(content.charAt(right))) {
        right++;
    }
    return [left, right];
}

function extractToken(content: string, left: number, right: number): string {
    return content.substring(left, right).replace(/\0/g, '');
}

/**
 * Collect all language-pair boundary positions in the full content string.
 */
function collectAllBoundaries(
    content: string,
    languagePairs: LanguagePair[],
    customCategories?: CustomScriptDef[],
): Set<number> {
    const positions = new Set<number>();
    for (const pair of languagePairs) {
        const regexps = buildPairRegexps(pair.a, pair.b, customCategories);
        for (const reg of regexps) {
            reg.lastIndex = 0;
            while (true) {
                const match = reg.exec(content);
                if (!match) break;
                positions.add(reg.lastIndex - 1);
            }
        }
    }
    return positions;
}

/**
 * Insert spaces between language pairs in the text content.
 * Uses prefix dictionary to suppress spaces for tokens still being typed.
 *
 * Algorithm (token-centric):
 *  1. Find the token at / adjacent to the cursor.
 *  2. Check the token against the prefix dictionary.
 *  3. If NOT suppressed → insert spaces at ALL pair boundaries within that token
 *     (even if the boundary is outside the prevCh..curCh typing range, because
 *      the boundary may have been deferred from an earlier keystroke).
 *  4. For boundaries outside the cursor token, use normal prevCh..curCh range.
 */
export function applyLanguagePairSpacing(
    ctx: TextFormatContext,
    languagePairs: LanguagePair[],
    prefixDict: PrefixDictionary,
    customCategories?: CustomScriptDef[],
    debug?: boolean,
): TextFormatContext {
    let { content, curCh, prevCh, offset } = ctx;
    if (!isParamDefined(prevCh)) return ctx;

    const cursorInContent = curCh - offset;

    // 1. Collect ALL boundary positions in the original content
    const allBoundaries = collectAllBoundaries(content, languagePairs, customCategories);
    if (allBoundaries.size === 0) return ctx;

    // 2. Find the cursor token boundaries
    let [tokLeft, tokRight] = findTokenBounds(content, cursorInContent);
    let cursorToken = extractToken(content, tokLeft, tokRight);

    // When cursor is at a word boundary (empty token, e.g., after typing space),
    // fall back to the left-neighbor token — it was just finalized and may need
    // deferred boundary insertion from prefix-dict expiration.
    let tokenIsFinalized = false;
    if (cursorToken.length === 0 && cursorInContent > 0) {
        let searchPos = cursorInContent - 1;
        while (searchPos >= 0 && /[\s\0]/.test(content.charAt(searchPos))) {
            searchPos--;
        }
        if (searchPos >= 0) {
            [tokLeft, tokRight] = findTokenBounds(content, searchPos);
            cursorToken = extractToken(content, tokLeft, tokRight);
            tokenIsFinalized = true;
        }
    }

    // 3. Check cursor token against prefix dictionary
    // When prevCh === curCh (e.g., Enter/newline reformat), user is done typing
    // on this line — only exact matches should suppress, not prefix matches.
    // For finalized tokens (space just typed), also use exact-match mode.
    const isActivelyTyping = curCh !== prevCh;
    const usePrefix = isActivelyTyping && !tokenIsFinalized;
    const cursorTokenSuppressed = prefixDict.shouldSuppressSpace(cursorToken, usePrefix);

    // Compute protectedUpTo: boundaries within [0, protectedUpTo) in the token
    // are protected by a dictionary word and should NOT get spaces.
    let protectedUpTo = -1;
    if (cursorTokenSuppressed) {
        // Entire token is exact match or prefix → protect all
        protectedUpTo = cursorToken.length;
    } else {
        // Check if token starts with a completed dictionary word
        const matchLen = prefixDict.findLongestMatchFromStart(cursorToken);
        if (matchLen > 0 && matchLen < cursorToken.length) {
            const lastCharOfMatch = cursorToken.charAt(matchLen - 1);
            const firstCharAfterMatch = cursorToken.charAt(matchLen);
            // Only protect if followed by a different script (clear word boundary)
            if (classifyChar(lastCharOfMatch) !== classifyChar(firstCharAfterMatch)) {
                protectedUpTo = matchLen;
            }
            // Same script → word is no longer applicable → no protection
        }
    }

    if (debug) {
        console.log('[LangPairSpacing] content:', JSON.stringify(content),
            'curCh:', curCh, 'prevCh:', prevCh, 'offset:', offset,
            'cursorInContent:', cursorInContent,
            'boundaries:', Array.from(allBoundaries),
            'tokenBounds:', [tokLeft, tokRight],
            'cursorToken:', JSON.stringify(cursorToken),
            'suppressed:', cursorTokenSuppressed,
            'protectedUpTo:', protectedUpTo);
    }

    // 4. Decide which boundaries to keep
    const toInsert: number[] = [];
    const prevChInContent = prevCh! - offset;

    // Check if prefix dict just expired: the previous token (before this
    // keystroke) was suppressed, but the current token is not.  In that case,
    // deferred boundaries should now be inserted even if outside typing range.
    let prefixDictExpired = false;
    if (!cursorTokenSuppressed) {
        if (isActivelyTyping && prevChInContent > tokLeft) {
            // Typing continued: check if the token BEFORE this keystroke was suppressed
            const prevToken = cursorToken.substring(0, prevChInContent - tokLeft);
            prefixDictExpired = prefixDict.shouldSuppressSpace(prevToken, true);
        } else if (!isActivelyTyping || tokenIsFinalized) {
            // Token finalized (e.g. Enter pressed or space typed):
            // check if the ENTIRE token was previously suppressed as a prefix
            prefixDictExpired = prefixDict.shouldSuppressSpace(cursorToken, true);
        }
    }

    for (const pos of allBoundaries) {
        const inCursorToken = pos >= tokLeft && pos < tokRight;

        if (inCursorToken) {
            const posInToken = pos - tokLeft;
            if (posInToken < protectedUpTo) {
                continue; // protected by dictionary word
            }
            // Insert if within the typing range, or if the prefix dict
            // just expired (deferred boundaries in the token should now be added).
            if ((pos >= prevChInContent && pos < cursorInContent) || prefixDictExpired) {
                toInsert.push(pos);
            }
        } else {
            // Boundary is outside cursor token:
            // use normal prevCh..curCh typing range check
            if (pos >= prevChInContent && pos < cursorInContent) {
                // Also check prefix dict for this token
                const [tl, tr] = findTokenBounds(content, pos);
                const token = extractToken(content, tl, tr);
                if (!prefixDict.shouldSuppressSpace(token, false)) {
                    toInsert.push(pos);
                }
            }
        }
    }

    if (toInsert.length === 0) return ctx;

    // 5. Sort ascending, then insert from right to left
    toInsert.sort((a, b) => a - b);

    for (let i = toInsert.length - 1; i >= 0; i--) {
        content = content.substring(0, toInsert[i]) + ' ' + content.substring(toInsert[i]);
    }

    // 6. Adjust curCh: count insertions before cursor
    let shift = 0;
    for (const pos of toInsert) {
        if (pos < cursorInContent) shift++;
    }
    curCh += shift;

    return { ...ctx, content, curCh };
}



// ──────────── Boundary Space Detection ────────────

/**
 * Detect the SpaceState at the start and end of a text content.
 * Uses configurable soft-space symbol sets.
 */
export function detectBoundarySpaceState(
    content: string,
    leftSymbols: string,
    rightSymbols: string,
): { start: SpaceState; end: SpaceState } {
    const builtInSymbols = '【】（）《》，。、？：；‘’“”「『』」！';
    // Build dynamic regexps from the configured symbols
    const escapedLeft = escapeForCharClass(leftSymbols + builtInSymbols);
    const escapedRight = escapeForCharClass(rightSymbols + builtInSymbols);

    const regStrictSpaceStart = /^\0?\s/;
    const regStrictSpaceEnd = /\s\0?$/;
    const regStartWithSpace = new RegExp(`^\\0?[\\s${escapedLeft}]`);
    const regEndWithSpace = new RegExp(`[\\s${escapedRight}]\\0?$`);

    let start = SpaceState.none;
    let end = SpaceState.none;

    if (regStartWithSpace.test(content) || content.startsWith('<br>')) {
        start = regStrictSpaceStart.test(content) ? SpaceState.strict : SpaceState.soft;
    }

    if (regEndWithSpace.test(content) || content.endsWith('<br>')) {
        end = regStrictSpaceEnd.test(content) ? SpaceState.strict : SpaceState.soft;
    }

    return { start, end };
}

/**
 * Escape special regex characters for use inside a character class [...].
 */
function escapeForCharClass(symbols: string): string {
    return symbols.replace(/[\\\]^-]/g, '\\$&');
}
