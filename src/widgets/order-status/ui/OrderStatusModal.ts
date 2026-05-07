import './orderStatusModal.scss';
import { Component } from '@shared/lib/component';
import {
    connectOrderTracker,
    normalizeOrder,
    orderApi,
    type GatewayWsEvent,
    type NormalizedOrder,
    type Order,
    type OrderTracker,
    type OrderUiStatus,
} from '@entities/order';
import { orderStatusModalTemplate } from './orderStatusModal.tmpl.js';

/**
 * Один шаг прогресс-бара статусов заказа.
 */
interface ProgressStep {
    /** Идентификатор статуса, к которому относится шаг. */
    key: OrderUiStatus;
    /** Достигнут ли этот статус (включая текущий). */
    reached: boolean;
    /** Является ли этот шаг текущим. */
    current: boolean;
}

/**
 * Заранее отформатированные поля заказа для шаблона.
 */
interface FormattedFields {
    /** Дата заказа в формате DD.MM. */
    dateLabel: string;
    /** Итоговая сумма заказа в рублях. */
    totalLabel: string;
    /** Количество отзывов о ресторане в человекочитаемом виде. */
    reviewsLabel: string;
    /** Текст текущего статуса заказа. */
    statusText: string;
}

/**
 * Входные данные виджета {@link OrderStatusModal}.
 */
interface OrderStatusModalProps {
    /** Нормализованный заказ или null, если модалка не активирована. */
    order: NormalizedOrder | null;
    /** Шаги прогресс-бара статусов. */
    steps: ProgressStep[];
    /** Отформатированные поля заказа для шаблона. */
    formatted: FormattedFields;
    /** Показывать ли кнопку оплаты. */
    showPaymentButton: boolean;
    /** Показывать ли кнопку отмены заказа. */
    showCancelButton: boolean;
    /** Показывать ли спиннер ожидания подтверждения оплаты. */
    showProcessing: boolean;
    /** Текст ошибки для отображения (пустая строка, если ошибки нет). */
    errorText: string;
}

const PAYMENT_TIMEOUT_MS = 60_000;

const CANCELLABLE_STATUSES = new Set<OrderUiStatus>(['awaiting_payment', 'created']);

const STATUS_FLOW: OrderUiStatus[] = ['created', 'cooking', 'delivering', 'delivered'];

const STATUS_TEXT: Record<OrderUiStatus, (eta: number) => string> = {
    awaiting_payment: () => 'Ожидаем оплату',
    created: () => 'Ваш заказ принят',
    cooking: (eta) => `Готовим — будет через ${eta} минут :)`,
    delivering: (eta) => `Будем у Вас через ${eta} минут :)`,
    delivered: () => 'Заказ доставлен. Приятного аппетита!',
    cancelled: () => 'Заказ отменён',
};

/**
 * Строит шаги прогресс-бара по текущему статусу заказа. Для отменённых и
 * ожидающих оплату заказов шаги остаются недостигнутыми.
 *
 * @param status Текущий UI-статус заказа.
 * @returns Список шагов с пометками достижения и текущего шага.
 */
function buildSteps(status: OrderUiStatus): ProgressStep[] {
    if (status === 'cancelled') {
        return STATUS_FLOW.map((key) => ({ key, reached: false, current: false }));
    }
    if (status === 'awaiting_payment') {
        return STATUS_FLOW.map((key) => ({ key, reached: false, current: false }));
    }
    const currentIdx = STATUS_FLOW.indexOf(status);
    return STATUS_FLOW.map((key, idx) => ({
        key,
        reached: idx <= currentIdx,
        current: idx === currentIdx,
    }));
}

/**
 * Приводит дату к виду DD.MM. Поддерживает как ISO-строки, так и заранее
 * сформированные строки DD.MM.YYYY. Для невалидного значения возвращает
 * исходную строку.
 *
 * @param value Дата в произвольном формате.
 * @returns Дата вида DD.MM или исходная строка.
 */
