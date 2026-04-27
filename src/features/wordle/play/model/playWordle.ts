const LS_KEY = 'wordle_solved';

export const isSolved = (): boolean => localStorage.getItem(LS_KEY) === 'true';

export const markSolved = (): void => {
    localStorage.setItem(LS_KEY, 'true');
};
