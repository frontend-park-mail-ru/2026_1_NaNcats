import './wordle.scss';
import { Component } from '../../../core/Component';
import { wordleTemplate } from './wordle.tmpl';
import { Popup } from '../popup/Popup';
import { DAILY_WORD, VALID_WORDS } from './words';

const KEYBOARD_LAYOUT = [
    ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
    ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
    ['ENTER', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'BACKSPACE']
];

export class Wordle extends Component {
    private targetWord: string = DAILY_WORD;
    private currentRow: number = 0;
    private currentCol: number = 0;
    private grid: string[][] = Array.from({ length: 6 }, () => Array(5).fill(''));
    private isGameOver: boolean = false;
    private onWinCallback?: () => void;

    // Привязываем метод к контексту, чтобы можно было удалять слушатель
    private handlePhysicalKeyboard = this.onKeyDown.bind(this);

    constructor(onWin?: () => void) {
        super(wordleTemplate);
        this.onWinCallback = onWin;
        this.startNewGame();
    }

    private startNewGame() {
        this.targetWord = DAILY_WORD;
        this.currentRow = 0;
        this.currentCol = 0;
        this.grid = Array.from({ length: 6 }, () => Array(5).fill(''));
        this.isGameOver = false;
        this.renderBoard();
        this.renderKeyboard();
    }

    public open(): void {
        const modal = this.element?.querySelector('#wordle-modal');
        if (modal) {
            modal.classList.add('modal-overlay_active');
            document.addEventListener('keydown', this.handlePhysicalKeyboard);
        }
    }

    public close(): void {
        const modal = this.element?.querySelector('#wordle-modal');
        if (modal) {
            modal.classList.remove('modal-overlay_active');
            document.removeEventListener('keydown', this.handlePhysicalKeyboard);
        }
    }

    public afterRender(): void {
        this.renderBoard();
        this.renderKeyboard();

        this.element?.querySelector('#close-wordle-modal')?.addEventListener('click', () => {
            this.close();
        });

        // Закрытие по клику вне модалки
        this.element?.querySelector('#wordle-modal')?.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).id === 'wordle-modal') {
                this.close();
            }
        });
    }

    private renderBoard() {
        const board = this.element?.querySelector('#wordle-board');
        if (!board) return;

        board.innerHTML = '';
        for (let r = 0; r < 6; r++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'wordle-row';
            for (let c = 0; c < 5; c++) {
                const tile = document.createElement('div');
                tile.className = 'wordle-tile';
                tile.id = `tile-${r}-${c}`;
                tile.textContent = this.grid[r][c];
                rowEl.appendChild(tile);
            }
            board.appendChild(rowEl);
        }
    }

    private renderKeyboard() {
        const keyboard = this.element?.querySelector('#wordle-keyboard');
        if (!keyboard) return;

        keyboard.innerHTML = '';
        KEYBOARD_LAYOUT.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'wordle-keyboard__row';
            
            row.forEach(key => {
                const keyEl = document.createElement('button');
                keyEl.className = `wordle-keyboard__key ${key.length > 1 ? 'wordle-keyboard__key_wide' : ''}`;
                keyEl.id = `key-${key}`;
                keyEl.textContent = key === 'BACKSPACE' ? '⌫' : key;
                keyEl.onclick = () => this.handleInput(key);
                rowEl.appendChild(keyEl);
            });
            keyboard.appendChild(rowEl);
        });
    }

    private onKeyDown(e: KeyboardEvent) {
        if (this.isGameOver) return;
        
        if (e.key === 'Enter') {
            this.handleInput('ENTER');
        } else if (e.key === 'Backspace') {
            this.handleInput('BACKSPACE');
        } else {
            const key = e.key.toUpperCase();
            if (/^[А-ЯЁ]$/.test(key)) {
                this.handleInput(key);
            }
        }
    }

    private handleInput(key: string) {
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
            if (this.currentCol === 5) {
                this.checkGuess();
            } else {
                this.showToast('Слишком короткое слово');
            }
            return;
        }

        // Ввод буквы
        if (this.currentCol < 5) {
            this.grid[this.currentRow][this.currentCol] = key;
            this.updateTile(this.currentRow, this.currentCol);
            this.currentCol++;
        }
    }

    private updateTile(row: number, col: number) {
        const tile = this.element?.querySelector(`#tile-${row}-${col}`) as HTMLElement;
        if (!tile) return;
        
        const letter = this.grid[row][col];
        tile.textContent = letter;
        
        if (letter) {
            tile.classList.add('filled');
        } else {
            tile.classList.remove('filled');
        }
    }

    private async checkGuess() {
        const guess = this.grid[this.currentRow].join('');

        if (!VALID_WORDS.includes(guess.toLowerCase())) {
            this.showToast('Такого слова нет в списке');
            // Трясем плитку для визуального фидбека (опционально)
            return; 
        }

        const targetArr = this.targetWord.split('');
        const guessArr = guess.split('');
        const colors = Array(5).fill('absent');

        // Первый проход: ищем точные совпадения (зеленые)
        for (let i = 0; i < 5; i++) {
            if (guessArr[i] === targetArr[i]) {
                colors[i] = 'correct';
                targetArr[i] = '#'; // помечаем, что буква использована
            }
        }

        // Второй проход: ищем присутствующие буквы (желтые/оранжевые)
        for (let i = 0; i < 5; i++) {
            if (colors[i] !== 'correct' && targetArr.includes(guessArr[i])) {
                colors[i] = 'present';
                targetArr[targetArr.indexOf(guessArr[i])] = '#'; // помечаем
            }
        }

        // Применяем цвета к сетке и клавиатуре
        for (let i = 0; i < 5; i++) {
            const tile = this.element?.querySelector(`#tile-${this.currentRow}-${i}`);
            tile?.classList.add(colors[i]);

            const keyBtn = this.element?.querySelector(`#key-${guessArr[i]}`);
            if (keyBtn) {
                // Если кнопка уже зеленая, не перекрашиваем в желтый или серый
                if (!keyBtn.classList.contains('correct')) {
                    keyBtn.classList.remove('present', 'absent');
                    keyBtn.classList.add(colors[i]);
                }
            }
        }

        if (guess === this.targetWord) {
            this.isGameOver = true;
            setTimeout(async () => {
                await Popup.alert(`Победа! Вы отгадали слово дня 🎉`);
                if (this.onWinCallback) this.onWinCallback();
                this.close();
            }, 500);
        } else if (this.currentRow === 5) {
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

    private showToast(msg: string) {
        const toast = this.element?.querySelector('#wordle-toast');
        if (toast) {
            toast.textContent = msg;
            toast.classList.add('wordle-toast_show');
            setTimeout(() => {
                toast.classList.remove('wordle-toast_show');
            }, 2000);
        }
    }
}
