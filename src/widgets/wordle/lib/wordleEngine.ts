/** correct - буква на своём месте, present - есть в слове не на этом месте, absent - нет. */
export type TileColor = 'correct' | 'present' | 'absent';

/** Количество букв в одном слове. */
export const WORD_LENGTH = 5;
/** Максимальное число попыток на партию. */
export const MAX_ROWS = 6;

/** Является ли строка одной русской заглавной буквой. */
export const isValidLetter = (key: string): boolean => /^[А-ЯЁ]$/.test(key);

/** Пустая игровая сетка: MAX_ROWS рядов по WORD_LENGTH пустых ячеек. */
export const createEmptyGrid = (): string[][] =>
    Array.from({ length: MAX_ROWS }, () => Array<string>(WORD_LENGTH).fill(''));

/** Маппинг ответа сервера в локальный цвет плитки. */
export const letterToColor = (s: string): TileColor => {
    if (s === 'CORRECT') return 'correct';
    if (s === 'PRESENT') return 'present';
    return 'absent';
};
