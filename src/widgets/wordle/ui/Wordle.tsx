/**
 * Виджет игры Wordle в виде функционального компонента VDOM/JSX.
 *
 * Поведение перенесено из старого `Wordle.ts` 1:1: модалка с полем 6x5,
 * экранная клавиатура с русской раскладкой, проверка догадки по словарю,
 * раскраска плиток и кнопок клавиатуры, тост-уведомления, ленивая
 * подгрузка словаря при первом открытии.
 *
 * Ключевое отличие от старой реализации: видимость модалки контролируется
 * пропом-аксессором `open`, который владеется родителем. Это симметрично
 * паттерну SolidJS: компонент это чистая функция от пропов, он не хранит
 * "глобальный" instance, который снаружи дёргают через `.open()`. Если
 * родитель пока остаётся на classic-`Component` (например, до миграции
 * ProfilePage в Unit 10/11), он создаёт сигнал руками и пробрасывает
 * аксессор сюда.
 *
 * Структура локального состояния (всё через `signal()`):
 *
 * - `grid` сетка букв размером MAX_ROWS x WORD_LENGTH; перерисовывается
 *   через `<For>` по рядам и по плиткам;
 * - `currentRow`, `currentCol` положение курсора ввода;
 * - `tileColors` цвета плиток для уже отправленных рядов;
 * - `keyStates` карта "буква -> цвет" для подсветки клавиатуры;
 * - `isGameOver` блокирует ввод после победы или после исчерпания попыток;
 * - `toastText` текущая подсказка тоста, `toastVisible` его видимость;
 * - `wordsLoaded` техно-флаг ленивой подгрузки словаря.
 *
 * Дисциплина реактивных выражений. Все динамические части (класс модалки,
 * текст плитки, цвет плитки и клавиши, видимость тоста) передаются как
 * inline-аксессоры или сам сигнал. Голые выражения вида `{toastText()}`
 * ниже не использованы.
 *
 * Ленивый словарь. `validWords` хранится в локальной переменной (Set),
 * `targetWord` в обычной строковой переменной (мутируются один раз при
 * загрузке). Импорт словаря динамический (`import('../lib/words')`),
 * чтобы тяжёлый чанк не входил в initial bundle.
 */

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

/**
 * Раскладка экранной клавиатуры. Сначала верхний ряд, затем средний, затем
 * нижний с управляющими клавишами ENTER и BACKSPACE.
 */
const KEYBOARD_LAYOUT: readonly (readonly string[])[] = [
    ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
    ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
    ['ENTER', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'BACKSPACE'],
];

/** Длительность показа тоста в миллисекундах. */
const TOAST_DURATION_MS = 2000;

/** Задержка перед показом итогового Popup после раскраски последнего ряда. */
const RESULT_POPUP_DELAY_MS = 500;

/**
 * Цвет плитки или null для ещё не сданных рядов. Null означает отсутствие
 * соответствующего CSS-класса (`correct`/`present`/`absent`) у плитки.
 */
type TileColorOrEmpty = TileColor | null;

/**
 * Пропсы компонента {@link Wordle}.
 */
export interface WordleProps {
    /**
     * Сигнал-аксессор видимости модалки. Когда возвращает true, модалка
     * получает класс `modal-overlay_active`. Родитель отвечает за сброс
     * пропа в false при закрытии: сам компонент дёргает `onClose`, чтобы
     * родитель синхронизировал сигнал.
     */
    open: () => boolean;
    /**
     * Колбэк закрытия модалки. Компонент вызывает его, когда пользователь
     * нажал крестик или кликнул по подложке, а также после успешного
     * завершения партии. Родитель должен обнулить сигнал `open` внутри
     * этого колбэка.
     */
    onClose: () => void;
    /** Опциональный колбэк, вызываемый при выигрыше до закрытия модалки. */
    onWin?: () => void;
}

