/**
 * Универсальное модальное окно поверх содержимого страницы. Пушит VNode в
 * сигнальный `modalStack` из `@shared/lib/portal`; каждый layout-shell
 * рендерит у себя `<ModalRoot/>`, который через createPortal отправляет
 * содержимое стека в локальный `<div id="modal-root"/>`.
 *
 * Контент open принимает три формы: VNode (используется напрямую), HTMLElement
 * (вставляется через callback-ref на пустой `<div>` через appendChild) и
 * string (HTML-разметка, ставится через `innerHTML` на пустой `<div>`).
 */

import './modal.scss';

import { pushModal } from '@shared/lib/portal';
import type { PushResult } from '@shared/lib/portal';
import type { VNode } from '@shared/lib/vdom';

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

/** Допустимые формы содержимого модалки. */
export type ModalContent = HTMLElement | string | VNode;

/**
 * Структурная проверка, что значение это VNode (есть поля type, props,
 * children). instanceof не годится: VNode это plain-объект.
 *
 * @param value Значение, переданное в open.
 * @returns true, если значение это VNode.
 */
function isVNode(value: unknown): value is VNode {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return 'type' in candidate && 'props' in candidate && 'children' in candidate && Array.isArray(candidate.children);
}

/**
 * Универсальное модальное окно поверх содержимого страницы. Управляет
 * жизненным циклом одного окна: повторный open игнорируется, close снимает
 * запись из modalStack и зовёт onClose, isOpen сообщает состояние.
 */
export class Modal {
    private pushResult: PushResult | null = null;
    private readonly options: ModalOptions;

    /**
     * @param options Опции модалки; по умолчанию пустой объект.
     */
    constructor(options: ModalOptions = {}) {
        this.options = options;
    }

    /**
     * Открывает модалку с переданным содержимым. Если модалка уже открыта,
     * ничего не делает. Если closeOnOverlayClick не выключено, клик прямо по
     * затемнению закрывает окно.
     *
     * @param content VNode, HTML-строка или DOM-узел, который кладётся внутрь overlay.
     */
    open(content: ModalContent): void {
        if (this.pushResult) return;

        const overlayClassName = ['modal-overlay', 'modal-overlay_active', this.options.overlayClassName]
            .filter((cls): cls is string => Boolean(cls))
            .join(' ');

        const closeOnOverlayClick = this.options.closeOnOverlayClick !== false;

        const handleOverlayClick = (event: Event) => {
            const mouseEvent = event as MouseEvent;
            if (!closeOnOverlayClick) return;
            if (mouseEvent.target !== mouseEvent.currentTarget) return;
            this.close();
        };

        const overlayVNode = (
            <div class={overlayClassName} onClick={handleOverlayClick}>
                {this.renderContent(content)}
            </div>
        );

        this.pushResult = pushModal(overlayVNode, () => {
            this.pushResult = null;
            this.options.onClose?.();
        });
    }

    /**
     * Закрывает модалку: удаляет запись из modalStack и вызывает onClose.
     * Безопасен на уже закрытом экземпляре.
     */
    close(): void {
        if (!this.pushResult) return;
        const result = this.pushResult;
        this.pushResult = null;
        result.close();
    }

    /** Возвращает true, если модалка сейчас открыта. */
    isOpen(): boolean {
        return this.pushResult !== null;
    }

    /**
     * Возвращает VNode-обёртку для содержимого: VNode как есть, HTMLElement
     * через callback-ref с appendChild на пустой `<div>`, строку через
     * `innerHTML` на пустой `<div>`.
     *
     * @param content Содержимое, переданное в open.
     * @returns VNode, готовый к монтированию в оверлей.
     */
    private renderContent(content: ModalContent): VNode {
        if (isVNode(content)) {
            return content;
        }
        if (typeof content === 'string') {
            const html = content;
            return (
                <div
                    ref={(el: Element | null) => {
                        if (el) (el as HTMLElement).innerHTML = html;
                    }}
                />
            );
        }
        const node = content;
        return (
            <div
                ref={(el: Element | null) => {
                    if (el) el.appendChild(node);
                }}
            />
        );
    }
}
