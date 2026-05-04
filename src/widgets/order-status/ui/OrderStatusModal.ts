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

const PAYMENT_POLL_INTERVAL_MS = 4000;
const TERMINAL_PAYMENT_STATUSES = new Set(['succeeded', 'canceled']);

interface ProgressStep {
    key: OrderUiStatus;
    reached: boolean;
    current: boolean;
}

interface FormattedFields {
    dateLabel: string;
    totalLabel: string;
    reviewsLabel: string;
    statusText: string;
}

interface OrderStatusModalProps {
    order: NormalizedOrder | null;
    steps: ProgressStep[];
    formatted: FormattedFields;
    showPaymentButton: boolean;
    showCancelButton: boolean;
    showProcessing: boolean; // спиннер пока ждём ответа YooKassa
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

function formatRubles(micros: number): string {
    return (micros / 1_000_000).toFixed(0);
}

function formatReviews(count: number): string {
    if (count >= 1000) return `${Math.floor(count / 1000)}000+`;
    return String(count);
}

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

export class OrderStatusModal extends Component<OrderStatusModalProps> {
    private overlay: HTMLElement | null = null;
    private tracker: OrderTracker | null = null;
    private keepTrackerAcrossRerender = false;
    private onCloseCallback: (() => void) | null = null;
    private paymentPollTimer: ReturnType<typeof setInterval> | null = null;
    private paymentTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    private isProcessingPayment = false;

    constructor() {
        super(orderStatusModalTemplate);
    }

    static initialProps(): OrderStatusModalProps {
        return buildProps(null);
    }

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

    private endPaymentProcessing(): void {
        this.isProcessingPayment = false;
        if (this.paymentTimeoutTimer !== null) {
            clearTimeout(this.paymentTimeoutTimer);
            this.paymentTimeoutTimer = null;
        }
    }

    private rerender(props: OrderStatusModalProps): void {
        this.keepTrackerAcrossRerender = true;
        try {
            this.update(props);
        } finally {
            this.keepTrackerAcrossRerender = false;
        }
    }

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

    protected onDestroy(): void {
        if (this.keepTrackerAcrossRerender) return;
        this.disconnectTracker();
        this.stopPaymentPoll();
    }

    open(rawOrder: Order, options: { subscribe?: boolean; onClose?: () => void } = {}): void {
        const order = normalizeOrder(rawOrder);
        this.disconnectTracker();
        this.stopPaymentPoll();
        this.endPaymentProcessing();
        this.onCloseCallback = options.onClose ?? null;
        this.update(buildProps(order));
        this.overlay?.classList.add('modal-overlay_active');

        if (options.subscribe && !isTerminalRawStatus(order.raw_status)) {
            this.subscribeToOrder(order.order_id);
            this.startPaymentPoll(order.order_id);
        }
    }

    close(): void {
        this.disconnectTracker();
        this.stopPaymentPoll();
        this.endPaymentProcessing();
        this.overlay?.classList.remove('modal-overlay_active');
        const cb = this.onCloseCallback;
        this.onCloseCallback = null;
        if (cb) cb();
    }

    private subscribeToOrder(orderId: string): void {
        this.tracker = connectOrderTracker(orderId, {
            onEvent: (event) => this.applyEvent(event),
        });
    }

    private disconnectTracker(): void {
        if (this.tracker) {
            this.tracker.close();
            this.tracker = null;
        }
    }

    private startPaymentPoll(orderId: string): void {
        this.stopPaymentPoll();
        this.paymentPollTimer = setInterval(async () => {
            try {
                const resp = await orderApi.checkPayment(orderId);
                if (TERMINAL_PAYMENT_STATUSES.has(resp.payment_status)) {
                    this.stopPaymentPoll();
                }
            } catch {
                // ignore
            }
        }, PAYMENT_POLL_INTERVAL_MS);
    }

    private stopPaymentPoll(): void {
        if (this.paymentPollTimer !== null) {
            clearInterval(this.paymentPollTimer);
            this.paymentPollTimer = null;
        }
    }

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

        if (isTerminalRawStatus(next.raw_status) || next.raw_status === 'paid') {
            this.stopPaymentPoll();
        }
    }
}

function isTerminalRawStatus(raw: string): boolean {
    return raw === 'finished' || raw === 'cancelled' || raw === 'failed';
}
