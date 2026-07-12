/**
 * Text formatting functions extracted from formatLine.
 * Each function processes text content within an InlinePart of type 'text'.
 */

import { buildPairRegexps, classifyChar, resolveCharClass, ScriptCategory, CustomScriptDef } from './script_category';
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
/**
 * Check whether a character belongs to CJK context (CJK characters + CJK punctuation).
 * classifyChar returns Unknown for CJK punctuation like 。：、 etc.,
 * so we need explicit Unicode range checks for those.
 */
function isCJKContext(ch: string): boolean {
    const cat = classifyChar(ch);
    if (cat === ScriptCategory.Chinese || cat === ScriptCategory.Japanese || cat === ScriptCategory.Korean) {
        return true;
    }
    if (ch.length > 0) {
        const code = ch.charCodeAt(0);
        // CJK Symbols and Punctuation (U+3000–U+303F): 。、【】、《》 etc.
        // Fullwidth punctuation: U+FF01–U+FF0F, U+FF1A–U+FF20, U+FF3B–U+FF40, U+FF5B–U+FF60
        //   (excluding fullwidth digits U+FF10–U+FF19 and fullwidth letters U+FF21–U+FF3A/U+FF41–U+FF5A)
        // CJK Compatibility Forms: U+FE30–U+FE4F
        // Fullwidth symbols: U+FFE0–U+FFE6
        if ((code >= 0x3000 && code <= 0x303F) ||
            (code >= 0xFF01 && code <= 0xFF0F) ||
            (code >= 0xFF1A && code <= 0xFF20) ||
            (code >= 0xFF3B && code <= 0xFF40) ||
            (code >= 0xFF5B && code <= 0xFF60) ||
            (code >= 0xFFE0 && code <= 0xFFE6) ||
            (code >= 0xFE30 && code <= 0xFE4F)) {
            return true;
        }
    }
    return false;
}

function findTokenBounds(content: string, pos: number): [number, number] {
    // Clamp pos to content bounds (cursor may be in a different inline part)
    pos = Math.max(0, Math.min(pos, content.length));
    // Determine reference script group from the character just before cursor
    let refIdx = pos > 0 ? pos - 1 : 0;
    if (refIdx >= content.length) refIdx = content.length - 1;
    if (refIdx < 0) return [0, 0];
    const refIsCJK = isCJKContext(content.charAt(refIdx));

    let left = pos;
    while (left > 0 && !/[\s\0]/.test(content.charAt(left - 1))) {
        const ch = content.charAt(left - 1);
        const isCJK = isCJKContext(ch);
        if (!isCJK && !/\w/.test(ch)) break;
        if (isCJK !== refIsCJK) break;
        left--;
    }
    let right = pos;
    while (right < content.length && !/[\s\0]/.test(content.charAt(right))) {
        const ch = content.charAt(right);
        const isCJK = isCJKContext(ch);
        if (!isCJK && !/\w/.test(ch)) break;
        if (isCJK !== refIsCJK) break;
        right++;
    }
    return [left, right];
}

function extractToken(content: string, left: number, right: number): string {
    return content.substring(left, right).replace(/\0/g, '');
}

/**
 * Extend the cursor token (script-aware seed bounds) to capture a dictionary
 * word that straddles a CJK↔non-CJK script boundary.
 *
 * Problem: findTokenBounds splits "b站" into "b" (English run) and "站" (CJK
 * run), so the dictionary never sees the whole word "b站" and fails to
 * suppress the space inside it. The dictionary word spans runs; tokenization
 * alone cannot know how far to extend without consulting the dictionary.
 *
 * Solution: within the maximal run of (ASCII-word | CJK) chars around the
 * seed, find the longest sub-range CONTAINING the seed that the dictionary
 * considers suppressible (exact match, or prefix when usePrefix). If none
 * matches, return the seed unchanged so all downstream logic (protectedUpTo,
 * prefixDictExpired, typing-range checks) behaves exactly as before.
 *
 * Only used for the cursor token; findTokenBounds (script-aware) still
 * governs where spaces are actually inserted.
 */
