export type RegexSpacePolicy = '-' | '=' | '+';

export interface CustomRegexConfig {
    rules: { regex: RegExp; left: RegexSpacePolicy; right: RegexSpacePolicy }[];
    errors: { line: number; kind: 'format' | 'regex'; message?: string }[];
}

let cachedSource: string | undefined;
let cachedConfig: CustomRegexConfig | undefined;

/** Parse configuration without notifications or logging from the typing path. */
export function getCustomRegexConfig(source = ''): CustomRegexConfig {
    if (source === cachedSource && cachedConfig) return cachedConfig;
    const result: CustomRegexConfig = { rules: [], errors: [] };
    source.split(/\r\n?|\n/).forEach((rawLine, index) => {
        if (/^\s*(?:\/\/|$)/.test(rawLine)) return;
        // Ignore whitespace after the policy, but preserve all regex whitespace.
        const line = rawLine.trimEnd();
        const policy = /\|([\-=+])([\-=+])$/.exec(line);
        if (!policy || policy.index === 0) {
            result.errors.push({ line: index + 1, kind: 'format' });
            return;
        }
        try {
            result.rules.push({
                regex: new RegExp(line.slice(0, policy.index), 'g'),
                left: policy[1] as RegexSpacePolicy,
                right: policy[2] as RegexSpacePolicy,
            });
        } catch (error) {
            result.errors.push({ line: index + 1, kind: 'regex', message: String(error) });
        }
    });
    // Retain only the latest config, rather than every intermediate textarea edit.
    cachedSource = source;
    cachedConfig = result;
    return result;
}

/** Upgrade only known historical defaults; never guess policies for custom rules. */
export function migrateLegacyDefaultRegexConfig(source: string, addSpaces = true): string {
    const normalized = source.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    const earliestDefault = ':\\w*:\n{{.*?}}';
    const v4Default = earliestDefault + '\n<.*?>\n\\[\\!.*?\\][+-]{0,1}';
    if (normalized !== earliestDefault && normalized !== v4Default) return source;
    const policy = addSpaces ? '|++' : '|--';
    return normalized.split('\n').map(pattern => pattern + policy).join('\n');
}