function formatDate(value: string): string {
    if (!value) return '';
    const ddmmyyyy = /^(\d{2})\.(\d{2})\.\d{4}$/.exec(value);
    if (ddmmyyyy) return `${ddmmyyyy[1]}.${ddmmyyyy[2]}`;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
}

/**
 * Переводит сумму из микрорублей в рубли без дробной части.
 *
 * @param micros Сумма в микрорублях.
 * @returns Целое число рублей в виде строки.
 */
function formatRubles(micros: number): string {
    return (micros / 1_000_000).toFixed(0);
}

/**
 * Форматирует количество отзывов: тысячи округляются вниз с суффиксом 000+.
 *
 * @param count Точное число отзывов.
 * @returns Человекочитаемая строка, например 1000+ или 42.
 */
function formatReviews(count: number): string {
    if (count >= 1000) return `${Math.floor(count / 1000)}000+`;
    return String(count);
}

/**
 * Собирает пропсы виджета по нормализованному заказу. Для null-заказа
 * возвращает пустой каркас, не показывающий шаги и кнопки.
 *
 * @param order Нормализованный заказ или null.
 * @param opts Дополнительные параметры отрисовки.
 * @param opts.processing Показывать ли индикатор ожидания подтверждения оплаты.
 * @returns Пропсы для шаблона модалки.
 */
function buildProps(order: NormalizedOrder | null, opts: { processing?: boolean } = {}): OrderStatusModalProps {
    if (!order) {
        return {
            order: null,
            steps: [],
            formatted: { dateLabel: '', totalLabel: '', reviewsLabel: '', statusText: '' },
            showPaymentButton: false,
            showCancelButton: false,
            showProcessing: false,
            errorText: '',
        };
    }
    const processing = Boolean(opts.processing);
    return {
        order,
        steps: buildSteps(order.status),
        formatted: {
            dateLabel: formatDate(order.created_at),
            totalLabel: formatRubles(order.total_cost),
            reviewsLabel: formatReviews(order.restaurant.reviews_count ?? 0),
            statusText: STATUS_TEXT[order.status](order.eta_minutes),
        },
        showPaymentButton: !processing && order.status === 'awaiting_payment' && Boolean(order.payment_url),
        showCancelButton: !processing && CANCELLABLE_STATUSES.has(order.status),
        showProcessing: processing,
        errorText: order.error ?? '',
    };
}

/**
 * Модалка статуса заказа.
 *
 * Показывает прогресс-бар, поля заказа, кнопки оплаты и отмены. Подключается
 * к WebSocket-трекеру обновлений: статус и URL оплаты приходят событиями
 * `GatewayWsEvent`. Кнопка оплаты переводит модалку в состояние ожидания
 * подтверждения с таймаутом, после которого показывается сообщение об ошибке.
 */
export class OrderStatusModal extends Component<OrderStatusModalProps> {
    private overlay: HTMLElement | null = null;
    private tracker: OrderTracker | null = null;
    private keepTrackerAcrossRerender = false;
    private onCloseCallback: (() => void) | null = null;
    private paymentTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    private isProcessingPayment = false;

    constructor() {
        super(orderStatusModalTemplate);
    }

    /**
     * Возвращает начальные пропсы модалки до получения данных заказа.
     *
     * @returns Пустые пропсы, не показывающие шаги и кнопки.
     */
    static initialProps(): OrderStatusModalProps {
        return buildProps(null);
    }

