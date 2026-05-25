// Модалка «Все заказы»: поиск по ресторану, фильтр по бренду, сортировка,
// сводка по найденным. Список разделён горизонтальными линиями по макету.
//
// Клик по строке закрывает модалку и открывает OrderStatusModal через
// колбэк onOpenOrder, чтобы не дублировать здесь логику трекера статуса.

import './ordersHistoryModal.scss';

import type { Order } from '@entities/order';
import { computed, signal } from '@shared/lib/signals';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { imageFallback } from '@shared/lib/img';

/** Запасная картинка ресторана, если в заказе нет логотипа. */
const ORDER_FALLBACK_IMAGE = 'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp';

/** Месяцы для форматирования даты в формате «10 мая 2026». */
const MONTHS = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
];

export interface OrdersHistoryModalProps {
    /** Список заказов; для модалки достаточно сырых полей бэкенда. */
    orders: Order[];
    /** Колбэк закрытия модалки (крестик / клик по затемнению). */
    onClose: () => void;
    /** Открыть подробности конкретного заказа. */
    onOpenOrder: (order: Order) => void;
}

/** ISO-дату или DD.MM.YYYY приводит к «10 мая 2026»; на невалидном значении возвращает исходную строку. */
function formatHumanDate(value: string | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

/**
 * Бэкенд отдаёт `created_at` в формате `DD.MM.YYYY` (а свежесозданный заказ
 * фронт ставит в `toLocaleDateString('ru-RU')` — тот же формат), который
 * `Date.parse` не понимает. Возвращаем UTC-таймстамп, чтобы сортировка по
 * датам работала в обе стороны.
 */
function parseOrderDate(value: string | undefined): number {
    if (!value) return 0;
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    if (m) {
        const day = Number(m[1]);
        const month = Number(m[2]);
        const year = Number(m[3]);
        return Date.UTC(year, month - 1, day);
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

/** Перечисляет позиции заказа в читаемую строку («Пицца, Бургер ×2, Кола»). */
function formatItems(order: Order): string {
    const items = order.items ?? [];
    if (items.length === 0) return '';
    return items.map((item) => (item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name)).join(', ');
}

/** Цена из микрорублей в строку «1 248₽». */
function formatRubles(microRubles: number): string {
    const rubles = Math.round(microRubles / 1_000_000);
    return `${rubles.toLocaleString('ru-RU')}₽`;
}

export function OrdersHistoryModal(props: OrdersHistoryModalProps): VNode {
    const search = signal<string>('');
    const restaurantFilter = signal<string>('all');
    const sortKey = signal<'newest' | 'oldest'>('newest');

    const restaurantOptions = computed<string[]>(() => {
        const names = new Set<string>();
        for (const order of props.orders) {
            const name = order.restaurant_name ?? '';
            if (name) names.add(name);
        }
        return Array.from(names).sort();
    });

    const filteredOrders = computed<Order[]>(() => {
        const needle = search().trim().toLowerCase();
        const filterValue = restaurantFilter();

        const filtered = props.orders.filter((order) => {
            const name = (order.restaurant_name ?? '').toLowerCase();
            if (filterValue !== 'all' && order.restaurant_name !== filterValue) return false;
            if (needle && !name.includes(needle) && !formatItems(order).toLowerCase().includes(needle)) {
                return false;
            }
            return true;
        });

        const sorted = filtered.slice();
        sorted.sort((a, b) => {
            const ta = parseOrderDate(a.created_at);
            const tb = parseOrderDate(b.created_at);
            return sortKey() === 'newest' ? tb - ta : ta - tb;
        });
        return sorted;
    });

    const total = computed<number>(() => filteredOrders().reduce((sum, order) => sum + (order.total_cost ?? 0), 0));

    const handleSearchInput = (event: Event) => {
        search.set((event.target as HTMLInputElement).value);
    };

    const handleRestaurantChange = (event: Event) => {
        restaurantFilter.set((event.target as HTMLSelectElement).value);
    };

    const handleSortChange = (event: Event) => {
        const value = (event.target as HTMLSelectElement).value;
        sortKey.set(value === 'oldest' ? 'oldest' : 'newest');
    };

    return (
        <div class="orders-history-modal">
            <div class="orders-history-modal__header">
                <div class="orders-history-modal__title">Все заказы</div>
                <button type="button" class="orders-history-modal__close" aria-label="Закрыть" onClick={props.onClose}>
                    ✕
                </button>
            </div>

            <div class="orders-history-modal__filters">
                <div class="orders-history-modal__search">
                    <span class="orders-history-modal__search-icon" aria-hidden="true">
                        🔍
                    </span>
                    <input
                        type="text"
                        class="orders-history-modal__search-input"
                        placeholder="Поиск"
                        value={search()}
                        onInput={handleSearchInput}
                    />
                </div>
                <div class="orders-history-modal__select-row">
                    <select
                        class="orders-history-modal__select"
                        value={restaurantFilter()}
                        onChange={handleRestaurantChange}
                    >
                        <option value="all">Все рестораны</option>
                        <For each={restaurantOptions} key={(n) => n}>
                            {(name) => <option value={name}>{name}</option>}
                        </For>
                    </select>
                    <select class="orders-history-modal__select" value={sortKey()} onChange={handleSortChange}>
                        <option value="newest">Сначала новые</option>
                        <option value="oldest">Сначала старые</option>
                    </select>
                </div>
            </div>

            <div class="orders-history-modal__list">
                <Show
                    when={() => filteredOrders().length > 0}
                    fallback={<div class="orders-history-modal__empty">Ничего не нашлось</div>}
                >
                    <For each={filteredOrders} key={(o) => o.order_id}>
                        {(order) => (
                            <div
                                class="orders-history-modal__row"
                                role="button"
                                tabindex="0"
                                onClick={() => props.onOpenOrder(order)}
                                onKeyDown={(event: Event) => {
                                    const ke = event as KeyboardEvent;
                                    if (ke.key === 'Enter' || ke.key === ' ') {
                                        ke.preventDefault();
                                        props.onOpenOrder(order);
                                    }
                                }}
                            >
                                <img
                                    class="orders-history-modal__row-img"
                                    src={order.restaurant_image_url ?? ORDER_FALLBACK_IMAGE}
                                    alt={order.restaurant_name ?? 'Заказ'}
                                    onError={imageFallback(ORDER_FALLBACK_IMAGE)}
                                />
                                <div class="orders-history-modal__row-body">
                                    <div class="orders-history-modal__row-date">
                                        {formatHumanDate(order.created_at)}
                                    </div>
                                    <div class="orders-history-modal__row-name">
                                        {order.restaurant_name ?? 'Ресторан'}
                                    </div>
                                    <Show when={() => formatItems(order).length > 0}>
                                        <div class="orders-history-modal__row-items">{formatItems(order)}</div>
                                    </Show>
                                </div>
                                <div class="orders-history-modal__row-price">{formatRubles(order.total_cost ?? 0)}</div>
                            </div>
                        )}
                    </For>
                </Show>
            </div>

            <div class="orders-history-modal__footer">
                <span class="orders-history-modal__footer-muted">Найдено: </span>
                <span class="orders-history-modal__footer-strong">{() => String(filteredOrders().length)}</span>
                <span class="orders-history-modal__footer-muted"> · итого </span>
                <span class="orders-history-modal__footer-strong">{() => formatRubles(total())}</span>
            </div>
        </div>
    );
}
