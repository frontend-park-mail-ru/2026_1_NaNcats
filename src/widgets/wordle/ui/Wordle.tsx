// Виджет игры Wordle: модалка с полем 6x5, экранная клавиатура (русская раскладка),
// проверка догадки по словарю, тосты, ленивая подгрузка словаря при первом открытии.
// Видимость модалки контролируется пропом-аксессором `open`, которым владеет родитель.

import './wordle.scss';

import { effect, onCleanup, signal } from '@shared/lib/signals';
import { For, onMount } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';

import {
    MAX_ROWS,
    WORD_LENGTH,
    createEmptyGrid,
    isValidLetter,
    scoreGuess,
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

/** Задержка перед показом итогового Popup после раскраски последнего ряда. */
const RESULT_POPUP_DELAY_MS = 500;

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
function createEmptyColors(): TileColorOrEmpty[][] {
    return Array.from({ length: MAX_ROWS }, () => Array<TileColorOrEmpty>(WORD_LENGTH).fill(null));
}

/** Виджет игры Wordle. Игровое состояние полностью локальное. */
export function Wordle(props: WordleProps): VNode {
    const grid = signal<readonly (readonly string[])[]>(createEmptyGrid());
    const tileColors = signal<readonly (readonly TileColorOrEmpty[])[]>(createEmptyColors());
    const keyStates = signal<Readonly<Record<string, TileColor | undefined>>>({});
    const currentRow = signal<number>(0);
    const currentCol = signal<number>(0);
    const isGameOver = signal<boolean>(false);
    const toastText = signal<string>('');
    const toastVisible = signal<boolean>(false);

    /** Слово дня; пустая строка до загрузки словаря. */
    let targetWord = '';
    /** Допустимые слова в нижнем регистре; пустой Set до загрузки словаря. */
    let validWords: Set<string> = new Set();
    let wordsLoaded = false;
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    const startNewGame = (): void => {
        grid.set(createEmptyGrid());
        tileColors.set(createEmptyColors());
        keyStates.set({});
        currentRow.set(0);
        currentCol.set(0);
        isGameOver.set(false);
    };

    // Лениво подгружает словарь (один раз) и сбрасывает партию.
    const ensureWordsAndReset = async (): Promise<void> => {
        if (!wordsLoaded) {
            const words = await import('../lib/words');
            targetWord = words.DAILY_WORD;
            validWords = new Set(words.VALID_WORDS);
            wordsLoaded = true;
        }
        startNewGame();
    };

    const writeLetter = (row: number, col: number, letter: string): void => {
        const prev = grid();
        const next = prev.map((rowArr, r) => {
            if (r !== row) return rowArr;
            return rowArr.map((cell, c) => (c === col ? letter : cell));
        });
        grid.set(next);
    };

    const writeRowColors = (row: number, colors: readonly TileColor[]): void => {
        const prev = tileColors();
        const next: TileColorOrEmpty[][] = prev.map((rowArr, r) => {
            if (r !== row) return rowArr.slice();
            return colors.slice();
        });
        tileColors.set(next);
    };

    // Обновляет подсветку клавиатуры по результату догадки; из `correct` кнопку не понижаем.
    const updateKeyStates = (colors: readonly TileColor[], guess: string): void => {
        const prev = keyStates();
        const next: Record<string, TileColor | undefined> = { ...prev };
        for (let i = 0; i < WORD_LENGTH; i += 1) {
            const letter = guess[i];
            const prevColor = next[letter];
            const nextColor = colors[i];
            if (prevColor === 'correct') continue;
            if (nextColor === 'correct' || prevColor !== nextColor) {
                next[letter] = nextColor;
            }
        }
        keyStates.set(next);
    };

    // Показывает тост и прячет его через TOAST_DURATION_MS; активный таймер заменяется новым.
    const showToast = (msg: string): void => {
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

    const finishWin = (): void => {
        isGameOver.set(true);
        setTimeout(() => {
            void (async (): Promise<void> => {
                await Popup.alert('Победа! Вы отгадали слово дня 🎉');
                props.onWin?.();
                props.onClose();
            })();
        }, RESULT_POPUP_DELAY_MS);
    };

    // Завершение после исчерпания попыток: показывает слово, закрывает модалку, сбрасывает партию.
    const finishLose = (): void => {
        isGameOver.set(true);
        const word = targetWord;
        setTimeout(() => {
            void (async (): Promise<void> => {
                await Popup.alert(`Игра окончена! Загаданное слово было: ${word}`);
                props.onClose();
                startNewGame();
            })();
        }, RESULT_POPUP_DELAY_MS);
    };

    // Проверка догадки текущего ряда: валидация по словарю, раскраска, победа/поражение.
    const checkGuess = (): void => {
        const row = currentRow();
        const guess = grid()[row].join('');
        if (!validWords.has(guess.toLowerCase())) {
            showToast('Такого слова нет в списке');
            return;
        }

        const { colors, isWin } = scoreGuess(guess, targetWord);
        writeRowColors(row, colors);
        updateKeyStates(colors, guess);

        if (isWin) {
            finishWin();
            return;
        }
        if (row === MAX_ROWS - 1) {
            finishLose();
            return;
        }
        currentRow.set(row + 1);
        currentCol.set(0);
    };

    // Ввод символа или служебной клавиши (BACKSPACE, ENTER) в текущий ряд.
    const handleInput = (key: string): void => {
        if (isGameOver()) return;

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
                checkGuess();
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

    // Физическая клавиатура: игнорируем при закрытой модалке или законченной игре;
    // буквы проходят через isValidLetter (отсекает латиницу и спецсимволы).
    const handleKeyDown = (event: Event): void => {
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

    // Закрывает модалку, только если клик пришёл по самой подложке, а не по содержимому.
    const handleOverlayClick = (event: Event): void => {
        const target = event.target as HTMLElement | null;
        if (target && target.id === 'wordle-modal') {
            props.onClose();
        }
    };

    onMount(() => {
        document.addEventListener('keydown', handleKeyDown);
        // При переходе open() false -> true лениво подгружаем словарь и сбрасываем партию.
        let lastOpen = false;
        const stopOpenWatcher = effect(() => {
            const nextOpen = props.open();
            if (nextOpen && !lastOpen) {
                void ensureWordsAndReset();
            }
            lastOpen = nextOpen;
        });
        onCleanup(() => {
            document.removeEventListener('keydown', handleKeyDown);
            if (toastTimer !== null) {
                clearTimeout(toastTimer);
                toastTimer = null;
            }
            stopOpenWatcher();
        });
    });

    const modalClass = (): string =>
        props.open() ? 'modal-overlay modal-overlay_active' : 'modal-overlay';

    const tileClass = (row: number, col: number): string => {
        const letter = grid()[row][col];
        const color = tileColors()[row][col];
        const parts = ['wordle-tile'];
        if (letter) parts.push('filled');
        if (color) parts.push(color);
        return parts.join(' ');
    };

    // Класс кнопки клавиатуры: служебные клавиши шире, подсветка из keyStates.
    const keyClass = (key: string): string => {
        const parts = ['wordle-keyboard__key'];
        if (key.length > 1) parts.push('wordle-keyboard__key_wide');
        const state = keyStates()[key];
        if (state) parts.push(state);
        return parts.join(' ');
    };

    const toastClass = (): string =>
        toastVisible() ? 'wordle-toast wordle-toast_show js-wordle-toast' : 'wordle-toast js-wordle-toast';

    const rowIndexes: readonly number[] = Array.from({ length: MAX_ROWS }, (_, i) => i);
    const colIndexes: readonly number[] = Array.from({ length: WORD_LENGTH }, (_, i) => i);

    return (
        <div class={modalClass} id="wordle-modal" onClick={handleOverlayClick}>
            <div class="address-modal wordle-modal" style="width: 500px; position: relative;">
                <div
                    class="address-modal__close js-close-wordle"
                    onClick={(): void => props.onClose()}
                >
                    ×
                </div>

                <h2 class="section-title" style="margin-bottom: 20px;">
                    5 Букв
                </h2>

                {/* Тост всегда в DOM, видимость переключается классом `_show` (для CSS-перехода). */}
                <div class={toastClass}>{toastText}</div>

                <div class="wordle-board js-wordle-board">
                    <For each={(): readonly number[] => rowIndexes} key={(r): number => r}>
                        {(r): VNode => (
                            <div class="wordle-row">
                                <For each={(): readonly number[] => colIndexes} key={(c): number => c}>
                                    {(c): VNode => (
                                        <div
                                            class={(): string => tileClass(r, c)}
                                            data-row={r}
                                            data-col={c}
                                        >
                                            {(): string => grid()[r][c]}
                                        </div>
                                    )}
                                </For>
                            </div>
                        )}
                    </For>
                </div>

                <div class="wordle-keyboard js-wordle-keyboard">
                    <For
                        each={(): readonly (readonly string[])[] => KEYBOARD_LAYOUT}
                        key={(_, idx): number => idx}
                    >
                        {(row): VNode => (
                            <div class="wordle-keyboard__row">
                                <For each={(): readonly string[] => row} key={(key): string => key}>
                                    {(key): VNode => (
                                        <button
                                            type="button"
                                            class={(): string => keyClass(key)}
                                            data-key={key}
                                            onClick={(): void => handleInput(key)}
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
    ) as VNode;
}
