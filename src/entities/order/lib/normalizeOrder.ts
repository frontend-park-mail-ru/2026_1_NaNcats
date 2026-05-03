import { toMicros } from '@entities/cart';
import type { NormalizedOrder, Order, OrderUiStatus } from '../model/types';

const STATUS_MAP: Record<string, OrderUiStatus> = {
    created: 'created',
    cart_locked: 'awaiting_payment',
    payment_ready: 'awaiting_payment',
    paid: 'created',
    in_progress: 'cooking',
    waiting: 'cooking',
    delivering: 'delivering',
    finished: 'delivered',
    cancelled: 'cancelled',
    failed: 'cancelled',
};

const STATUS_FALLBACK_CYCLE: OrderUiStatus[] = ['created', 'cooking', 'delivering', 'delivered'];

function hashId(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
        h = (h * 31 + id.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function mapStatus(raw: string | undefined, seed: string): OrderUiStatus {
    if (raw && raw in STATUS_MAP) return STATUS_MAP[raw];
    return STATUS_FALLBACK_CYCLE[hashId(seed) % STATUS_FALLBACK_CYCLE.length];
}

export function normalizeOrder(raw: Order): NormalizedOrder {
    const seed = String(raw.order_id ?? raw.created_at ?? raw.restaurant_name ?? raw.total_cost ?? Math.random());
    const status = mapStatus(raw.status, seed);
    const items = raw.items ?? [];
    const itemsTotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const service_fee = raw.service_fee ?? toMicros(99);
    const delivery_cost = raw.delivery_cost ?? toMicros(360);
    const total_cost = raw.total_cost ?? itemsTotal + service_fee + delivery_cost;

    return {
        order_id: raw.order_id ?? seed,
        status,
        raw_status: raw.status ?? '',
        created_at: raw.created_at ?? '',
        eta_minutes: raw.eta_minutes ?? 25,
        restaurant: {
            id: raw.restaurant_id ?? 0,
            name: raw.restaurant_name ?? 'Заказ',
            image_url: raw.restaurant_image_url,
            rating: raw.restaurant_rating ?? 4.5,
            reviews_count: raw.restaurant_reviews_count ?? 1000,
        },
        items,
        service_fee,
        delivery_cost,
        total_cost,
        payment_url: raw.payment_url,
    };
}
