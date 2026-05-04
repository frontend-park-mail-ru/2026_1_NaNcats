import './modal.scss';

/**
 * Опции инициализации модального окна.
 */
export interface ModalOptions {
    /** Колбэк, вызываемый после закрытия модалки. */
    onClose?: () => void;
    /** Закрывать ли модалку по клику на затемнение; по умолчанию true. */
    closeOnOverlayClick?: boolean;
    /** Дополнительный CSS-класс, который будет добавлен на overlay. */
    overlayClassName?: string;
}

/**
 * Универсальное модальное окно поверх содержимого страницы.
 *
 * Создаёт overlay-элемент в document.body и кладёт в него произвольный
 * контент (HTML-строку или DOM-узел). Управляет жизненным циклом одного
 * окна: повторный open на уже открытом экземпляре игнорируется, close
 * снимает обработчик клика по затемнению и удаляет узел из DOM, isOpen
 * сообщает текущее состояние. Сам контент модалки (формы, кнопки и т.п.)
 * вешается вызывающим кодом.
 */
export class Modal {
    private overlay: HTMLDivElement | null = null;
    private overlayClickHandler: ((e: MouseEvent) => void) | null = null;
    private readonly options: ModalOptions;

    /**
     * @param options Опции модалки; по умолчанию пустой объект.
     */
    constructor(options: ModalOptions = {}) {
        this.options = options;
    }

    /**
     * Открывает модалку с переданным содержимым.
     *
     * Если модалка уже открыта, метод ничего не делает. Если closeOnOverlayClick
     * не выключено явно, на overlay вешается обработчик клика, закрывающий
     * окно при попадании прямо в затемнение (но не в дочерний контент).
     *
     * @param content HTML-строка или DOM-узел, который кладётся внутрь overlay.
     */
    open(content: HTMLElement | string): void {
        if (this.overlay) return;

        const overlay = document.createElement('div');
        overlay.className = ['modal-overlay', 'modal-overlay_active', this.options.overlayClassName]
            .filter(Boolean)
            .join(' ');

        if (typeof content === 'string') {
            overlay.innerHTML = content;
        } else {
            overlay.appendChild(content);
        }

        const closeOnOverlayClick = this.options.closeOnOverlayClick !== false;
        if (closeOnOverlayClick) {
            this.overlayClickHandler = (e: MouseEvent) => {
                if (e.target === overlay) this.close();
            };
            overlay.addEventListener('click', this.overlayClickHandler);
        }

        document.body.appendChild(overlay);
        this.overlay = overlay;
    }

    /**
     * Закрывает модалку: снимает обработчик клика, удаляет overlay из DOM
     * и вызывает onClose. На уже закрытом экземпляре безопасен.
     */
    close(): void {
        if (!this.overlay) return;
        if (this.overlayClickHandler) {
            this.overlay.removeEventListener('click', this.overlayClickHandler);
            this.overlayClickHandler = null;
        }
        if (this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this.options.onClose?.();
    }

    /** Возвращает true, если модалка сейчас открыта. */
    isOpen(): boolean {
        return this.overlay !== null;
    }
}