    /**
     * Запоминает оверлей, привязывает обработчики закрытия (по фону и по
     * крестику), кнопок оплаты и отмены, активирует оверлей, если заказ уже
     * передан в пропсах.
     */
    protected onMount(): void {
        this.overlay = this.root?.querySelector('#order-status-modal') as HTMLElement | null;

        if (this.overlay) {
            this.on(this.overlay, 'click', (e) => {
                const target = e.target as HTMLElement;
                if (target.id === 'order-status-modal') this.close();
            });
        }

        const closeBtn = this.root?.querySelector('.js-close-order-status');
        if (closeBtn) this.on(closeBtn, 'click', () => this.close());

        const payBtn = this.root?.querySelector('.js-pay-order');
        if (payBtn) {
            this.on(payBtn, 'click', () => {
                const order = this.props.order;
                if (!order?.payment_url) return;
                this.beginPaymentProcessing();
                window.open(order.payment_url, '_blank', 'noopener');
            });
        }

        const cancelBtn = this.root?.querySelector('.js-cancel-order');
        if (cancelBtn) {
            this.on(cancelBtn, 'click', () => void this.handleCancel());
        }

        if (this.props.order) {
            this.overlay?.classList.add('modal-overlay_active');
        }
    }

    /**
     * Переводит модалку в состояние ожидания подтверждения оплаты: показывает
     * спиннер, скрывает кнопки и запускает таймер таймаута, по истечении
     * которого выводится сообщение об ошибке. Повторный вызов игнорируется.
     */
    private beginPaymentProcessing(): void {
        if (this.isProcessingPayment) return;
        this.isProcessingPayment = true;

        const order = this.props.order;
        if (order) this.rerender(buildProps(order, { processing: true }));

        if (this.paymentTimeoutTimer !== null) clearTimeout(this.paymentTimeoutTimer);
        this.paymentTimeoutTimer = setTimeout(() => {
            this.paymentTimeoutTimer = null;
            if (!this.isProcessingPayment) return;
            this.isProcessingPayment = false;
            const cur = this.props.order;
            if (!cur) return;
            const next = {
                ...cur,
                error: 'Не удалось подтвердить оплату. Проверьте интернет/VPN и попробуйте ещё раз.',
            };
            this.rerender(buildProps(next, { processing: false }));
        }, PAYMENT_TIMEOUT_MS);
    }

    /**
     * Сбрасывает состояние ожидания оплаты и отменяет таймер таймаута.
     */
    private endPaymentProcessing(): void {
        this.isProcessingPayment = false;
        if (this.paymentTimeoutTimer !== null) {
            clearTimeout(this.paymentTimeoutTimer);
            this.paymentTimeoutTimer = null;
        }
    }

    /**
     * Перерисовывает виджет, не отключая активный WebSocket-трекер. Перед
     * вызовом update выставляется флаг, по которому onDestroy не закрывает
     * соединение.
     *
     * @param props Новые пропсы для отрисовки.
     */
    private rerender(props: OrderStatusModalProps): void {
        this.keepTrackerAcrossRerender = true;
        try {
            this.update(props);
        } finally {
            this.keepTrackerAcrossRerender = false;
        }
    }

    /**
     * Запрашивает у пользователя подтверждение и отменяет заказ через API.
     * При успехе локально применяет событие со статусом cancelled, при ошибке
     * показывает сообщение пользователю.
     *
     * @returns Промис, разрешающийся после завершения операции отмены.
     */
    private async handleCancel(): Promise<void> {
        const orderId = this.props.order?.order_id;
        if (!orderId) return;
        if (!window.confirm('Отменить заказ? Это действие нельзя отменить.')) return;

        try {
            await orderApi.cancel(orderId);
            this.applyEvent({ order_id: orderId, status: 'cancelled' });
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Не удалось отменить заказ';
            window.alert(msg);
        }
    }

    /**
     * Закрывает WebSocket-трекер при размонтировании, кроме случаев, когда
     * размонтирование вызвано перерисовкой через {@link rerender}.
     */
    protected onDestroy(): void {
        if (this.keepTrackerAcrossRerender) return;
        this.disconnectTracker();
    }

