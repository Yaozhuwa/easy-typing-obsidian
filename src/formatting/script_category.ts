/**
 * Script/language category detection and pair-based regex generation.
 */

export enum ScriptCategory {
    Chinese = 'chinese',
    Japanese = 'japanese',
    Korean = 'korean',
    CJK = 'cjk',
    English = 'english',
    Digit = 'digit',
    Russian = 'russian',
    Unknown = 'unknown',
}

/**
 * Unicode character class patterns for each script category.
 * CJK is a meta-category that unions Chinese, Japanese, Korean.
 */
const SCRIPT_CHAR_CLASSES: Record<ScriptCategory, string> = {
    [ScriptCategory.Chinese]: '\\u4e00-\\u9fff\\u3400-\\u4dbf',
    [ScriptCategory.Japanese]: '\\u3040-\\u309f\\u30a0-\\u30ff\\u31f0-\\u31ff',
    [ScriptCategory.Korean]: '\\uac00-\\ud7af\\u1100-\\u11ff\\u3130-\\u318f',
    [ScriptCategory.CJK]: '\\u4e00-\\u9fff\\u3400-\\u4dbf\\u3040-\\u309f\\u30a0-\\u30ff\\u31f0-\\u31ff\\uac00-\\ud7af\\u1100-\\u11ff\\u3130-\\u318f',
    [ScriptCategory.English]: 'A-Za-z',
    [ScriptCategory.Digit]: '0-9',
    [ScriptCategory.Russian]: '\\u0400-\\u04ff',
    [ScriptCategory.Unknown]: '',
};

/**
 * Classify a single character into a ScriptCategory.
 * Returns the most specific category (never CJK).
 */
export function classifyChar(ch: string): ScriptCategory {
    if (!ch || ch.length === 0) return ScriptCategory.Unknown;
    const code = ch.charCodeAt(0);

    // Chinese (CJK Unified Ideographs + Extension A)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
        return ScriptCategory.Chinese;
    }
    // Japanese (Hiragana + Katakana + Katakana Phonetic Extensions)
    if ((code >= 0x3040 && code <= 0x309f) ||
        (code >= 0x30a0 && code <= 0x30ff) ||
        (code >= 0x31f0 && code <= 0x31ff)) {
        return ScriptCategory.Japanese;
    }
    // Korean (Hangul Syllables + Jamo + Compatibility Jamo)
    if ((code >= 0xac00 && code <= 0xd7af) ||
        (code >= 0x1100 && code <= 0x11ff) ||
        (code >= 0x3130 && code <= 0x318f)) {
        return ScriptCategory.Korean;
    }
    // English
    if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
        return ScriptCategory.English;
    }
    // Digit
    if (code >= 0x30 && code <= 0x39) {
        return ScriptCategory.Digit;
    }
    // Russian (Cyrillic)
    if (code >= 0x0400 && code <= 0x04ff) {
        return ScriptCategory.Russian;
    }
    return ScriptCategory.Unknown;
}

/**
 * Resolve a ScriptCategory into its character class string.
 * For CJK, expands to the union of Chinese + Japanese + Korean.
 * For custom categories, uses the provided pattern directly.
 */
export function resolveCharClass(cat: ScriptCategory | string, customCategories?: CustomScriptDef[]): string {
    if (cat in SCRIPT_CHAR_CLASSES) {
        return SCRIPT_CHAR_CLASSES[cat as ScriptCategory];
    }
    // Look up custom category
    if (customCategories) {
        const custom = customCategories.find(c => c.name === cat);
        if (custom) return custom.pattern;
    }
    return '';
}

export interface CustomScriptDef {
    name: string;
    pattern: string;  // e.g. "[Α-Ωα-ω]" — the inner character class content
}

/**
 * Build regex patterns that match adjacency of two script categories.
 * Returns two RegExps: (A)(B) and (B)(A), both global.
 */
export function buildPairRegexps(
    a: ScriptCategory | string,
    b: ScriptCategory | string,
    customCategories?: CustomScriptDef[]
): RegExp[] {
    const classA = resolveCharClass(a as ScriptCategory, customCategories);
    const classB = resolveCharClass(b as ScriptCategory, customCategories);
    if (!classA || !classB) return [];

    const regAB = new RegExp(`([${classA}])([${classB}])`, 'g');
    const regBA = new RegExp(`([${classB}])([${classA}])`, 'g');
    return [regAB, regBA];
}

/**
 * All built-in script categories (excluding CJK meta-category and Unknown).
 */
export const BUILTIN_CATEGORIES: ScriptCategory[] = [
    ScriptCategory.Chinese,
    ScriptCategory.Japanese,
    ScriptCategory.Korean,
    ScriptCategory.CJK,
    ScriptCategory.English,
    ScriptCategory.Digit,
    ScriptCategory.Russian,
];
