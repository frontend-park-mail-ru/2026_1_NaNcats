import './orderStatusModal.scss';
import { Component } from '@shared/lib/component';
import { normalizeOrder, type NormalizedOrder, type Order, type OrderStatus } from '@entities/order';
import { orderStatusModalTemplate } from './orderStatusModal.tmpl.js';

interface ProgressStep {
    key: OrderStatus;
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
}

const STATUS_FLOW: OrderStatus[] = ['created', 'cooking', 'delivering', 'delivered'];

const STATUS_TEXT: Record<OrderStatus, (eta: number) => string> = {
    created: () => 'Ваш заказ принят',
    cooking: (eta) => `Готовим — будет через ${eta} минут :)`,
    delivering: (eta) => `Будем у Вас через ${eta} минут :)`,
    delivered: () => 'Заказ доставлен. Приятного аппетита!',
    cancelled: () => 'Заказ отменён',
};

function buildSteps(status: OrderStatus): ProgressStep[] {
    if (status === 'cancelled') {
        return STATUS_FLOW.map((key) => ({ key, reached: false, current: false }));
    }
    const currentIdx = STATUS_FLOW.indexOf(status);
    return STATUS_FLOW.map((key, idx) => ({
        key,
        reached: idx <= currentIdx,
        current: idx === currentIdx,
    }));
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
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
        };
    }
    const steps = buildSteps(order.status);
    const formatted: FormattedFields = {
        dateLabel: formatDate(order.created_at),
        totalLabel: formatRubles(order.total_cost),
        reviewsLabel: formatReviews(order.restaurant.reviews_count ?? 0),
        statusText: STATUS_TEXT[order.status](order.eta_minutes),
    };
    return { order, steps, formatted };
}

export class OrderStatusModal extends Component<OrderStatusModalProps> {
    private overlay: HTMLElement | null = null;

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

        if (this.props.order) {
            this.overlay?.classList.add('modal-overlay_active');
        }
    }

    open(rawOrder: Order): void {
        const order = normalizeOrder(rawOrder);
        this.update(buildProps(order));
        this.overlay?.classList.add('modal-overlay_active');
    }

    close(): void {
        this.overlay?.classList.remove('modal-overlay_active');
    }
}
