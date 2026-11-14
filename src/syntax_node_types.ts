/** HyperMD appends user-controlled tag text to syntax node names. */
export function syntaxNodeTokens(name: string): string[] {
    const tokens = name.split('_');
    const tagIndex = tokens.findIndex(token => token.startsWith('tag-'));
    if (tagIndex >= 0 && tokens.slice(0, tagIndex).includes('hashtag')) {
        // The tag itself may contain underscores and names such as inline-code.
        // Remove the entire payload, keeping the actual enclosing syntax tokens.
        return tokens.slice(0, tagIndex);
    }
    return tokens;
}

function hasCodeBlockToken(tokens: string[]): boolean {
    return tokens.some(token => /^(?:HyperMD|hmd)-codeblock(?:-|$)/.test(token));
}

export function isCodeBlockSyntaxNode(name: string): boolean {
    return hasCodeBlockToken(syntaxNodeTokens(name));
}

function hasMathToken(tokens: string[]): boolean {
    return tokens.includes('math') || tokens.some(token => /^HyperMD-math(?:-|$)/.test(token));
}

export function isMathSyntaxNode(name: string): boolean {
    return hasMathToken(syntaxNodeTokens(name));
}

export function inlineSyntaxNodeType(name: string): 'text' | 'code' | 'formula' {
    const tokens = syntaxNodeTokens(name);
    const isLink = tokens.some(token =>
        token === 'link' || /^(?:formatting-link|hmd-internal-link|hmd-external-link)(?:-|$)/.test(token));
    if (!isLink && (tokens.includes('inline-code') || tokens.includes('hmd-indented-code') || hasCodeBlockToken(tokens))) {
        return 'code';
    }
    if (hasMathToken(tokens)) return 'formula';
    return 'text';
}
