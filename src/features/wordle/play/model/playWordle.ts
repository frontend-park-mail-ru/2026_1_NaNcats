const LS_KEY = 'wordle_solved';

/**
 * Проверяет, отмечена ли в локальном хранилище мини-игра Wordle как решённая.
 *
 * @returns `true`, если флаг решения установлен.
 */
export const isSolved = (): boolean => localStorage.getItem(LS_KEY) === 'true';

/**
 * Помечает мини-игру Wordle как решённую в локальном хранилище.
 */
export const markSolved = (): void => {
    localStorage.setItem(LS_KEY, 'true');
};