    /**
     * Открывает модалку для заданного заказа.
     *
     * Нормализует заказ, сбрасывает предыдущие подписки и состояние, активирует
     * оверлей. При options.subscribe и нетерминальном статусе подключается к
     * трекеру обновлений: дальнейшие обновления статуса и URL оплаты приходят
     * по WebSocket.
     *
     * @param rawOrder Заказ в исходном представлении API.
     * @param options Параметры открытия.
     * @param options.subscribe Подписаться на live-обновления заказа.
     * @param options.onClose Колбэк закрытия модалки.
     */
    open(rawOrder: Order, options: { subscribe?: boolean; onClose?: () => void } = {}): void {
        const order = normalizeOrder(rawOrder);
        this.disconnectTracker();
        this.endPaymentProcessing();
        this.onCloseCallback = options.onClose ?? null;
        this.update(buildProps(order));
        this.overlay?.classList.add('modal-overlay_active');

        if (options.subscribe && !isTerminalRawStatus(order.raw_status)) {
            this.subscribeToOrder(order.order_id);
        }
    }

    /**
     * Закрывает модалку, сбрасывает все активные подписки и таймеры и
     * вызывает зарегистрированный колбэк onClose, если он был задан.
     */
    close(): void {
        this.disconnectTracker();
        this.endPaymentProcessing();
        this.overlay?.classList.remove('modal-overlay_active');
        const cb = this.onCloseCallback;
        this.onCloseCallback = null;
        if (cb) cb();
    }

    /**
     * Подключается к WebSocket-трекеру обновлений заказа и применяет каждое
     * полученное событие к текущему состоянию.
     *
     * @param orderId Идентификатор заказа для отслеживания.
     */
    private subscribeToOrder(orderId: string): void {
        this.tracker = connectOrderTracker(orderId, {
            onEvent: (event) => this.applyEvent(event),
        });
    }

    /**
     * Закрывает активный WebSocket-трекер, если он был.
     */
    private disconnectTracker(): void {
        if (this.tracker) {
            this.tracker.close();
            this.tracker = null;
        }
    }

    /**
     * Применяет событие из WebSocket-трекера к текущему заказу: обновляет
     * статус, URL оплаты и текст ошибки, перерисовывает виджет, при
     * подтверждении оплаты или терминальном статусе сбрасывает состояние
     * ожидания.
     *
     * @param event Событие шлюза с обновлением заказа.
     */
    private applyEvent(event: GatewayWsEvent): void {
        const current = this.props.order;
        if (!current) return;

        const merged: Order = {
            order_id: current.order_id,
            status: event.status,
            total_cost: current.total_cost,
            created_at: current.created_at,
            restaurant_id: current.restaurant.id,
            restaurant_name: current.restaurant.name,
            restaurant_image_url: current.restaurant.image_url,
            restaurant_rating: current.restaurant.rating,
            restaurant_reviews_count: current.restaurant.reviews_count,
            items: current.items,
            service_fee: current.service_fee,
            delivery_cost: current.delivery_cost,
            eta_minutes: current.eta_minutes,
            payment_url: event.payment_url ?? current.payment_url,
        };
        const next = normalizeOrder(merged);
        next.error = event.error;

        const paymentSettled =
            next.raw_status === 'paid' ||
            next.raw_status === 'in_progress' ||
            next.raw_status === 'waiting' ||
            next.raw_status === 'delivering' ||
            isTerminalRawStatus(next.raw_status);

        if (paymentSettled) {
            this.endPaymentProcessing();
        }

        this.rerender(buildProps(next, { processing: this.isProcessingPayment }));
    }
}

/**
 * Проверяет, является ли исходный статус заказа терминальным (после которого
 * нет смысла продолжать live-обновления).
 *
 * @param raw Исходный статус заказа из API.
 * @returns true, если заказ завершён, отменён или упал в ошибку.
 */
function isTerminalRawStatus(raw: string): boolean {
    return raw === 'finished' || raw === 'cancelled' || raw === 'failed';
}