function extendCursorTokenForDict(
    content: string,
    seedL: number,
    seedR: number,
    prefixDict: PrefixDictionary,
    usePrefix: boolean,
): { left: number; right: number; token: string } {
    const seedToken = extractToken(content, seedL, seedR);

    // Relaxed run bounds: maximal run of (ASCII word | CJK) chars, stopping
    // at whitespace, \0, or non-word/non-CJK symbols.
    let runL = seedL;
    while (runL > 0) {
        const ch = content.charAt(runL - 1);
        if (/[\s\0]/.test(ch) || (!/\w/.test(ch) && !isCJKContext(ch))) break;
        runL--;
    }
    let runR = seedR;
    while (runR < content.length) {
        const ch = content.charAt(runR);
        if (/[\s\0]/.test(ch) || (!/\w/.test(ch) && !isCJKContext(ch))) break;
        runR++;
    }

    let bestL = seedL, bestR = seedR, bestToken = seedToken;
    let bestMatched = prefixDict.shouldSuppressSpace(seedToken, usePrefix);
    let bestSpan = bestMatched ? (seedR - seedL) : -1;

    // Sub-ranges containing the seed: l ∈ [runL, seedL], r ∈ [seedR, runR].
    // Pick the longest that the dictionary suppresses. n is tiny (one inline
    // text part), so the nested scan is negligible.
    for (let l = seedL; l >= runL; l--) {
        for (let r = seedR; r <= runR; r++) {
            if (l === seedL && r === seedR) continue; // seed already checked
            const token = extractToken(content, l, r);
            if (prefixDict.shouldSuppressSpace(token, usePrefix)) {
                const span = r - l;
                if (span > bestSpan) {
                    bestL = l; bestR = r; bestToken = token;
                    bestMatched = true; bestSpan = span;
                }
            }
        }
    }

    if (!bestMatched) {
        // No extension (nor the seed) matches — keep seed for structural logic.
        return { left: seedL, right: seedR, token: seedToken };
    }
    return { left: bestL, right: bestR, token: bestToken };
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

const FORMATTING_CHARS_RE = /[*_~`^]/;

function isFormattingChar(ch: string): boolean {
    return FORMATTING_CHARS_RE.test(ch);
}

/**
 * Collect language-pair boundaries that are separated by markdown formatting
 * symbols (e.g. *A*中文 → boundary between * and 中).
 */
function collectFormattingSeparatedBoundaries(
    content: string,
    languagePairs: LanguagePair[],
    customCategories?: CustomScriptDef[],
): Set<number> {
    const positions = new Set<number>();
    // Early exit if no formatting chars in the content
    if (!FORMATTING_CHARS_RE.test(content)) return positions;

    // Pre-compute pair character-class regexps once outside the hot loop
    const pairTests: { test(classA: string, classB: string): boolean }[] = [];
    for (const pair of languagePairs) {
        const classA = resolveCharClass(pair.a, customCategories);
        const classB = resolveCharClass(pair.b, customCategories);
        if (!classA || !classB) continue;
        const regA = new RegExp(`^[${classA}]$`);
        const regB = new RegExp(`^[${classB}]$`);
        pairTests.push({
            test(a: string, b: string) {
                return (regA.test(a) && regB.test(b)) || (regA.test(b) && regB.test(a));
            },
        });
    }
    if (pairTests.length === 0) return positions;

    const len = content.length;
    let i = 0;
    while (i < len) {
        if (!isFormattingChar(content[i])) { i++; continue; }

        // Find contiguous formatting block
        let blockStart = i;
        while (blockStart > 0 && isFormattingChar(content[blockStart - 1])) {
            blockStart--;
        }
        let blockEnd = i;
        while (blockEnd < len - 1 && isFormattingChar(content[blockEnd + 1])) {
            blockEnd++;
        }
        i = blockEnd + 1;

        // Find left non-formatting char, skipping \0 cursor marker
        let leftIdx = blockStart - 1;
        while (leftIdx >= 0 && (isFormattingChar(content[leftIdx]) || content[leftIdx] === '\0')) {
            leftIdx--;
        }
        if (leftIdx < 0) continue;

        // Find right non-formatting char, skipping \0 cursor marker
        let rightIdx = blockEnd + 1;
        while (rightIdx < len && (isFormattingChar(content[rightIdx]) || content[rightIdx] === '\0')) {
            rightIdx++;
        }
        if (rightIdx >= len) continue;

        const leftChar = content[leftIdx];
        const rightChar = content[rightIdx];

        // Check if they form a language pair
        let pairMatched = false;
        for (const pt of pairTests) {
            if (pt.test(leftChar, rightChar)) { pairMatched = true; break; }
        }
        if (!pairMatched) continue;

        // Determine which side the formatting block belongs to
        // by looking for a matching formatting char (markdown pair).
        // Scan through non-formatting content (the text inside the pair).
        // Pick the closer match; if equidistant, prefer left.
        const fmtChar = content[blockStart];
        let matchedLeftDist = -1;
        let matchedRightDist = -1;
        for (let j = blockStart - 1; j >= 0; j--) {
            if (content[j] === fmtChar) { matchedLeftDist = blockStart - j; break; }
            if (/[\s\0]/.test(content[j])) break;
        }
        for (let j = blockEnd + 1; j < len; j++) {
            if (content[j] === fmtChar) { matchedRightDist = j - blockEnd; break; }
            if (/[\s\0]/.test(content[j])) break;
        }
        if (matchedLeftDist >= 0 && (matchedRightDist < 0 || matchedLeftDist <= matchedRightDist)) {
            positions.add(blockEnd + 1);
        } else if (matchedRightDist >= 0) {
            positions.add(blockStart);
        } else {
            if (isCJKContext(leftChar)) positions.add(blockStart);
            if (isCJKContext(rightChar)) positions.add(blockEnd + 1);
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
    // Also collect boundaries separated by markdown formatting symbols
    const fmtBoundaries = collectFormattingSeparatedBoundaries(content, languagePairs, customCategories);
    for (const pos of fmtBoundaries) {
        allBoundaries.add(pos);
    }
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

    // 2b. Extend the cursor token across CJK↔non-CJK boundaries when a
    // dictionary word straddles them (e.g. "b站" = 'b' + '站'). The
    // script-aware findTokenBounds splits such words, so the dictionary
    // would never see the whole word and fail to suppress its inner space.
    // If no extension matches, behavior is unchanged from the seed token.
    const isActivelyTyping = curCh !== prevCh;
    const usePrefix = isActivelyTyping && !tokenIsFinalized;
    const extended = extendCursorTokenForDict(
        content, tokLeft, tokRight, prefixDict, usePrefix,
    );
    let tokLeftExt = extended.left;
    let tokRightExt = extended.right;
    let cursorTokenExt = extended.token;

    // 3. Check cursor token against prefix dictionary
    // When prevCh === curCh (e.g., Enter/newline reformat), user is done typing
    // on this line — only exact matches should suppress, not prefix matches.
    // For finalized tokens (space just typed), also use exact-match mode.
    const cursorTokenSuppressed = prefixDict.shouldSuppressSpace(cursorTokenExt, usePrefix);

    // Compute protectedUpTo: boundaries within [0, protectedUpTo) in the token
    // are protected by a dictionary word and should NOT get spaces.
    let protectedUpTo = -1;
    if (cursorTokenSuppressed) {
        // Entire token is exact match or prefix → protect all
        protectedUpTo = cursorTokenExt.length;
    } else {
        // Check if token starts with a completed dictionary word
        const matchLen = prefixDict.findLongestMatchFromStart(cursorTokenExt);
        if (matchLen > 0 && matchLen < cursorTokenExt.length) {
            const lastCharOfMatch = cursorTokenExt.charAt(matchLen - 1);
            const firstCharAfterMatch = cursorTokenExt.charAt(matchLen);
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
            'tokenBoundsExt:', [tokLeftExt, tokRightExt],
            'cursorTokenExt:', JSON.stringify(cursorTokenExt),
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
        if (isActivelyTyping && prevChInContent > tokLeftExt) {
            // Typing continued: check if the token BEFORE this keystroke was suppressed
            const prevToken = cursorTokenExt.substring(0, prevChInContent - tokLeftExt);
            prefixDictExpired = prefixDict.shouldSuppressSpace(prevToken, true);
        } else if (!isActivelyTyping || tokenIsFinalized) {
            // Token finalized (e.g. Enter pressed or space typed):
            // check if the ENTIRE token was previously suppressed as a prefix
            prefixDictExpired = prefixDict.shouldSuppressSpace(cursorTokenExt, true);
        }
    }

    // Use extended bounds for inCursorToken: a dictionary word may extend
    // across the seed boundary, so boundaries inside the extended word must
    // be subject to protectedUpTo (which is computed against cursorTokenExt).
    for (const pos of allBoundaries) {
        const inCursorToken = pos >= tokLeftExt && pos < tokRightExt;

        if (inCursorToken) {
            const posInToken = pos - tokLeftExt;
            if (posInToken > 0 && posInToken < protectedUpTo) {
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
                // Also check prefix dict for this token. Use the
                // dictionary-guided extension so a cross-script dict word
                // (e.g. "b站") to the left of the cursor is matched as a
                // whole rather than split by findTokenBounds.
                const [seedL, seedR] = findTokenBounds(content, pos);
                const ext = extendCursorTokenForDict(content, seedL, seedR, prefixDict, false);
                if (!prefixDict.shouldSuppressSpace(ext.token, false)) {
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

export function detectBoundarySpaceState(
    content: string,
    leftSymbols: string,
    rightSymbols: string,
): { start: SpaceState; end: SpaceState } {
    const builtInBothSymbols = '"\'';
    const builtInLeftSoftSymbols = `【】（）《》，。、？：；‘’“”「『』」！${builtInBothSymbols}[({`;
    const builtInRightSoftSymbols = `【】（）《》，。、？：；‘’“”「『』」！${builtInBothSymbols},.?!:;])}`;
    const escapedStart = escapeForCharClass(rightSymbols + builtInRightSoftSymbols);
    const escapedEnd = escapeForCharClass(leftSymbols + builtInLeftSoftSymbols);

    const regStrictSpaceStart = /^\0?\s/;
    const regStrictSpaceEnd = /\s\0?$/;
    const regStartWithSpace = new RegExp(`^\\0?[\\s${escapedStart}]`);
    const regEndWithSpace = new RegExp(`[\\s${escapedEnd}]\\0?$`);

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
