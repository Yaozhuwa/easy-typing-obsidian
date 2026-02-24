/**
 * Inline part spacing logic — replaces the ~400 lines of switch-case in formatLine.
 * Determines whether a space should be inserted between two adjacent InlineParts.
 */

import { InlineType, SpaceState } from '../core';
import { EasyTypingSettings } from '../settings';

/**
 * Determine if a space should be inserted between adjacent inline parts
 * based on their types and the current settings.
 *
 * @param prevType - The type of the previous inline part (InlineType.none for line start)
 * @param curType - The type of the current inline part
 * @param prevTextEndSpaceState - The SpaceState at the end of the previous text part
 * @param prevPartRightSpaceRequire - right space requirement of the previous part (for user-defined parts)
 * @param curPartLeftSpaceRequire - left space requirement of the current part (for user-defined parts)
 * @param settings - Plugin settings
 * @returns true if a space should be inserted between the parts
 */
export function shouldInsertSpaceBetweenParts(
    prevType: InlineType,
    curType: InlineType,
    prevTextEndSpaceState: SpaceState,
    prevPartRightSpaceRequire: SpaceState,
    curPartLeftSpaceRequire: SpaceState,
    settings: EasyTypingSettings,
): boolean {
    if (prevType === InlineType.none) return false;

    // Get the space mode for each inline type
    const modeOf = (type: InlineType): SpaceState => {
        switch (type) {
            case InlineType.code: return settings.InlineCodeSpaceMode;
            case InlineType.formula: return settings.InlineFormulaSpaceMode;
            case InlineType.wikilink:
            case InlineType.mdlink: return settings.InlineLinkSpaceMode;
            default: return SpaceState.none;
        }
    };

    // ── prevType is text → compare curType's mode against prevTextEndSpaceState
    if (prevType === InlineType.text) {
        if (curType === InlineType.user) {
            return curPartLeftSpaceRequire > prevTextEndSpaceState;
        }
        // For code, formula, link: their mode > prevTextEnd means insert
        const curMode = modeOf(curType);
        return curMode > prevTextEndSpaceState;
    }

    // ── curType is text → compare prevType's mode against txtStartSpaceState
    //    (this is handled in the caller since text content may change)
    //    This function is only for non-text → non-text adjacency below.

    // ── prevType is user → check prevPartRight + curType mode
    if (prevType === InlineType.user) {
        if (curType === InlineType.text) {
            return prevPartRightSpaceRequire > SpaceState.none; // caller checks against txtStartSpaceState
        }
        if (curType === InlineType.user) {
            return curPartLeftSpaceRequire > SpaceState.none && prevPartRightSpaceRequire > SpaceState.none;
        }
        // user → code/formula/link
        const curMode = modeOf(curType);
        return curMode > SpaceState.none && prevPartRightSpaceRequire > SpaceState.none;
    }

    // ── Both are non-text, non-user inline types (code, formula, link)
    const prevMode = modeOf(prevType);
    const curMode = modeOf(curType);

    if (curType === InlineType.user) {
        return prevMode > SpaceState.none && curPartLeftSpaceRequire > SpaceState.none;
    }

    // Same type adjacency or cross-type: either mode > none
    return prevMode > SpaceState.none || curMode > SpaceState.none;
}

/**
 * For text → non-text: check if space should be prepended to the text part.
 * This mirrors the original code where `prevPartType` affects the text content.
 */
export function shouldPrependSpaceToText(
    prevType: InlineType,
    txtStartSpaceState: SpaceState,
    prevPartRightSpaceRequire: SpaceState,
    settings: EasyTypingSettings,
): boolean {
    switch (prevType) {
        case InlineType.none:
            return false;
        case InlineType.code:
            return settings.InlineCodeSpaceMode > txtStartSpaceState;
        case InlineType.formula:
            return settings.InlineFormulaSpaceMode > txtStartSpaceState;
        case InlineType.wikilink:
        case InlineType.mdlink:
            if (!settings.InlineLinkSmartSpace) {
                return settings.InlineLinkSpaceMode > txtStartSpaceState;
            }
            // Smart space is handled separately in the caller (link-specific logic)
            return false;
        case InlineType.user:
            return prevPartRightSpaceRequire > txtStartSpaceState;
        default:
            return false;
    }
}
