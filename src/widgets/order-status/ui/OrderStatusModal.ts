import './orderStatusModal.scss';
import { Component } from '@shared/lib/component';
import {
    connectOrderTracker,
    normalizeOrder,
    type GatewayWsEvent,
    type NormalizedOrder,
    type Order,
    type OrderTracker,
    type OrderUiStatus,
} from '@entities/order';
import { orderStatusModalTemplate } from './orderStatusModal.tmpl.js';

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
    errorText: string;
}

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
    // backend sends "DD.MM.YYYY" already formatted
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

function buildProps(order: NormalizedOrder | null): OrderStatusModalProps {
    if (!order) {
        return {
            order: null,
            steps: [],
            formatted: { dateLabel: '', totalLabel: '', reviewsLabel: '', statusText: '' },
            showPaymentButton: false,
            errorText: '',
        };
    }
    return {
        order,
        steps: buildSteps(order.status),
        formatted: {
            dateLabel: formatDate(order.created_at),
            totalLabel: formatRubles(order.total_cost),
            reviewsLabel: formatReviews(order.restaurant.reviews_count ?? 0),
            statusText: STATUS_TEXT[order.status](order.eta_minutes),
        },
        showPaymentButton: order.status === 'awaiting_payment' && Boolean(order.payment_url),
        errorText: order.error ?? '',
    };
}

export class OrderStatusModal extends Component<OrderStatusModalProps> {
    private overlay: HTMLElement | null = null;
    private tracker: OrderTracker | null = null;

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
                const url = this.props.order?.payment_url;
                if (url) window.location.href = url;
            });
        }

        if (this.props.order) {
            this.overlay?.classList.add('modal-overlay_active');
        }
    }

    protected onDestroy(): void {
        this.disconnectTracker();
    }

    open(rawOrder: Order, options: { subscribe?: boolean } = {}): void {
        const order = normalizeOrder(rawOrder);
        this.disconnectTracker();
        this.update(buildProps(order));
        this.overlay?.classList.add('modal-overlay_active');

        if (options.subscribe && !isTerminalRawStatus(order.raw_status)) {
            this.subscribeToOrder(order.order_id);
        }
    }

    close(): void {
        this.disconnectTracker();
        this.overlay?.classList.remove('modal-overlay_active');
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
        this.update(buildProps(next));
    }
}

function isTerminalRawStatus(raw: string): boolean {
    return raw === 'finished' || raw === 'cancelled' || raw === 'failed';
}
