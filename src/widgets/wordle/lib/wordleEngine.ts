/**
 * Цвет плитки в результате проверки догадки: совпадение по позиции, попадание
 * буквы не на свою позицию или отсутствие буквы в загаданном слове.
 */
export type TileColor = 'correct' | 'present' | 'absent';

/**
 * Результат сравнения догадки с загаданным словом.
 */
export interface GuessResult {
    /** Цвета плиток по позициям догадки. */
    colors: TileColor[];
    /** Признак полного совпадения догадки с загаданным словом. */
    isWin: boolean;
}

/** Количество букв в одном слове. */
export const WORD_LENGTH = 5;
/** Максимальное число попыток на партию. */
export const MAX_ROWS = 6;

/**
 * Сравнивает догадку с загаданным словом и возвращает раскраску плиток.
 *
 * Сначала помечаются позиции с точным совпадением (использованные буквы цели
 * замещаются заглушкой, чтобы не учитываться повторно), затем оставшиеся
 * позиции проверяются на присутствие буквы в цели. Так корректно обрабатывается
 * случай повторяющихся букв.
 *
 * @param guess Догадка пользователя.
 * @param target Загаданное слово.
 * @returns Цвета плиток по позициям догадки и флаг победы.
 */
export const scoreGuess = (guess: string, target: string): GuessResult => {
    const guessArr = guess.split('');
    const targetArr = target.split('');
    const colors: TileColor[] = Array(WORD_LENGTH).fill('absent');

    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guessArr[i] === targetArr[i]) {
            colors[i] = 'correct';
            targetArr[i] = '#';
        }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
        if (colors[i] === 'correct') continue;
        const idx = targetArr.indexOf(guessArr[i]);
        if (idx !== -1) {
            colors[i] = 'present';
            targetArr[idx] = '#';
        }
    }

    return { colors, isWin: guess === target };
};

/**
 * Проверяет, что строка является одной русской заглавной буквой.
 *
 * @param key Проверяемая строка (обычно нажатая клавиша).
 * @returns true, если это допустимая для ввода буква.
 */
export const isValidLetter = (key: string): boolean => /^[А-ЯЁ]$/.test(key);

/**
 * Создаёт пустую игровую сетку: {@link MAX_ROWS} рядов по {@link WORD_LENGTH} пустых ячеек.
 *
 * @returns Двумерный массив пустых строк.
 */
export const createEmptyGrid = (): string[][] =>
    Array.from({ length: MAX_ROWS }, () => Array<string>(WORD_LENGTH).fill(''));
