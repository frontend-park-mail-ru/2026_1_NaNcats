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
    type OrderTracker,
    type OrderUiStatus,
} from '@entities/order';
import { computed, onCleanup, signal } from '@shared/lib/signals';
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

    const errorText = computed(() => order()?.error ?? '');

    /** Индекс активного шага прогресс-бара; шаги читают его реактивно. */
    const currentStepIdx = computed(() => {
        const o = order();
        return o === null ? -1 : activeStepIndex(o.status);
    });

    const steps = computed<readonly ProgressStep[]>(() =>
        order() === null ? [] : PROGRESS_STEPS,
    );

    const statusText = computed(() => {
        const o = order();
        return o === null ? '' : STATUS_TEXT[o.status](o.eta_minutes);
    });

    const showPaymentButton = computed(() => {
        if (processing()) return false;
        const o = order();
        return o !== null && o.status === 'awaiting_payment' && o.payment_url !== undefined;
    });

    const showCancelButton = computed(() => {
        if (processing()) return false;
        const o = order();
        return o !== null && CANCELLABLE_STATUSES.has(o.status);
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
        const next = mergeEvent(current, event);
        if (PAYMENT_SETTLED_RAW_STATUSES.has(next.raw_status)) {
            endPaymentProcessing();
        }
        order.set(next);
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
        onCloseCallback = options.onClose ?? null;
        order.set(normalized);
        isActive.set(true);

        if (options.subscribe === true && !isTerminalRawStatus(normalized.raw_status)) {
            subscribeToOrder(normalized.order_id);
        }
    };

    const close = () => {
        disconnectTracker();
        endPaymentProcessing();
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
            const msg = e instanceof Error ? e.message : 'Не удалось отменить заказ';
            window.alert(msg);
        }
    };

    const handlePay = () => {
        const current = order();
        if (current === null || current.payment_url === undefined) return;
        beginPaymentProcessing();
        window.open(current.payment_url, '_blank', 'noopener');
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
            class={() =>
                isActive() ? 'modal-overlay modal-overlay_active' : 'modal-overlay'
            }
            id="order-status-modal"
            onClick={handleOverlayClick}
        >
            <Show when={order}>
                <div class="order-status-modal">
                    <button
                        type="button"
                        class="order-status-modal__close"
                        aria-label="Закрыть"
                        onClick={close}
                    >
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
                                <span class="order-status-modal__star">★</span>
                                <span>
                                    {() => String(order()?.restaurant.rating ?? 0)} (
                                    {() =>
                                        formatReviews(order()?.restaurant.reviews_count ?? 0)
                                    }
                                    )
                                </span>
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
                        <div class="order-status-modal__progress-text">
                            {statusText}
                        </div>
                        <div class="order-status-modal__progress-track">
                            <For
                                each={steps}
                                key={(s) => s.key}
                            >
                                {(step, idx) => {
                                    // Computed по idx этого шага: пересчитываются при смене статуса заказа.
                                    const reached = computed(
                                        () => idx <= currentStepIdx() && currentStepIdx() >= 0,
                                    );
                                    const current = computed(() => idx === currentStepIdx());
                                    return (
                                        <>
                                            <Show when={() => idx > 0}>
                                                <div
                                                    class={() =>
                                                        reached()
                                                            ? 'order-status-modal__progress-dot order-status-modal__progress-dot_active'
                                                            : 'order-status-modal__progress-dot'
                                                    }
                                                />
                                            </Show>
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
                                        </>
                                    );
                                }}
                            </For>
                        </div>
                        <Show when={showPaymentButton}>
                            <button
                                type="button"
                                class="order-status-modal__pay-btn"
                                onClick={handlePay}
                            >
                                Оплатить
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
                            <div class="order-status-modal__error">
                                {errorText}
                            </div>
                        </Show>
                    </div>

                    <div class="order-status-modal__divider" />

                    <div class="order-status-modal__section-title">Состав заказа</div>

                    <div class="order-status-modal__items">
                        <For
                            each={() => order()?.items ?? []}
                            key={(it) => `${String(it.dish_id)}-${it.name}`}
                        >
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
                                            <div class="order-status-modal__item-name">
                                                {item.name}
                                            </div>
                                            <div class="order-status-modal__item-meta">
                                                {String(item.quantity)} шт. x{' '}
                                                {(item.price / 1_000_000).toFixed(0)}₽
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
                    </div>
                </div>
            </Show>
        </div>
    );
}
