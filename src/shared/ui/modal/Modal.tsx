/**
 * Универсальное модальное окно поверх содержимого страницы.
 *
 * Реализация Unit 13. В отличие от прежнего императивного варианта, который
 * сам клал overlay в `document.body`, новый Modal пушит VNode в сигнальный
 * `modalStack` из `@shared/lib/portal`. Каждый layout-shell рендерит у себя
 * `<ModalRoot/>`, который через createPortal отправляет содержимое стека в
 * локальный `<div id="modal-root"/>`. Поэтому Modal больше не зависит от
 * `document.body` и корректно живёт внутри peer-эксклюзивных layout-ов.
 *
 * Публичный API сохраняется: класс с методами `open`, `close`, `isOpen` и
 * опциями `onClose`, `closeOnOverlayClick`, `overlayClassName`. Это позволяет
 * постепенно мигрировать вызовы без массовой правки сайтов вызовов.
 *
 * Обратная совместимость по типу контента. Унаследованный код передаёт в
 * `open` либо HTML-строку, либо живой `HTMLElement`, либо (в новом коде)
 * готовый VNode. Все три варианта поддерживаются:
 *   - VNode: используется напрямую как ребёнок оверлея;
 *   - HTMLElement: монтируется через callback-ref на пустой `<div>`, который
 *     при появлении в DOM добавляет переданный элемент в себя через appendChild;
 *   - string: воспринимается как HTML-разметка и устанавливается через
 *     `innerHTML` на пустой `<div>` callback-ref-ом. Это сознательная уступка
 *     совместимости: VDOM не предоставляет безопасного html-пропа, а текущая
 *     поверхность вызывающего кода рассчитывает именно на HTML.
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

/**
 * Допустимые формы содержимого модалки.
 *
 * VNode используется новыми вызывающими, HTMLElement и string остаются ради
 * легаси-сайтов вызовов (RestaurantPage с buildReviewsModal, AddressPicker и
 * подобные), которые ещё не переписаны на JSX.
 */
export type ModalContent = HTMLElement | string | VNode;

/**
 * Проверяет, что значение это VNode (имеет поля type, props, children).
 *
 * Намеренно структурная проверка без `instanceof`: VNode это plain-объект,
 * у которого нет общего класса. Этого набора полей достаточно, чтобы отличить
 * VNode от HTMLElement и от строки в условиях нашего же открытого API.
 *
 * @param value Значение, переданное в open.
 * @returns true, если значение это VNode.
 */
function isVNode(value: unknown): value is VNode {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        'type' in candidate &&
        'props' in candidate &&
        'children' in candidate &&
        Array.isArray(candidate.children)
    );
}

/**
 * Универсальное модальное окно поверх содержимого страницы.
 *
 * Управляет жизненным циклом одного окна: повторный open на уже открытом
 * экземпляре игнорируется, close снимает запись из modalStack и зовёт onClose,
 * isOpen сообщает текущее состояние. Сам контент модалки (формы, кнопки и
 * т.п.) вешается вызывающим кодом.
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
     * Открывает модалку с переданным содержимым.
     *
     * Если модалка уже открыта, метод ничего не делает. Если closeOnOverlayClick
     * не выключено явно, на overlay вешается обработчик клика, закрывающий
     * окно при попадании прямо в затемнение (но не в дочерний контент).
     *
     * @param content VNode, HTML-строка или DOM-узел, который кладётся внутрь overlay.
     */
    open(content: ModalContent): void {
        if (this.pushResult) return;

        const overlayClassName: string = [
            'modal-overlay',
            'modal-overlay_active',
            this.options.overlayClassName,
        ]
            .filter((cls): cls is string => Boolean(cls))
            .join(' ');

        const closeOnOverlayClick = this.options.closeOnOverlayClick !== false;

        const handleOverlayClick = (event: Event): void => {
            const mouseEvent = event as MouseEvent;
            if (!closeOnOverlayClick) return;
            if (mouseEvent.target !== mouseEvent.currentTarget) return;
            this.close();
        };

        const overlayVNode: VNode = (
            <div class={overlayClassName} onClick={handleOverlayClick}>
                {this.renderContent(content)}
            </div>
        ) as VNode;

        this.pushResult = pushModal(overlayVNode, () => {
            this.pushResult = null;
            this.options.onClose?.();
        });
    }

    /**
     * Закрывает модалку: удаляет запись из modalStack и вызывает onClose.
     * На уже закрытом экземпляре безопасен.
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
     * Возвращает VNode-обёртку для содержимого с учётом исходного типа.
     *
     * Для VNode возвращает его как есть: ядро VDOM вставит готовое поддерево
     * внутрь оверлея. Для HTMLElement создаёт пустой `<div>` с callback-ref,
     * который при появлении в документе добавляет внешний узел через
     * appendChild. Для строки делает то же самое, но через `innerHTML`, что
     * сохраняет старую семантику HTML-фрагмента.
     *
     * @param content Содержимое, переданное в open.
     * @returns VNode, готовый к монтированию в оверлей.
     */
    private renderContent(content: ModalContent): VNode {
        if (isVNode(content)) {
            return content;
        }
        if (typeof content === 'string') {
            const html: string = content;
            return (
                <div
                    ref={(el: Element | null): void => {
                        if (el) (el as HTMLElement).innerHTML = html;
                    }}
                />
            ) as VNode;
        }
        const node: HTMLElement = content;
        return (
            <div
                ref={(el: Element | null): void => {
                    if (el) el.appendChild(node);
                }}
            />
        ) as VNode;
    }
}
