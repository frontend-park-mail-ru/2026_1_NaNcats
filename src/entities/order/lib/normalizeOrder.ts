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

/**
 * Считает простой 32-битный хэш строки. Используется как детерминированный
 * сид для выбора UI-статуса, когда сырой статус заказа неизвестен, чтобы
 * один и тот же заказ всегда отображался с одной и той же стадией.
 *
 * @param id Произвольная строка.
 * @returns Неотрицательное целое.
 */
function hashId(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
        h = (h * 31 + id.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

/**
 * Маппит сырой статус заказа в UI-статус.
 *
 * Если сырой статус неизвестен или не задан, выбирает стадию из цикла
 * `created -> cooking -> delivering -> delivered` детерминированно по
 * хэшу `seed`, чтобы заказ-заглушка стабильно отображался в одной стадии
 * между ререндерами.
 *
 * @param raw Сырой статус заказа от бэкенда.
 * @param seed Строка-сид для детерминированного выбора фолбэка.
 * @returns UI-статус заказа.
 */
function mapStatus(raw: string | undefined, seed: string): OrderUiStatus {
    if (raw && raw in STATUS_MAP) return STATUS_MAP[raw];
    return STATUS_FALLBACK_CYCLE[hashId(seed) % STATUS_FALLBACK_CYCLE.length];
}

/**
 * Приводит сырой заказ из API к нормализованной форме для UI.
 *
 * Заполняет недостающие поля значениями по умолчанию (название ресторана,
 * рейтинг, ETA, сборы), чтобы вызывающий код мог не проверять их на
 * `undefined`. Итоговая стоимость, если не задана, считается как сумма
 * позиций плюс сервисный сбор и доставка.
 *
 * @param raw Сырой заказ из API.
 * @returns Нормализованный заказ.
 */
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
        admin_public_id: raw.admin_public_id,
        status,
        raw_status: raw.status ?? '',
        created_at: raw.created_at ?? '',
        eta_minutes: raw.eta_minutes ?? 25,
        restaurant: {
            id: raw.restaurant_id ?? 0,
            name: raw.restaurant_name ?? 'Заказ',
            image_url: raw.restaurant_image_url,
            // Бэкенд в заказе рейтинг/отзывы не присылает. Раньше тут стояла
            // заглушка 4.5 (1000); теперь оставляем 0 и подтягиваем реальные
            // значения из API отзывов при открытии модалки заказа.
            rating: raw.restaurant_rating ?? 0,
            reviews_count: raw.restaurant_reviews_count ?? 0,
        },
        items,
        splits: raw.splits ?? [],
        service_fee,
        delivery_cost,
        total_cost,
        payment_url: raw.payment_url,
        applied_promocode: raw.applied_promocode ?? undefined,
        discount_amount: raw.discount_amount ?? 0,
    };
}
