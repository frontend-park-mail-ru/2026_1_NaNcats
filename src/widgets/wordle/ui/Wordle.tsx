// Виджет игры «5 букв»: модалка с полем 6×5, экранная клавиатура (русская),
// все слова и правила — на бэке. При open подгружаем состояние партии, при
// ENTER отправляем попытку и красим ряд по ответу сервера. После win
// показываем выпавший промокод, после loss — загаданное слово.

import './wordle.scss';

import { computed, effect, onCleanup, signal } from '@shared/lib/signals';
import { For, onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';
import { ApiError } from '@shared/api/http';
import { translateError } from '@shared/lib/errors';
import { wordleApi, type WordleDailyState, type WordleGuessResult, type WordleStatus } from '@entities/wordle';

import {
    MAX_ROWS,
    WORD_LENGTH,
    createEmptyGrid,
    isValidLetter,
    letterToColor,
    type TileColor,
} from '../lib/wordleEngine';

/** Раскладка экранной клавиатуры (последний ряд с ENTER и BACKSPACE). */
const KEYBOARD_LAYOUT: readonly (readonly string[])[] = [
    ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
    ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
    ['ENTER', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'BACKSPACE'],
];

/** Длительность показа тоста в миллисекундах. */
const TOAST_DURATION_MS = 2000;

/** Цвет плитки или null для ещё не сданных рядов. */
type TileColorOrEmpty = TileColor | null;

export interface WordleProps {
    /** Аксессор видимости модалки. При true модалка получает класс `modal-overlay_active`. */
    open: () => boolean;
    /** Колбэк закрытия модалки. Родитель должен обнулить сигнал `open` внутри него. */
    onClose: () => void;
    /** Колбэк при выигрыше до закрытия модалки. */
    onWin?: () => void;
}

/** Пустая матрица цветов плиток размером MAX_ROWS x WORD_LENGTH. */
function createEmptyColors() {
    return Array.from({ length: MAX_ROWS }, () => Array<TileColorOrEmpty>(WORD_LENGTH).fill(null));
}

/** Виджет игры. Состояние партии берётся с бэка при open и после каждого ENTER. */
export function Wordle(props: WordleProps): VNode {
    const grid = signal<readonly (readonly string[])[]>(createEmptyGrid());
    const tileColors = signal<readonly (readonly TileColorOrEmpty[])[]>(createEmptyColors());
    const keyStates = signal<Readonly<Record<string, TileColor | undefined>>>({});
    const currentRow = signal<number>(0);
    const currentCol = signal<number>(0);
    const status = signal<WordleStatus>('PLAYING');
    const targetWord = signal<string>('');
    const currentStreak = signal<number>(0);
    const submitting = signal<boolean>(false);
    const loaded = signal<boolean>(false);
    const toastText = signal<string>('');
    const toastVisible = signal<boolean>(false);
    /** Промо-результат последнего выигрыша; null до конца игры или при проигрыше. */
    const promoCode = signal<string>('');
    const promoCopied = signal<boolean>(false);
    let promoCopiedTimer: ReturnType<typeof setTimeout> | null = null;
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    const isGameOver = computed(() => status() === 'WON' || status() === 'LOST');

    const resetBoard = () => {
        grid.set(createEmptyGrid());
        tileColors.set(createEmptyColors());
        keyStates.set({});
        currentRow.set(0);
        currentCol.set(0);
        status.set('PLAYING');
        targetWord.set('');
        currentStreak.set(0);
        promoCode.set('');
        promoCopied.set(false);
        if (promoCopiedTimer !== null) {
            clearTimeout(promoCopiedTimer);
            promoCopiedTimer = null;
        }
    };

    const applyGuessRow = (rowIdx: number, word: string, letters: readonly TileColor[]) => {
        // Записываем буквы.
        const nextGrid = grid().map((rowArr, r) => {
            if (r !== rowIdx) return rowArr;
            return word.toUpperCase().split('').concat(Array(WORD_LENGTH).fill('')).slice(0, WORD_LENGTH);
        });
        grid.set(nextGrid);

        // И раскраску ряда.
        const nextColors: TileColorOrEmpty[][] = tileColors().map((rowArr, r) => {
            if (r !== rowIdx) return rowArr.slice();
            return letters.slice();
        });
        tileColors.set(nextColors);

        // Подсветка экранной клавиатуры: оставляем состояние с наивысшим
        // приоритетом по всем догадкам (correct > present > absent). Без этого
        // буква, отмеченная present в одной попытке, могла «понизиться» до absent
        // в следующей (другая позиция той же буквы), и наоборот.
        const KEY_PRIORITY: Record<TileColor, number> = { correct: 3, present: 2, absent: 1 };
        const nextKeys: Record<string, TileColor | undefined> = { ...keyStates() };
        const upper = word.toUpperCase();
        for (let i = 0; i < WORD_LENGTH; i += 1) {
            const letter = upper[i];
            const prevColor = nextKeys[letter];
            const nextColor = letters[i];
            if (prevColor === undefined || KEY_PRIORITY[nextColor] > KEY_PRIORITY[prevColor]) {
                nextKeys[letter] = nextColor;
            }
        }
        keyStates.set(nextKeys);
    };

    const hydrateFromState = (state: WordleDailyState) => {
        resetBoard();
        state.guesses.forEach((g, i) => {
            applyGuessRow(
                i,
                g.word,
                g.letters.map((l) => letterToColor(l)),
            );
        });
        status.set(state.status);
        currentStreak.set(state.current_streak);
        targetWord.set(state.target_word ?? '');
        if (state.status === 'PLAYING') {
            currentRow.set(state.guesses.length);
            currentCol.set(0);
        } else {
            currentRow.set(state.guesses.length);
            currentCol.set(0);
        }
    };

    const loadState = async () => {
        try {
            const state = await wordleApi.getDailyState();
            hydrateFromState(state);
            loaded.set(true);
        } catch (e) {
            console.error('wordle: getDailyState failed', e);
            showToast('Не удалось загрузить игру');
        }
    };

    // Показывает тост и прячет его через TOAST_DURATION_MS; активный таймер заменяется новым.
    const showToast = (msg: string) => {
        toastText.set(msg);
        toastVisible.set(true);
        if (toastTimer !== null) {
            clearTimeout(toastTimer);
        }
        toastTimer = setTimeout(() => {
            toastVisible.set(false);
            toastTimer = null;
        }, TOAST_DURATION_MS);
    };

    const writeLetter = (row: number, col: number, letter: string) => {
        const next = grid().map((rowArr, r) => {
            if (r !== row) return rowArr;
            return rowArr.map((cell, c) => (c === col ? letter : cell));
        });
        grid.set(next);
    };

    const submitGuess = async () => {
        const row = currentRow();
        const guess = grid()[row].join('').toLowerCase();
        submitting.set(true);
        let res: WordleGuessResult;
        try {
            res = await wordleApi.makeGuess(guess, crypto.randomUUID());
        } catch (e) {
            submitting.set(false);
            // Если игра уже закончена — подтягиваем актуальное состояние с бэка.
            if (e instanceof ApiError && e.message.toLowerCase().includes('finished')) {
                showToast('Игра на сегодня уже закончена');
                void loadState();
                return;
            }
            showToast(translateError(e, 'Не удалось отправить попытку'));
            return;
        }
        submitting.set(false);

        const colors = res.guess_result.letters.map((l) => letterToColor(l));
        applyGuessRow(row, res.guess_result.word, colors);
        status.set(res.status);
        currentStreak.set(res.current_streak);
        if (res.target_word) targetWord.set(res.target_word);
        if (res.promo_code) promoCode.set(res.promo_code);

        if (res.status === 'PLAYING') {
            currentRow.set(row + 1);
            currentCol.set(0);
            return;
        }

        // Партия закончилась — показать итог.
        if (res.status === 'WON') {
            props.onWin?.();
            setTimeout(() => {
                void Popup.alert('Победа! Слово найдено 🎉');
            }, 500);
        } else {
            setTimeout(() => {
                void Popup.alert(`Игра окончена. Загаданное слово: ${res.target_word ?? ''}`);
            }, 500);
        }
    };

    // Ввод символа или служебной клавиши (BACKSPACE, ENTER) в текущий ряд.
    const handleInput = (key: string) => {
        if (isGameOver()) return;
        if (submitting()) return;

        if (key === 'BACKSPACE') {
            const col = currentCol();
            if (col > 0) {
                const nextCol = col - 1;
                writeLetter(currentRow(), nextCol, '');
                currentCol.set(nextCol);
            }
            return;
        }

        if (key === 'ENTER') {
            if (currentCol() === WORD_LENGTH) {
                void submitGuess();
            } else {
                showToast('Слишком короткое слово');
            }
            return;
        }

        const col = currentCol();
        if (col < WORD_LENGTH) {
            writeLetter(currentRow(), col, key);
            currentCol.set(col + 1);
        }
    };

    const handleKeyDown = (event: Event) => {
        if (!props.open()) return;
        if (isGameOver()) return;
        const ke = event as KeyboardEvent;
        if (ke.key === 'Enter') {
            handleInput('ENTER');
            return;
        }
        if (ke.key === 'Backspace') {
            handleInput('BACKSPACE');
            return;
        }
        const key = ke.key.toUpperCase();
        if (isValidLetter(key)) handleInput(key);
    };

    const handleOverlayClick = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (target && target.id === 'wordle-modal') {
            props.onClose();
        }
    };

    const handleCopyPromo = () => {
        const code = promoCode.peek();
        if (!code) return;
        if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(code).catch(() => {
                /* ignore */
            });
        }
        promoCopied.set(true);
        if (promoCopiedTimer !== null) clearTimeout(promoCopiedTimer);
        promoCopiedTimer = setTimeout(() => {
            promoCopied.set(false);
            promoCopiedTimer = null;
        }, 1800);
    };

    onMount(() => {
        document.addEventListener('keydown', handleKeyDown);
        let lastOpen = false;
        const stopOpenWatcher = effect(() => {
            const nextOpen = props.open();
            // Каждый раз при показе перезагружаем состояние: после выигрыша
            // сегодня и при следующем открытии завтра — оба сценария требуют свежих данных.
            if (nextOpen && !lastOpen) {
                void loadState();
            }
            lastOpen = nextOpen;
        });
        onCleanup(() => {
            document.removeEventListener('keydown', handleKeyDown);
            if (toastTimer !== null) {
                clearTimeout(toastTimer);
                toastTimer = null;
            }
            if (promoCopiedTimer !== null) {
                clearTimeout(promoCopiedTimer);
                promoCopiedTimer = null;
            }
            stopOpenWatcher();
        });
    });

    const modalClass = () => (props.open() ? 'modal-overlay modal-overlay_active' : 'modal-overlay');

    const tileClass = (row: number, col: number) => {
        const letter = grid()[row][col];
        const color = tileColors()[row][col];
        const parts = ['wordle-tile'];
        if (letter) parts.push('filled');
        if (color) parts.push(color);
        return parts.join(' ');
    };

    const keyClass = (key: string) => {
        const parts = ['wordle-keyboard__key'];
        if (key.length > 1) parts.push('wordle-keyboard__key_wide');
        const state = keyStates()[key];
        if (state) parts.push(state);
        return parts.join(' ');
    };

    const toastClass = () =>
        toastVisible() ? 'wordle-toast wordle-toast_show js-wordle-toast' : 'wordle-toast js-wordle-toast';

    const rowIndexes: readonly number[] = Array.from({ length: MAX_ROWS }, (_, i) => i);
    const colIndexes: readonly number[] = Array.from({ length: WORD_LENGTH }, (_, i) => i);

    return (
        <div class={modalClass} id="wordle-modal" onClick={handleOverlayClick}>
            <div class="address-modal wordle-modal" style="width: 500px; position: relative;">
                <div class="address-modal__close js-close-wordle" onClick={() => props.onClose()}>
                    ×
                </div>

                <h2 class="section-title" style="margin-bottom: 12px;">
                    5 Букв
                </h2>

                <Show when={loaded}>
                    <div class="wordle-meta">
                        <span class="wordle-meta__streak">
                            {() => (currentStreak() > 0 ? `Серия: ${currentStreak()} дн. 🔥` : 'Серия: пока пусто')}
                        </span>
                    </div>
                </Show>

                <div class={toastClass}>{toastText}</div>

                <div class="wordle-board js-wordle-board">
                    <For each={() => rowIndexes} key={(r) => r}>
                        {(r) => (
                            <div class="wordle-row">
                                <For each={() => colIndexes} key={(c) => c}>
                                    {(c) => (
                                        <div class={() => tileClass(r, c)} data-row={r} data-col={c}>
                                            {() => grid()[r][c]}
                                        </div>
                                    )}
                                </For>
                            </div>
                        )}
                    </For>
                </div>

                <Show when={() => status() === 'WON' && promoCode() !== ''}>
                    <div class="wordle-reward">
                        <div class="wordle-reward__title">Ваш промокод за победу:</div>
                        <div class="wordle-reward__row">
                            <code class="wordle-reward__code">{promoCode}</code>
                            <button
                                type="button"
                                class={() =>
                                    promoCopied()
                                        ? 'wordle-reward__copy wordle-reward__copy_copied'
                                        : 'wordle-reward__copy'
                                }
                                onClick={handleCopyPromo}
                            >
                                <Show when={promoCopied} fallback={'Скопировать'}>
                                    ✓ Скопировано
                                </Show>
                            </button>
                        </div>
                    </div>
                </Show>

                <Show when={() => status() === 'LOST' && targetWord() !== ''}>
                    <div class="wordle-reward wordle-reward_lost">
                        Загаданное слово: <code class="wordle-reward__code">{targetWord}</code>
                    </div>
                </Show>

                <div class="wordle-keyboard js-wordle-keyboard">
                    <For each={() => KEYBOARD_LAYOUT} key={(_, idx) => idx}>
                        {(row) => (
                            <div class="wordle-keyboard__row">
                                <For each={() => row} key={(key) => key}>
                                    {(key) => (
                                        <button
                                            type="button"
                                            class={() => keyClass(key)}
                                            data-key={key}
                                            onClick={() => handleInput(key)}
                                        >
                                            {key === 'BACKSPACE' ? '⌫' : key}
                                        </button>
                                    )}
                                </For>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
}
