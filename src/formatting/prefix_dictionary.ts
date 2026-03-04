/**
 * PrefixDictionary: prevents premature space insertion for words being typed.
 *
 * Supports literal words (e.g. "n8n") and regex entries (e.g. /\d[dD]/).
 * Regex entries are wrapped in /.../ syntax in the raw text.
 */

export class PrefixDictionary {
    private literalWords: string[];
    private regexEntries: RegExp[];

    constructor(raw: string) {
        this.literalWords = [];
        this.regexEntries = [];
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
                    this.regexEntries.push(new RegExp(regexMatch[1], regexMatch[2]));
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
     * Case-insensitive for literal words.
     */
    isExactMatch(token: string): boolean {
        for (const word of this.literalWords) {
            if (word === token) return true;
        }
        for (const re of this.regexEntries) {
            re.lastIndex = 0;
            // Anchor to match the ENTIRE token, not a substring
            const anchored = new RegExp(`^(?:${re.source})$`, re.flags);
            if (anchored.test(token)) return true;
        }
        return false;
    }

    /**
     * Check if the token is a prefix of any literal word in the dictionary.
     * Only applies to literal words, not regex entries.
     * Case-insensitive.
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

        for (const re of this.regexEntries) {
            // Try anchored match from start
            const anchored = new RegExp(`^(?:${re.source})`, re.flags.replace('g', ''));
            const match = anchored.exec(token);
            if (match && match[0].length > maxLen) {
                maxLen = match[0].length;
            }
        }

        return maxLen;
    }
}
