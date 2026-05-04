import './wordle.scss';
import { Component } from '@shared/lib/component';
import { Popup } from '@shared/ui/popup';
import { wordleTemplate } from './wordle.tmpl.js';
import { scoreGuess, createEmptyGrid, isValidLetter, WORD_LENGTH, MAX_ROWS, type TileColor } from '../lib/wordleEngine';

const KEYBOARD_LAYOUT: string[][] = [
    ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
    ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
    ['ENTER', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'BACKSPACE'],
];

/**
 * Входные данные виджета {@link Wordle}.
 */
export interface WordleProps {
    /** Колбэк, вызываемый при победе пользователя. */
    onWin?: () => void;
}

/**
 * Виджет игры Wordle на русском языке: модалка с игровым полем, экранной
 * клавиатурой и обработкой ввода с физической клавиатуры. Словарь подгружается
 * лениво при первом открытии.
 */
export class Wordle extends Component<WordleProps> {
    private targetWord = '';
    private validWords = new Set<string>();
    private grid: string[][] = createEmptyGrid();
    private currentRow = 0;
    private currentCol = 0;
    private isGameOver = false;
    private wordsLoaded = false;

    private modal: HTMLElement | null = null;
    private board: HTMLElement | null = null;
    private keyboard: HTMLElement | null = null;
    private toast: HTMLElement | null = null;

    constructor() {
        super(wordleTemplate);
    }

    /**
     * Запоминает ссылки на ключевые DOM-узлы, привязывает обработчики закрытия
     * модалки и глобального ввода с клавиатуры, отрисовывает поле и клавиатуру.
     */
    protected onMount(): void {
        this.modal = this.root?.querySelector('#wordle-modal') ?? null;
        this.board = this.root?.querySelector('.js-wordle-board') as HTMLElement | null;
        this.keyboard = this.root?.querySelector('.js-wordle-keyboard') as HTMLElement | null;
        this.toast = this.root?.querySelector('.js-wordle-toast') as HTMLElement | null;

        const closeBtn = this.root?.querySelector('.js-close-wordle');
        if (closeBtn) this.on(closeBtn, 'click', () => this.close());
        if (this.modal) {
            this.on(this.modal, 'click', (e) => {
                if ((e.target as HTMLElement).id === 'wordle-modal') this.close();
            });
        }
        this.on(document, 'keydown', (e) => this.onKeyDown(e as KeyboardEvent));

        this.renderBoard();
        this.renderKeyboard();
    }

    /**
     * Открывает модалку Wordle. При первом вызове лениво подгружает словарь и
     * запоминает слово дня, затем сбрасывает партию.
     *
     * @returns Промис, разрешающийся после загрузки словаря и открытия модалки.
     */
    async open(): Promise<void> {
        if (!this.wordsLoaded) {
            const words = await import('../lib/words');
            this.targetWord = words.DAILY_WORD;
            this.validWords = new Set(words.VALID_WORDS);
            this.wordsLoaded = true;
        }
        this.startNewGame();
        this.modal?.classList.add('modal-overlay_active');
    }

    /**
     * Закрывает модалку Wordle, не сбрасывая текущую партию.
     */
    close(): void {
        this.modal?.classList.remove('modal-overlay_active');
    }

    /**
     * Сбрасывает игровое состояние и перерисовывает поле и клавиатуру.
     */
    private startNewGame(): void {
        this.grid = createEmptyGrid();
        this.currentRow = 0;
        this.currentCol = 0;
        this.isGameOver = false;
        this.renderBoard();
        this.renderKeyboard();
    }

    /**
     * Полностью перерисовывает игровое поле по текущему состоянию сетки.
     */
    private renderBoard(): void {
        if (!this.board) return;
        this.board.innerHTML = '';
        for (let r = 0; r < MAX_ROWS; r++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'wordle-row';
            for (let c = 0; c < WORD_LENGTH; c++) {
                const tile = document.createElement('div');
                tile.className = 'wordle-tile';
                tile.dataset.row = String(r);
                tile.dataset.col = String(c);
                tile.textContent = this.grid[r][c];
                rowEl.appendChild(tile);
            }
            this.board.appendChild(rowEl);
        }
    }

    /**
     * Перерисовывает экранную клавиатуру по фиксированной раскладке и
     * привязывает к каждой кнопке обработчик ввода.
     */
    private renderKeyboard(): void {
        if (!this.keyboard) return;
        this.keyboard.innerHTML = '';
        for (const row of KEYBOARD_LAYOUT) {
            const rowEl = document.createElement('div');
            rowEl.className = 'wordle-keyboard__row';
            for (const key of row) {
                const keyEl = document.createElement('button');
                keyEl.className = `wordle-keyboard__key ${key.length > 1 ? 'wordle-keyboard__key_wide' : ''}`;
                keyEl.dataset.key = key;
                keyEl.textContent = key === 'BACKSPACE' ? '⌫' : key;
                this.on(keyEl, 'click', () => this.handleInput(key));
                rowEl.appendChild(keyEl);
            }
            this.keyboard.appendChild(rowEl);
        }
    }

    /**
     * Проверяет, открыта ли модалка в текущий момент.
     *
     * @returns true, если модалка видима.
     */
    private isOpen(): boolean {
        return this.modal?.classList.contains('modal-overlay_active') ?? false;
    }