/**
 * Создаёт пустую матрицу цветов плиток с тем же ритмом, что и сетка букв.
 *
 * @returns Двумерный массив null-цветов размером MAX_ROWS x WORD_LENGTH.
 */
function createEmptyColors(): TileColorOrEmpty[][] {
    return Array.from({ length: MAX_ROWS }, () => Array<TileColorOrEmpty>(WORD_LENGTH).fill(null));
}

/**
 * Функциональный компонент Wordle. Управляет всем игровым состоянием
 * локально и реактивно перерисовывает поле и клавиатуру при изменении
 * сигналов.
 *
 * @param props Пропсы виджета: контролируемая видимость модалки и колбэки.
 * @returns VNode-дерево модалки.
 */
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
    /** Был ли уже асинхронно подгружен модуль словаря. */
    let wordsLoaded = false;
    /** Текущий таймер автоскрытия тоста, чтобы не множить параллельные. */
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Сбрасывает игровое состояние к начальному: пустая сетка, чистая
     * раскраска плиток и клавиатуры, курсор в левом верхнем углу.
     */
    const startNewGame = (): void => {
        grid.set(createEmptyGrid());
        tileColors.set(createEmptyColors());
        keyStates.set({});
        currentRow.set(0);
        currentCol.set(0);
        isGameOver.set(false);
    };

    /**
     * Лениво подгружает словарь через динамический импорт и сбрасывает
     * партию. Идемпотентно: повторные вызовы после загрузки только
     * сбрасывают партию.
     */
    const ensureWordsAndReset = async (): Promise<void> => {
        if (!wordsLoaded) {
            const words = await import('../lib/words');
            targetWord = words.DAILY_WORD;
            validWords = new Set(words.VALID_WORDS);
            wordsLoaded = true;
        }
        startNewGame();
    };

    /**
     * Иммутабельно копирует сетку и записывает букву в указанную ячейку.
     *
     * @param row Индекс ряда.
     * @param col Индекс столбца.
     * @param letter Новая буква (пустая строка очищает ячейку).
     */
    const writeLetter = (row: number, col: number, letter: string): void => {
        const prev = grid();
        const next = prev.map((rowArr, r) => {
            if (r !== row) return rowArr;
            return rowArr.map((cell, c) => (c === col ? letter : cell));
        });
        grid.set(next);
    };

    /**
     * Иммутабельно записывает массив цветов в указанный ряд `tileColors`.
     *
     * @param row Индекс ряда.
     * @param colors Цвета плиток по столбцам.
     */
    const writeRowColors = (row: number, colors: readonly TileColor[]): void => {
        const prev = tileColors();
        const next: TileColorOrEmpty[][] = prev.map((rowArr, r) => {
            if (r !== row) return rowArr.slice();
            return colors.slice();
        });
        tileColors.set(next);
    };

    /**
     * Иммутабельно обновляет карту состояний клавиатуры по результатам
     * проверки одной догадки. Кнопка не понижается из состояния `correct`:
     * это сохраняет максимально полезную информацию для игрока.
     *
     * @param colors Цвета плиток по позициям догадки.
     * @param guess Догадка пользователя.
     */
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

    /**
     * Показывает короткое сообщение в тосте и автоматически прячет его
     * через {@link TOAST_DURATION_MS} миллисекунд. Если уже был активный
     * тост, его таймер заменяется новым.
     *
     * @param msg Текст сообщения.
     */
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

    /**
     * Завершает партию после победы: помечает игру оконченной, показывает
     * поздравительный Popup, вызывает внешний `onWin` и закрывает модалку.
     */
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

    /**
     * Завершает партию после исчерпания попыток: помечает игру оконченной,
     * показывает Popup с правильным словом, закрывает модалку и сбрасывает
     * партию (чтобы при следующем открытии было поле с нуля).
     */
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

    /**
     * Проверяет догадку текущего ряда: валидирует по словарю, раскрашивает
     * плитки и кнопки клавиатуры, обрабатывает победу или поражение.
     */
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

    /**
     * Применяет ввод одного символа или служебной клавиши к текущему ряду.
     * Поддерживает BACKSPACE (удаление последней буквы), ENTER (проверка
     * догадки, если ряд заполнен) и обычные буквы.
     *
     * @param key Введённая клавиша: буква в верхнем регистре, ENTER или BACKSPACE.
     */
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

    /**
     * Обработчик нажатий физической клавиатуры. Игнорирует ввод, если
     * модалка закрыта или игра завершена. Enter и Backspace мапятся на
     * управляющие клавиши; обычные буквы пропускаются через
     * `isValidLetter`, что отсекает латиницу и спецсимволы.
     *
     * @param event Событие keydown из документа.
     */
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

    /**
     * Обработчик клика по подложке модалки: если кликнули в саму подложку
     * (а не в её содержимое), сообщает родителю про закрытие.
     *
     * @param event Событие click.
     */
    const handleOverlayClick = (event: Event): void => {
        const target = event.target as HTMLElement | null;
        if (target && target.id === 'wordle-modal') {
            props.onClose();
        }
    };

    onMount(() => {
        document.addEventListener('keydown', handleKeyDown);
        // Реактивно реагируем на смену open(): при переходе false -> true
        // лениво подгружаем словарь и сбрасываем партию. effect отрабатывает
        // синхронно на старте, поэтому "стартовое" значение lastOpen
        // выставляется в первой итерации, и инициализация запускается ровно
        // один раз на открытие, а не на каждое чтение open().
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

    /**
     * Возвращает класс модалки в зависимости от пропа `open`. Класс
     * `modal-overlay_active` включает CSS-видимость поверх базового
     * `modal-overlay`.
     */
    const modalClass = (): string =>
        props.open() ? 'modal-overlay modal-overlay_active' : 'modal-overlay';

    /**
     * Возвращает класс одной плитки по координатам в сетке. Если ряд ещё
     * не сдан, цвет null и в class остаётся только `wordle-tile` плюс
     * `filled` при наличии буквы.
     *
     * @param row Индекс ряда.
     * @param col Индекс столбца.
     * @returns Готовая строка class.
     */
    const tileClass = (row: number, col: number): string => {
        const letter = grid()[row][col];
        const color = tileColors()[row][col];
        const parts = ['wordle-tile'];
        if (letter) parts.push('filled');
        if (color) parts.push(color);
        return parts.join(' ');
    };

    /**
     * Возвращает класс одной кнопки клавиатуры. Управляющие клавиши
     * (ENTER, BACKSPACE) получают модификатор `wordle-keyboard__key_wide`;
     * подсветка по результатам проверки берётся из `keyStates`.
     *
     * @param key Имя клавиши.
     * @returns Готовая строка class.
     */
    const keyClass = (key: string): string => {
        const parts = ['wordle-keyboard__key'];
        if (key.length > 1) parts.push('wordle-keyboard__key_wide');
        const state = keyStates()[key];
        if (state) parts.push(state);
        return parts.join(' ');
    };

    /**
     * Возвращает класс контейнера тоста. Видимость управляется
     * модификатором `wordle-toast_show`.
     */
    const toastClass = (): string =>
        toastVisible() ? 'wordle-toast wordle-toast_show js-wordle-toast' : 'wordle-toast js-wordle-toast';

    /** Индексы рядов сетки (фиксированный массив, нужен для `<For>`). */
    const rowIndexes: readonly number[] = Array.from({ length: MAX_ROWS }, (_, i) => i);
    /** Индексы столбцов сетки (фиксированный массив, нужен для `<For>`). */
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

                {/* Тост всегда в DOM, видимость переключается классом `_show`:
                    так в оригинальной реализации, и так дешевле для CSS-перехода
                    появления. */}
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
