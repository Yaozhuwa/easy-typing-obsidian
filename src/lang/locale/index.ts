import { moment } from 'obsidian';
import enUS from './en-US';
import zhCN from './zh-CN';
import zhTW from './zh-TW';
import ruRU from './ru-RU';
import jaJP from './ja-JP';
import koKR from './ko-KR';
import type { Locale } from './types';

const localeMap: Record<string, Locale> = {
    'en': enUS,
    'zh': zhCN,
    'zh-cn': zhCN,
    'zh-tw': zhTW,
    'ru': ruRU,
    'ja': jaJP,
    'ko': koKR,
};

let cached: Locale | null = null;

export function getLocale(): Locale {
    if (cached) return cached;
    const lang = moment.locale().toLowerCase();
    cached = localeMap[lang] ?? enUS;
    return cached;
}

export function resetLocaleCache(): void {
    cached = null;
}

export type { Locale } from './types';