    /**
     * Обрабатывает событие нажатия клавиши на физической клавиатуре.
     * Игнорируется, если игра завершена или модалка закрыта.
     *
     * @param e Событие нажатия клавиши.
     */
    private onKeyDown(e: KeyboardEvent): void {
        if (this.isGameOver || !this.isOpen()) return;
        if (e.key === 'Enter') this.handleInput('ENTER');
        else if (e.key === 'Backspace') this.handleInput('BACKSPACE');
        else {
            const key = e.key.toUpperCase();
            if (isValidLetter(key)) this.handleInput(key);
        }
    }

    /**
     * Применяет ввод одного символа или служебной клавиши к текущей строке.
     * Поддерживает BACKSPACE (удаление последней буквы), ENTER (проверка
     * догадки, если строка заполнена) и обычные буквы.
     *
     * @param key Введённая клавиша: буква в верхнем регистре, ENTER или BACKSPACE.
     */
    private handleInput(key: string): void {
        if (this.isGameOver) return;

        if (key === 'BACKSPACE') {
            if (this.currentCol > 0) {
                this.currentCol--;
                this.grid[this.currentRow][this.currentCol] = '';
                this.updateTile(this.currentRow, this.currentCol);
            }
            return;
        }

        if (key === 'ENTER') {
            if (this.currentCol === WORD_LENGTH) this.checkGuess();
            else this.showToast('Слишком короткое слово');
            return;
        }

        if (this.currentCol < WORD_LENGTH) {
            this.grid[this.currentRow][this.currentCol] = key;
            this.updateTile(this.currentRow, this.currentCol);
            this.currentCol++;
        }
    }

    /**
     * Возвращает DOM-элемент плитки по координатам в сетке.
     *
     * @param row Индекс строки.
     * @param col Индекс столбца.
     * @returns Элемент плитки или null, если поле не отрисовано.
     */
    private getTile(row: number, col: number): HTMLElement | null {
        return this.board?.querySelector(`.wordle-tile[data-row="${row}"][data-col="${col}"]`) ?? null;
    }

    /**
     * Возвращает DOM-элемент кнопки экранной клавиатуры по символу.
     *
     * @param key Символ или служебное имя клавиши.
     * @returns Элемент кнопки или null, если клавиатура не отрисована.
     */
    private getKeyButton(key: string): HTMLElement | null {
        return this.keyboard?.querySelector(`.wordle-keyboard__key[data-key="${key}"]`) ?? null;
    }

    /**
     * Обновляет содержимое и состояние одной плитки по текущему значению в сетке.
     *
     * @param row Индекс строки.
     * @param col Индекс столбца.
     */
    private updateTile(row: number, col: number): void {
        const tile = this.getTile(row, col);
        if (!tile) return;
        const letter = this.grid[row][col];
        tile.textContent = letter;
        tile.classList.toggle('filled', !!letter);
    }

    /**
     * Проверяет догадку текущей строки: валидирует слово по словарю,
     * раскрашивает плитки и кнопки клавиатуры, обрабатывает победу или
     * исчерпание попыток.
     *
     * @returns Промис, разрешающийся после применения результата.
     */
    private async checkGuess(): Promise<void> {
        const guess = this.grid[this.currentRow].join('');
        if (!this.validWords.has(guess.toLowerCase())) {
            this.showToast('Такого слова нет в списке');
            return;
        }

        const { colors, isWin } = scoreGuess(guess, this.targetWord);
        this.applyColors(colors, guess);

        if (isWin) {
            this.isGameOver = true;
            setTimeout(async () => {
                await Popup.alert('Победа! Вы отгадали слово дня 🎉');
                this.props.onWin?.();
                this.close();
            }, 500);
        } else if (this.currentRow === MAX_ROWS - 1) {
            this.isGameOver = true;
            setTimeout(async () => {
                await Popup.alert(`Игра окончена! Загаданное слово было: ${this.targetWord}`);
                this.close();
                this.startNewGame();
            }, 500);
        } else {
            this.currentRow++;
            this.currentCol = 0;
        }
    }

    /**
     * Применяет вычисленные цвета к плиткам текущей строки и к кнопкам
     * клавиатуры. Кнопка не понижается из состояния correct.
     *
     * @param colors Цвета плиток по позициям догадки.
     * @param guess Догадка пользователя (по символам соответствует colors).
     */
    private applyColors(colors: TileColor[], guess: string): void {
        for (let i = 0; i < WORD_LENGTH; i++) {
            this.getTile(this.currentRow, i)?.classList.add(colors[i]);
            const keyBtn = this.getKeyButton(guess[i]);
            if (keyBtn && !keyBtn.classList.contains('correct')) {
                keyBtn.classList.remove('present', 'absent');
                keyBtn.classList.add(colors[i]);
            }
        }
    }

    /**
     * Показывает короткое всплывающее уведомление и автоматически скрывает его
     * через две секунды.
     *
     * @param msg Текст уведомления.
     */
    private showToast(msg: string): void {
        if (!this.toast) return;
        this.toast.textContent = msg;
        this.toast.classList.add('wordle-toast_show');
        setTimeout(() => this.toast?.classList.remove('wordle-toast_show'), 2000);
    }
}
