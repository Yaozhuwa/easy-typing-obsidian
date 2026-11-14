/**
 * PrefixDictionary: prevents premature space insertion for words being typed.
 *
 * Supports literal words (e.g. "n8n") and regex entries (e.g. /\d[dD]/).
 * Regex entries are wrapped in /.../ syntax in the raw text.
 */

export class PrefixDictionary {
    private literalWords: string[];
    private exactRegexEntries: RegExp[];
    private fromStartRegexEntries: RegExp[];

    constructor(raw: string) {
        this.literalWords = [];
        this.exactRegexEntries = [];
        this.fromStartRegexEntries = [];
        if (!raw || raw.trim() === '') return;

        // Match regex entries /.../ first (may contain commas/spaces),
        // then match non-delimiter tokens. Delimiters: comma, space, newline.
        const tokenPattern = /\/(?:[^/\\]|\\.)+\/[gimsuy]*|[^\s,]+/g;
        let match: RegExpExecArray | null;
        while ((match = tokenPattern.exec(raw)) !== null) {
            const token = match[0];

            // Regex entries: /pattern/ or /pattern/flags
            const regexMatch = /^\/(.+)\/([gimsuy]*)$/.exec(token);
            if (regexMatch) {
                try {
                    const re = new RegExp(regexMatch[1], regexMatch[2]);
                    const exact = new RegExp(`^(?:${re.source})$`, re.flags);
                    const fromStart = new RegExp(`^(?:${re.source})`, re.flags.replace('g', ''));
                    this.exactRegexEntries.push(exact);
                    this.fromStartRegexEntries.push(fromStart);
                } catch (e) {
                    console.warn('PrefixDictionary: invalid regex:', token, e);
                }
            } else {
                this.literalWords.push(token);
            }
        }
    }

    /**
     * Check if the token exactly matches a dictionary word or a regex entry.
     * Literal words are case-sensitive.
     */
    isExactMatch(token: string): boolean {
        for (const word of this.literalWords) {
            if (word === token) return true;
        }
        for (const re of this.exactRegexEntries) {
            re.lastIndex = 0;
            if (re.test(token)) return true;
        }
        return false;
    }

    /**
     * Check if the token is a prefix of any literal word in the dictionary.
     * Only applies to literal words, not regex entries.
     * Case-sensitive.
     */
    isPrefixOfWord(token: string): boolean {
        if (token.length === 0) return false;
        for (const word of this.literalWords) {
            if (word.length > token.length && word.startsWith(token)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Determine if space insertion should be suppressed for a given token.
     *
     * @param token - The token surrounding the space insertion point
     * @param isAtCursor - Whether this token is directly before the cursor
     * @returns true if space should NOT be inserted
     *
     * Rules:
     * 1. Exact match with dictionary word or regex → suppress (any position)
     * 2. Token is a prefix of a dictionary word AND at cursor → suppress
     * 3. Token is a prefix but NOT at cursor → don't suppress (insert space)
     * 4. No match at all → don't suppress (insert space)
     */
    shouldSuppressSpace(token: string, isAtCursor: boolean): boolean {
        if (this.isExactMatch(token)) return true;
        if (isAtCursor && this.isPrefixOfWord(token)) return true;
        return false;
    }

    /**
     * Match ranges within one uninterrupted run of text. The caller supplies
     * run bounds that exclude whitespace, cursor markers and other delimiters.
     * All cached results belong to this content and this matcher only.
     */
    createRangeMatcher(
        content: string,
        from: number,
        to: number,
    ): (seedL: number, seedR: number, usePrefix: boolean) => { left: number; right: number } | undefined {
        const literalMatches = new Map<number, { exactEnd: number; prefixEnd: number }>();
        const regexMatches = new Map<number, { nextEnd: number; matchedEnd?: number }>();
        const maxWordLength = this.literalWords.reduce((max, word) => Math.max(max, word.length), 0);

        const literalEndsAt = (start: number) => {
            const cached = literalMatches.get(start);
            if (cached) return cached;

            let exactEnd = -1;
            let prefixEnd = -1;
            for (const word of this.literalWords) {
                const limit = Math.min(word.length, to - start);
                let matched = 0;
                while (matched < limit && content.charCodeAt(start + matched) === word.charCodeAt(matched)) {
                    matched++;
                }
                if (matched === word.length) {
                    exactEnd = Math.max(exactEnd, start + matched);
                }
                // With usePrefix, both exact matches and nonempty proper
                // prefixes suppress spaces, so the longest common prefix wins.
                if (matched > 0) {
                    prefixEnd = Math.max(prefixEnd, start + matched);
                }
            }
            const result = { exactEnd, prefixEnd };
            literalMatches.set(start, result);
            return result;
        };

        const regexEndAt = (start: number, minEnd: number): number => {
            let cached = regexMatches.get(start);
            if (!cached) {
                cached = { nextEnd: to };
                regexMatches.set(start, cached);
            }
            if (cached.matchedEnd !== undefined) return cached.matchedEnd;

            // A query at the end of a long line only needs to test that end.
            // Later queries can extend the search leftward without repeating
            // candidates. The first match is the longest for this start.
            while (cached.nextEnd >= minEnd) {
                const end = cached.nextEnd--;
                const token = content.substring(start, end);
                for (const re of this.exactRegexEntries) {
                    re.lastIndex = 0;
                    if (re.test(token)) {
                        cached.matchedEnd = end;
                        return end;
                    }
                }
            }
            return -1;
        };

        return (seedL, seedR, usePrefix) => {
            if (seedL < from || seedR > to || seedL > seedR) return undefined;
            const hasRegex = this.exactRegexEntries.length > 0;
            if (!hasRegex && maxWordLength === 0) return undefined;

            const firstStart = hasRegex ? from : Math.max(from, seedR - maxWordLength);
            let best: { left: number; right: number } | undefined;
            let bestSpan = -1;
            // Descending starts preserve the existing rightmost-start tie break.
            for (let start = seedL; start >= firstStart; start--) {
                const literal = literalEndsAt(start);
                let end = usePrefix ? literal.prefixEnd : literal.exactEnd;
                if (hasRegex) end = Math.max(end, regexEndAt(start, seedR));
                if (end >= seedR && end - start > bestSpan) {
                    best = { left: start, right: end };
                    bestSpan = end - start;
                }
            }
            return best;
        };
    }

    /**
     * Find the longest dictionary word that the token starts with.
     * Returns the length of the matched word, or -1 if no match.
     */
    findLongestMatchFromStart(token: string): number {
        let maxLen = -1;

        for (const word of this.literalWords) {
            if (token.startsWith(word) && word.length > maxLen) {
                maxLen = word.length;
            }
        }

        for (const re of this.fromStartRegexEntries) {
            re.lastIndex = 0;
            const match = re.exec(token);
            if (match && match[0].length > maxLen) {
                maxLen = match[0].length;
            }
        }

        return maxLen;
    }
}
