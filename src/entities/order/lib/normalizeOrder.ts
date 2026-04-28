import { toMicros } from '@entities/cart';
import type { NormalizedOrder, Order, OrderItem, OrderStatus } from '../model/types';

const VALID_STATUSES: ReadonlySet<OrderStatus> = new Set([
    'created',
    'cooking',
    'delivering',
    'delivered',
    'cancelled',
]);

const STATUS_FALLBACK_CYCLE: OrderStatus[] = ['created', 'cooking', 'delivering', 'delivered'];

const MOCK_ITEM_POOL: OrderItem[] = [
    { dish_id: 1001, name: 'Чизбургер', quantity: 1, price: toMicros(110) },
    { dish_id: 1002, name: 'Чизбургер DeLuxe', quantity: 1, price: toMicros(110) },
    { dish_id: 1003, name: 'Картофель фри', quantity: 1, price: toMicros(90) },
    { dish_id: 1004, name: 'Кола 0.5л', quantity: 2, price: toMicros(75) },
    { dish_id: 1005, name: 'Pizza Epic Family', quantity: 1, price: toMicros(560) },
];

function hashId(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
        h = (h * 31 + id.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function normalizeStatus(raw: string | undefined, id: string): OrderStatus {
    if (raw && VALID_STATUSES.has(raw as OrderStatus)) return raw as OrderStatus;
    return STATUS_FALLBACK_CYCLE[hashId(id) % STATUS_FALLBACK_CYCLE.length];
}

function pickMockItems(id: string): OrderItem[] {
    const seed = hashId(id);
    const count = (seed % 3) + 1;
    const start = seed % MOCK_ITEM_POOL.length;
    const out: OrderItem[] = [];
    for (let i = 0; i < count; i++) {
        out.push({ ...MOCK_ITEM_POOL[(start + i) % MOCK_ITEM_POOL.length] });
    }
    return out;
}

export function normalizeOrder(raw: Order): NormalizedOrder {
    const seed = String(raw.id ?? raw.created_at ?? raw.restaurant_name ?? raw.total_cost ?? Math.random());
    const status = normalizeStatus(raw.status, seed);
    const items = raw.items && raw.items.length > 0 ? raw.items : pickMockItems(seed);
    const itemsTotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const service_fee = raw.service_fee ?? toMicros(99);
    const delivery_cost = raw.delivery_cost ?? toMicros(360);
    const total_cost = raw.total_cost ?? itemsTotal + service_fee + delivery_cost;

    return {
        id: raw.id ?? seed,
        status,
        created_at: raw.created_at ?? new Date().toISOString(),
        eta_minutes: raw.eta_minutes ?? 25,
        restaurant: {
            id: raw.restaurant_id ?? 0,
            name: raw.restaurant_name ?? 'Pizza Epic Family',
            image_url: raw.restaurant_image_url,
            rating: raw.restaurant_rating ?? 4.5,
            reviews_count: raw.restaurant_reviews_count ?? 1000,
        },
        items,
        service_fee,
        delivery_cost,
        total_cost,
    };
}
