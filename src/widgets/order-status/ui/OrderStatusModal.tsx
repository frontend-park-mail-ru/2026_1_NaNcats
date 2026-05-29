// Модалка статуса заказа: прогресс-бар, состав, ресторан, итог, WS-трекер обновлений.
// Виджет всегда смонтирован, открывается императивно через controller.open(order).

import './orderStatusModal.scss';

import {
    connectOrderTracker,
    normalizeOrder,
    orderApi,
    type GatewayWsEvent,
    type NormalizedOrder,
    type Order,
    type OrderSplit,
    type OrderTracker,
    type OrderUiStatus,
} from '@entities/order';
import { userStore } from '@entities/user';
import { restaurantApi } from '@entities/restaurant';
import { computed, onCleanup, signal, useStoreSignal } from '@shared/lib/signals';
import { translateError } from '@shared/lib/errors';
import { For, onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

export interface OrderStatusModalOpenOptions {
    /** Подписаться на стрим обновлений заказа через WebSocket-трекер. */
    subscribe?: boolean;
    /** Колбэк закрытия модалки (клик по затемнению, крестику, после отмены заказа). */
    onClose?: () => void;
}

/** Императивный API модалки, отдаваемый через {@link OrderStatusModalProps.controllerRef}. */
export interface OrderStatusModalController {
    /** Открывает модалку для заданного заказа. */
    open(rawOrder: Order, options?: OrderStatusModalOpenOptions): void;
    /** Закрывает модалку, отменяет подписку и таймер ожидания оплаты. */
    close(): void;
}

export interface OrderStatusModalProps {
    /** Колбэк, в который виджет передаёт controller после mount и null при unmount. */
    controllerRef?: (ctl: OrderStatusModalController | null) => void;
    /** Начальный заказ для немедленного открытия. */
    initialOrder?: Order;
    /** Опции для начального открытия (если задан `initialOrder`). */
    initialOptions?: OrderStatusModalOpenOptions;
}

/**
 * Шаг прогресс-бара. Признаки достижения/текущего шага вычисляются через
 * computed по индексу, потому что For не перевызывает children при смене статуса.
 */
interface ProgressStep {
    key: OrderUiStatus;
}

/** Таймаут ожидания подтверждения оплаты после клика по кнопке оплаты. */
const PAYMENT_TIMEOUT_MS = 60_000;

/** Множество UI-статусов, при которых пользователь может отменить заказ. */
const CANCELLABLE_STATUSES = new Set<OrderUiStatus>(['awaiting_payment', 'created']);

/** Порядок шагов прогресс-бара. */
const STATUS_FLOW: OrderUiStatus[] = ['created', 'cooking', 'delivering', 'delivered'];

/** Текст статуса по UI-статусу заказа; функция получает ETA в минутах. */
const STATUS_TEXT: Record<OrderUiStatus, (eta: number) => string> = {
    awaiting_payment: () => 'Ожидаем оплату',
    created: () => 'Ваш заказ принят',
    cooking: (eta) => `Готовим: будет через ${eta} минут :)`,
    delivering: (eta) => `Будем у Вас через ${eta} минут :)`,
    delivered: () => 'Заказ доставлен. Приятного аппетита!',
    cancelled: () => 'Заказ отменён',
};

/**
 * Текст по сырому статусу: чтобы видимый заголовок модалки менялся на каждом
 * шаге (например, между `paid` и `created`, которые в UI-флоу совпадают), а
 * не только на смене UI-стадии. STATUS_TEXT остаётся фолбэком для неизвестных
 * сырых статусов.
 */
const STATUS_TEXT_BY_RAW: Record<string, (eta: number) => string> = {
    created: () => 'Ваш заказ принят',
    cart_locked: () => 'Ожидаем оплату',
    payment_ready: () => 'Ожидаем оплату',
    paid: () => 'Оплачен, ждём подтверждения ресторана',
    in_progress: (eta) => `Готовим: будет через ${eta} минут :)`,
    waiting: (eta) => `Готовим: будет через ${eta} минут :)`,
    delivering: (eta) => `Будем у Вас через ${eta} минут :)`,
    finished: () => 'Заказ доставлен. Приятного аппетита!',
    cancelled: () => 'Заказ отменён',
    failed: () => 'Ошибка обработки заказа',
};

/** Сырые статусы, после которых нет смысла продолжать live-обновления. */
const TERMINAL_RAW_STATUSES = new Set<string>(['finished', 'cancelled', 'failed']);

/** Сырые статусы, при которых считаем, что попытка оплаты завершилась. */
const PAYMENT_SETTLED_RAW_STATUSES = new Set<string>([
    'paid',
    'in_progress',
    'waiting',
    'delivering',
    'finished',
    'cancelled',
    'failed',
]);

/** Сырые статусы, при которых заказ уже полностью оплачен (все доли счёта). */
const ORDER_PAID_RAW_STATUSES = new Set<string>(['paid', 'in_progress', 'waiting', 'delivering', 'finished']);

/** Все статусы заказа, которые отдаёт бэкенд. */
const KNOWN_RAW_STATUSES = new Set<string>([
    'created',
    'cart_locked',
    'payment_ready',
    'paid',
    'in_progress',
    'waiting',
    'delivering',
    'finished',
    'cancelled',
    'failed',
]);

/** URL дефолтной иконки блюда/ресторана, используется при ошибке загрузки. */
const DEFAULT_IMAGE_URL = 'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp';

function isTerminalRawStatus(raw: string) {
    return TERMINAL_RAW_STATUSES.has(raw);
}

/** Индекс активного шага в STATUS_FLOW; -1 для отменённых и ожидающих оплату. */
function activeStepIndex(status: OrderUiStatus) {
    if (status === 'cancelled' || status === 'awaiting_payment') return -1;
    return STATUS_FLOW.indexOf(status);
}

const PROGRESS_STEPS: ProgressStep[] = STATUS_FLOW.map((key) => ({ key }));

/** Дата к виду DD.MM (поддерживает ISO и DD.MM.YYYY); для невалидной возвращает исходную строку. */
function formatDate(value: string) {
    if (value === '') return '';
    const ddmmyyyy = /^(\d{2})\.(\d{2})\.\d{4}$/.exec(value);
    if (ddmmyyyy !== null) return `${ddmmyyyy[1]}.${ddmmyyyy[2]}`;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
}

/** Микрорубли в рубли без дробной части. */
function formatRubles(micros: number) {
    return (micros / 1_000_000).toFixed(0);
}

/** Количество отзывов: тысячи округляются вниз с суффиксом 000+. */
function formatReviews(count: number) {
    if (count >= 1000) return `${Math.floor(count / 1000)}000+`;
    return String(count);
}

// Применяет событие WS-трекера к заказу: новый статус/URL оплаты, пересборка
// нормализованного объекта (чтобы UI-статус согласовался с raw), текст ошибки.
function mergeEvent(current: NormalizedOrder, event: GatewayWsEvent) {
    const merged: Order = {
        order_id: current.order_id,
        admin_public_id: current.admin_public_id,
        status: event.status,
        total_cost: current.total_cost,
        created_at: current.created_at,
        restaurant_id: current.restaurant.id,
        restaurant_name: current.restaurant.name,
        restaurant_image_url: current.restaurant.image_url,
        restaurant_rating: current.restaurant.rating,
        restaurant_reviews_count: current.restaurant.reviews_count,
        items: current.items,
        // WS-событие не содержит доли счёта, переносим их сами.
        splits: current.splits,
        service_fee: current.service_fee,
        delivery_cost: current.delivery_cost,
        eta_minutes: current.eta_minutes,
        payment_url: event.payment_url ?? current.payment_url,
        // Промокод и скидку WS не присылает — переносим из текущего заказа,
        // иначе блок «Промокод ...» мигнёт при каждом обновлении статуса.
        applied_promocode: current.applied_promocode,
        discount_amount: current.discount_amount,
    };
    const next = normalizeOrder(merged);
    next.error = event.error;
    // Раз заказ ушёл дальше оплаты, все доли счёта уже оплачены.
    if (ORDER_PAID_RAW_STATUSES.has(next.raw_status)) {
        next.splits = next.splits.map((s) => (s.status === 'paid' ? s : { ...s, status: 'paid' }));
    }
    return next;
}

/** Модалка статуса заказа. До первого open сигнал `order` равен null и оверлей невидим. */
export function OrderStatusModal(props: OrderStatusModalProps): VNode {
    /** Текущий нормализованный заказ; null означает, что модалка не открыта. */
    const order = signal<NormalizedOrder | null>(null);
    /** Активна ли модалка визуально (класс `_active`). */
    const isActive = signal<boolean>(false);
    /** Ожидание подтверждения оплаты после клика по "Оплатить". */
    const processing = signal<boolean>(false);
    /** id доли счёта, по которой запрошена оплата и ожидается ссылка; '' - нет. */
    const splitWaiting = signal<string>('');

    /** Текущий пользователь: нужен, чтобы отличать свою долю счёта от чужой. */
    const currentUser = useStoreSignal(userStore, (s) => s.user);
    const myId = () => currentUser()?.public_id ?? null;

    const errorText = computed(() => order()?.error ?? '');

    /**
     * Доли счёта показываем, если их больше одной либо если текущий пользователь
     * — sponsored участник (его долю забрал организатор, но «За вас оплатит
     * организатор» должно быть видно).
     */
    const splits = computed<readonly OrderSplit[]>(() => {
        const list = order()?.splits ?? [];
        if (list.length > 1) return list;
        const id = myId();
        if (id === null || list.length === 0) return [];
        const hasOwnItem = (order()?.items ?? []).some((it) => it.owner_public_id === id);
        const hasOwnSplit = list.some((s) => s.user_public_id === id);
        return hasOwnItem && !hasOwnSplit ? list : [];
    });

    /** Доля счёта текущего пользователя в разделённом заказе либо null. */
    const mySplit = computed<OrderSplit | null>(() => {
        const id = myId();
        if (id === null) return null;
        return splits().find((s) => s.user_public_id === id) ?? null;
    });

    /**
     * Пользователь оказался в shared-заказе как владелец позиций, но его долю
     * взял на себя организатор (payer_mapping): у него нет собственного split.
     */
    const isSponsored = computed<boolean>(() => {
        const id = myId();
        if (id === null) return false;
        if (splits().length === 0) return false;
        if (mySplit() !== null) return false;
        const items = order()?.items ?? [];
        return items.some((it) => it.owner_public_id === id);
    });

    /**
     * Подпись над списком долей: статус оплаты текущего пользователя и сколько
     * участников уже заплатили.
     */
    const splitSummary = computed<{ kind: 'warn' | 'done' | 'info'; text: string } | null>(() => {
        const list = splits();
        if (list.length === 0) return null;
        const paidCount = list.filter((s) => s.status === 'paid').length;
        if (isSponsored()) {
            if (paidCount === list.length) {
                return { kind: 'done', text: 'Счёт оплачен полностью.' };
            }
            return {
                kind: 'info',
                text: `За вас оплатит организатор. Оплачено ${paidCount} из ${list.length} участников.`,
            };
        }
        const mine = mySplit();
        if (mine !== null && mine.status === 'pending') {
            return {
                kind: 'warn',
                text: `Вы ещё не оплатили свою часть: ${formatRubles(mine.amount)}₽. Оплачено ${paidCount} из ${list.length} участников.`,
            };
        }
        if (paidCount === list.length) {
            return { kind: 'done', text: 'Счёт оплачен полностью.' };
        }
        if (mine !== null && mine.status === 'paid') {
            return {
                kind: 'done',
                text: `Вы оплатили свою часть. Оплачено ${paidCount} из ${list.length} участников, ждём остальных.`,
            };
        }
        return { kind: 'info', text: `Оплачено ${paidCount} из ${list.length} участников.` };
    });

    /** Индекс активного шага прогресс-бара; шаги читают его реактивно. */
    const currentStepIdx = computed(() => {
        const o = order();
        return o === null ? -1 : activeStepIndex(o.status);
    });

    const steps = computed<readonly ProgressStep[]>(() => (order() === null ? [] : PROGRESS_STEPS));

    const statusText = computed(() => {
        const o = order();
        if (o === null) return '';
        const byRaw = STATUS_TEXT_BY_RAW[o.raw_status];
        return byRaw ? byRaw(o.eta_minutes) : STATUS_TEXT[o.status](o.eta_minutes);
    });

    /** Текущий пользователь — организатор shared-заказа. */
    const isOrganizer = computed<boolean>(() => {
        const id = myId();
        const adminId = order()?.admin_public_id;
        if (id === null || adminId === undefined || adminId === '') return false;
        return id === adminId;
    });

    /** Сумма к оплате текущим пользователем: своя доля либо общий total. */
    const myPayAmount = computed<number>(() => {
        const mine = mySplit();
        if (mine !== null) return mine.amount;
        return order()?.total_cost ?? 0;
    });

    const showPaymentButton = computed(() => {
        if (processing()) return false;
        const o = order();
        if (o === null) return false;
        if (PAYMENT_SETTLED_RAW_STATUSES.has(o.raw_status)) return false;
        if (o.status !== 'awaiting_payment' && o.status !== 'created') return false;
        // Sponsored участник не платит — его доля уже у организатора.
        if (isSponsored()) return false;
        const mine = mySplit();
        // Если есть splits, но моей нет и я не sponsored — это «чужой» split-заказ.
        if (splits().length > 0 && mine === null) return false;
        // Если своя доля уже оплачена — кнопка не нужна.
        if (mine !== null && mine.status === 'paid') return false;
        return true;
    });

    const showCancelButton = computed(() => {
        if (processing()) return false;
        const o = order();
        if (o === null) return false;
        if (PAYMENT_SETTLED_RAW_STATUSES.has(o.raw_status)) return false;
        if (!CANCELLABLE_STATUSES.has(o.status)) return false;
        // Для shared-заказа отменить может только организатор; для solo
        // admin_public_id совпадает с моим, так что условие тоже верно.
        if (o.admin_public_id !== undefined && o.admin_public_id !== '') {
            return isOrganizer();
        }
        return true;
    });

    let tracker: OrderTracker | null = null;
    /** Таймер ожидания подтверждения оплаты; снимается при разрешении или закрытии. */
    let paymentTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    /** Колбэк закрытия, переданный в open(). */
    let onCloseCallback: (() => void) | null = null;

    const endPaymentProcessing = () => {
        processing.set(false);
        if (paymentTimeoutTimer !== null) {
            clearTimeout(paymentTimeoutTimer);
            paymentTimeoutTimer = null;
        }
    };

    const beginPaymentProcessing = () => {
        if (processing()) return;
        processing.set(true);

        if (paymentTimeoutTimer !== null) clearTimeout(paymentTimeoutTimer);
        paymentTimeoutTimer = setTimeout(() => {
            paymentTimeoutTimer = null;
            if (!processing()) return;
            processing.set(false);
            const current = order();
            if (current === null) return;
            order.set({
                ...current,
                error: 'Не удалось подтвердить оплату. Проверьте интернет/VPN и попробуйте ещё раз.',
            });
        }, PAYMENT_TIMEOUT_MS);
    };

    const disconnectTracker = () => {
        if (tracker !== null) {
            tracker.close();
            tracker = null;
        }
    };

    const applyEvent = (event: GatewayWsEvent) => {
        const current = order();
        if (current === null) return;

        // Сигнал об оплате одной доли: помечаем оплаченной её, общий статус
        // заказа не трогаем.
        if (event.status === 'split_paid') {
            if (event.split_id === undefined || event.split_id === '') return;
            const updatedSplits = current.splits.map((s) =>
                s.split_id === event.split_id ? { ...s, status: 'paid' } : s,
            );
            if (event.split_id === splitWaiting()) splitWaiting.set('');
            order.set({ ...current, splits: updatedSplits });
            return;
        }

        // События без понятного статуса заказа пропускаем (кроме тех, что
        // несут текст ошибки).
        if (!KNOWN_RAW_STATUSES.has(event.status) && (event.error === undefined || event.error === '')) {
            return;
        }

        // В совместном заказе по одному WS-каналу прилетают события оплаты
        // всех участников. Чужую ссылку на оплату отбрасываем: на экране
        // должна оставаться только своя доля счёта. Долю события сопоставляем
        // по split_id со списком долей заказа, где у каждой есть user_public_id.
        const eventSplit =
            event.split_id !== undefined && event.split_id !== ''
                ? current.splits.find((s) => s.split_id === event.split_id)
                : undefined;
        const foreignPayment =
            event.payment_url !== undefined &&
            eventSplit !== undefined &&
            myId() !== null &&
            eventSplit.user_public_id !== myId();
        const scoped: GatewayWsEvent = foreignPayment ? { ...event, payment_url: undefined } : event;

        if (scoped.payment_url !== undefined) {
            splitWaiting.set('');
        }

        const next = mergeEvent(current, scoped);
        if (PAYMENT_SETTLED_RAW_STATUSES.has(next.raw_status)) {
            endPaymentProcessing();
        }
        // payment_ready без ссылки на оплату означает, что платёж не создался
        // (например, карту отклонил банк). Снимаем "обрабатываем" сразу, чтобы
        // не держать пользователя на спиннере до 60-секундного таймаута.
        if (next.raw_status === 'payment_ready' && next.payment_url === undefined) {
            endPaymentProcessing();
        }
        order.set(next);

        if (processing() && next.payment_url !== undefined) {
            window.location.replace(next.payment_url);
        }
    };

    // Запускает оплату своей доли счёта: бэкенд создаёт по ней платёж, а
    // ссылку на оплату пришлёт WS-событием, после чего покажется кнопка
    // "Оплатить".
    const handlePaySplit = async (split: OrderSplit) => {
        if (splitWaiting() !== '') return;
        splitWaiting.set(split.split_id);
        try {
            await orderApi.payForSplit(split.split_id, '');
        } catch (e) {
            splitWaiting.set('');
            const current = order();
            if (current !== null) {
                order.set({ ...current, error: translateError(e, 'Не удалось начать оплату доли') });
            }
        }
    };

    const subscribeToOrder = (orderId: string) => {
        tracker = connectOrderTracker(orderId, {
            onEvent: (event) => applyEvent(event),
        });
    };

    const open = (rawOrder: Order, options: OrderStatusModalOpenOptions = {}) => {
        const normalized = normalizeOrder(rawOrder);
        disconnectTracker();
        endPaymentProcessing();
        splitWaiting.set('');
        onCloseCallback = options.onClose ?? null;
        order.set(normalized);
        isActive.set(true);
        void loadRestaurantRating(normalized.order_id, normalized.restaurant.id);

        if (options.subscribe === true && !isTerminalRawStatus(normalized.raw_status)) {
            subscribeToOrder(normalized.order_id);
        }
    };

    // Подтягивает реальный рейтинг и количество отзывов ресторана из API
    // (в самом заказе их нет). Патчим уже открытый заказ, сверяя order_id,
    // чтобы быстрый переход между заказами не подставил чужие цифры.
    const loadRestaurantRating = async (orderId: string, restaurantId: number) => {
        if (!restaurantId) return;
        try {
            const reviews = await restaurantApi.getReviews(restaurantId);
            const cur = order.peek();
            if (cur === null || cur.order_id !== orderId) return;
            const count = reviews.length;
            const rating =
                count > 0 ? Math.round((reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / count) * 10) / 10 : 0;
            order.set({ ...cur, restaurant: { ...cur.restaurant, rating, reviews_count: count } });
        } catch {
            // Отзывы не загрузились — показываем «Нет отзывов».
        }
    };

    const close = () => {
        disconnectTracker();
        endPaymentProcessing();
        splitWaiting.set('');
        isActive.set(false);
        const cb = onCloseCallback;
        onCloseCallback = null;
        if (cb !== null) cb();
    };

    const handleCancel = async () => {
        const current = order();
        if (current === null) return;
        const orderId = current.order_id;
        if (orderId === '') return;
        if (!window.confirm('Отменить заказ? Это действие нельзя отменить.')) return;

        try {
            await orderApi.cancel(orderId);
            applyEvent({ order_id: orderId, status: 'cancelled' });
        } catch (e) {
            window.alert(translateError(e, 'Не удалось отменить заказ'));
        }
    };

    const handlePay = () => {
        const current = order();
        if (current === null) return;
        if (current.payment_url !== undefined) {
            beginPaymentProcessing();
            window.location.replace(current.payment_url);
            return;
        }
        // В split-заказе платёж по своей доле инициирует payForSplit, а ссылку
        // оплаты пришлёт WS — beginPaymentProcessing включит авто-редирект.
        const mine = mySplit();
        if (mine !== null && mine.status === 'pending') {
            beginPaymentProcessing();
            void handlePaySplit(mine);
            return;
        }
        beginPaymentProcessing();
    };

    // Закрывает модалку, только если клик пришёл по самому оверлею, а не по содержимому.
    const handleOverlayClick = (event: Event) => {
        if (event.target !== event.currentTarget) return;
        close();
    };

    const handleImageError = (event: Event) => {
        const img = event.target as HTMLImageElement;
        if (img.src !== DEFAULT_IMAGE_URL) img.src = DEFAULT_IMAGE_URL;
    };

    const controller: OrderStatusModalController = { open, close };

    // Controller отдаётся синхронно при рендере; initialOrder открывается уже
    // после mount, чтобы Show-узлы успели смонтироваться.
    props.controllerRef?.(controller);

    onMount(() => {
        if (props.initialOrder !== undefined) {
            open(props.initialOrder, props.initialOptions);
        }
    });

    onCleanup(() => {
        disconnectTracker();
        endPaymentProcessing();
        props.controllerRef?.(null);
    });

    return (
        <div
            class={() => (isActive() ? 'modal-overlay modal-overlay_active' : 'modal-overlay')}
            id="order-status-modal"
            onClick={handleOverlayClick}
        >
            <Show when={order}>
                <div class="order-status-modal">
                    <button type="button" class="order-status-modal__close" aria-label="Закрыть" onClick={close}>
                        ×
                    </button>

                    <div class="order-status-modal__header">
                        Заказ от {() => formatDate(order()?.created_at ?? '')} на сумму{' '}
                        {() => formatRubles(order()?.total_cost ?? 0)}₽
                    </div>

                    <div class="order-status-modal__restaurant">
                        <img
                            class="order-status-modal__restaurant-img"
                            src={() => order()?.restaurant.image_url ?? ''}
                            alt={() => order()?.restaurant.name ?? ''}
                            onError={handleImageError}
                        />
                        <div class="order-status-modal__restaurant-info">
                            <div class="order-status-modal__restaurant-name">
                                {() => order()?.restaurant.name ?? ''}
                            </div>
                            <div class="order-status-modal__restaurant-rating">
                                <Show
                                    when={() => (order()?.restaurant.reviews_count ?? 0) > 0}
                                    fallback={<span>Нет отзывов</span>}
                                >
                                    <span class="order-status-modal__star">★</span>
                                    <span>
                                        {() => String(order()?.restaurant.rating ?? 0)} (
                                        {() => formatReviews(order()?.restaurant.reviews_count ?? 0)})
                                    </span>
                                </Show>
                            </div>
                        </div>
                    </div>

                    <div
                        class={() =>
                            order()?.status === 'cancelled'
                                ? 'order-status-modal__progress order-status-modal__progress_cancelled'
                                : 'order-status-modal__progress'
                        }
                    >
                        <div class="order-status-modal__progress-text">{statusText}</div>
                        <div class="order-status-modal__progress-track">
                            <For each={steps} key={(s) => s.key}>
                                {(step, idx) => {
                                    // Computed по idx этого шага: пересчитываются при смене статуса заказа.
                                    const reached = computed(() => idx <= currentStepIdx() && currentStepIdx() >= 0);
                                    const current = computed(() => idx === currentStepIdx());
                                    return (
                                        <div
                                            class={() => {
                                                const base = 'order-status-modal__progress-step';
                                                const reachedCls = reached()
                                                    ? ' order-status-modal__progress-step_active'
                                                    : '';
                                                const currentCls = current()
                                                    ? ' order-status-modal__progress-step_current'
                                                    : '';
                                                return `${base}${reachedCls}${currentCls}`;
                                            }}
                                        >
                                            <div
                                                class={`order-status-modal__progress-icon order-status-modal__progress-icon_${step.key}`}
                                            />
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                        <Show when={showPaymentButton}>
                            <button type="button" class="order-status-modal__pay-btn" onClick={handlePay}>
                                {() => `Оплатить ${formatRubles(myPayAmount())}₽`}
                            </button>
                        </Show>
                        <Show when={processing}>
                            <div class="order-status-modal__processing">
                                <span class="order-status-modal__spinner" />
                                <span>Обрабатываем оплату…</span>
                            </div>
                        </Show>
                        <Show when={showCancelButton}>
                            <button
                                type="button"
                                class="order-status-modal__cancel-btn"
                                onClick={() => {
                                    void handleCancel();
                                }}
                            >
                                Отменить заказ
                            </button>
                        </Show>
                        <Show when={() => errorText() !== ''}>
                            <div class="order-status-modal__error">{errorText}</div>
                        </Show>
                    </div>

                    <Show when={() => splits().length > 0 && splitSummary() !== null}>
                        <div class="order-status-modal__divider" />
                        <div
                            class={() =>
                                `order-status-modal__split-summary order-status-modal__split-summary_${
                                    splitSummary()?.kind ?? 'info'
                                }`
                            }
                        >
                            {() => splitSummary()?.text ?? ''}
                        </div>
                    </Show>

                    <div class="order-status-modal__divider" />

                    <div class="order-status-modal__section-title">Состав заказа</div>

                    <div class="order-status-modal__items">
                        <For each={() => order()?.items ?? []} key={(_it, idx) => idx}>
                            {(item) => (
                                <div class="order-status-modal__item">
                                    <div class="order-status-modal__item-left">
                                        <img
                                            class="order-status-modal__item-img"
                                            src={item.image_url ?? ''}
                                            alt={item.name}
                                            onError={handleImageError}
                                        />
                                        <div class="order-status-modal__item-info">
                                            <div class="order-status-modal__item-name">{item.name}</div>
                                            <div class="order-status-modal__item-meta">
                                                {String(item.quantity)} шт. x {(item.price / 1_000_000).toFixed(0)}₽
                                            </div>
                                        </div>
                                    </div>
                                    <div class="order-status-modal__item-price">
                                        {((item.price * item.quantity) / 1_000_000).toFixed(0)}₽
                                    </div>
                                </div>
                            )}
                        </For>

                        <div class="order-status-modal__fee-row">
                            <div class="order-status-modal__fee-label">Сервисный сбор:</div>
                            <div class="order-status-modal__fee-value">
                                {() => formatRubles(order()?.service_fee ?? 0)}₽
                            </div>
                        </div>

                        <div class="order-status-modal__fee-row">
                            <div class="order-status-modal__fee-label">Доставка:</div>
                            <div class="order-status-modal__fee-value">
                                {() => formatRubles(order()?.delivery_cost ?? 0)}₽
                            </div>
                        </div>

                        <Show when={() => (order()?.discount_amount ?? 0) > 0}>
                            <div class="order-status-modal__fee-row order-status-modal__fee-row_discount">
                                <div class="order-status-modal__fee-label">
                                    {() =>
                                        order()?.applied_promocode
                                            ? `Промокод ${order()?.applied_promocode}:`
                                            : 'Скидка по промокоду:'
                                    }
                                </div>
                                <div class="order-status-modal__fee-value">
                                    {() => `−${formatRubles(order()?.discount_amount ?? 0)}₽`}
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>
        </div>
    );
}
