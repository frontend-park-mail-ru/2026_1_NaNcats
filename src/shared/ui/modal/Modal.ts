import './modal.scss';

export interface ModalOptions {
    onClose?: () => void;
    closeOnOverlayClick?: boolean;
    overlayClassName?: string;
}

export class Modal {
    private overlay: HTMLDivElement | null = null;
    private overlayClickHandler: ((e: MouseEvent) => void) | null = null;
    private readonly options: ModalOptions;

    constructor(options: ModalOptions = {}) {
        this.options = options;
    }

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

    isOpen(): boolean {
        return this.overlay !== null;
    }
}
