/**
 * Модалка статуса заказа на JSX/VDOM.
 *
 * Поведение перенесено из class-based {@link ./OrderStatusModal.ts} один в
 * один: модалка-оверлей, прогресс-бар, состав заказа, ресторан и итоговая
 * сумма, подключение к WebSocket-трекеру обновлений и реактивная
 * перерисовка при приходящих событиях. Кнопка оплаты переводит модалку в
 * состояние ожидания подтверждения с таймаутом, после которого выводится
 * сообщение об ошибке.
 *
 * Императивный API. Страницы Checkout и Profile открывают модалку из
 * собственных обработчиков уже после получения снимка заказа из API.
 * Поэтому виджет смонтирован всегда, но в скрытом виде (без активного
 * `modal-overlay_active`-класса), а открытие происходит через колбэк-
 * контроллер: страница получает controller через проп `controllerRef` и
 * зовёт его `open(order, opts)` в нужный момент. Это совместимо с legacy-
 * сигнатурой `modal.open(order, options)` и не требует переписывать
 * страницы поверх Modal/Popup.
 *
 * Дисциплина реактивных выражений. Все производные поля (`steps`,
 * `statusText`, видимость кнопок) реализованы через `computed`, чтобы
 * пересчитываться только при изменении сигнала `order` или `processing`.
 * Все JSX-выражения, которые должны меняться в рантайме, передаются как
 * аксессоры или `<Show when={...}>` с функцией-условием.
 */

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

/**
 * Параметры открытия модалки.
 */
export interface OrderStatusModalOpenOptions {
    /** Подписаться на стрим обновлений заказа через WebSocket-трекер. */
    subscribe?: boolean;
    /**
     * Колбэк закрытия модалки. Вызывается при клике по затемнению, по
     * крестику и после успешной отмены заказа. Используется страницей,
     * чтобы выполнить навигацию или дополнительные действия.
     */
    onClose?: () => void;
}

/**
 * Внешний интерфейс модалки, отдаваемый через {@link OrderStatusModalProps.controllerRef}.
 *
 * Совпадает с legacy-сигнатурой class-based {@link ./OrderStatusModal.ts}, чтобы
 * страницы могли использовать одинаковый шаблон вызова.
 */
export interface OrderStatusModalController {
    /**
     * Открывает модалку для заданного заказа.
     *
     * @param rawOrder Заказ в исходном представлении API.
     * @param options Опции открытия (подписка, колбэк закрытия).
     */
    open(rawOrder: Order, options?: OrderStatusModalOpenOptions): void;
    /** Закрывает модалку, отменяет подписку и таймер ожидания оплаты. */
    close(): void;
}

/**
 * Входные данные виджета {@link OrderStatusModal}.
 *
 * Виджет монтируется один раз (обычно в корне страницы) и управляется
 * императивно через controller, переданный в `controllerRef`. При желании
 * можно подать `initialOrder`, чтобы модалка отобразилась сразу при mount
 * без дополнительного вызова `open`.
 */
export interface OrderStatusModalProps {
    /**
     * Колбэк, в который виджет передаёт свой controller после mount.
     * Передаётся под `null`, когда виджет размонтируется. Имя отличается
     * от стандартного `ref`, потому что ядро VDOM применяет проп `ref`
     * только к DOM-узлам.
     */
    controllerRef?: (ctl: OrderStatusModalController | null) => void;
    /** Опциональный начальный заказ для немедленного открытия. */
    initialOrder?: Order;
    /** Опции для начального открытия (если задан `initialOrder`). */
    initialOptions?: OrderStatusModalOpenOptions;
}

/**
 * Один шаг прогресс-бара статусов заказа.
 *
 * Структура намеренно содержит только ключ. Признаки достижения и текущего
 * шага вычисляются через computed по `currentStepIdx` и индексу: `For` не
 * перевызывает children-callback при смене статуса, поэтому реактивные
 * классы должны читать значения через аксессоры, а не из полей элемента.
 */
interface ProgressStep {
    /** Идентификатор статуса, к которому относится шаг. */
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

/**
 * Проверяет, является ли сырой статус заказа терминальным.
 *
 * @param raw Сырой статус из API.
 * @returns true, если заказ завершён, отменён или упал в ошибку.
 */
function isTerminalRawStatus(raw: string): boolean {
    return TERMINAL_RAW_STATUSES.has(raw);
}

/**
 * Возвращает индекс шага, который соответствует текущему UI-статусу.
 *
 * Для отменённых и ожидающих оплату заказов возвращает -1, чтобы все шаги
 * остались не достигнутыми.
 *
 * @param status Текущий UI-статус заказа.
 * @returns Индекс текущего шага в STATUS_FLOW либо -1.
 */
function activeStepIndex(status: OrderUiStatus): number {
    if (status === 'cancelled' || status === 'awaiting_payment') return -1;
    return STATUS_FLOW.indexOf(status);
}

/** Список шагов прогресс-бара (статичный, перестроения не требуется). */
const PROGRESS_STEPS: ProgressStep[] = STATUS_FLOW.map((key) => ({ key }));

/**
 * Приводит дату к виду DD.MM. Поддерживает ISO-строки и уже-сформированные
 * строки DD.MM.YYYY. Для невалидного значения возвращает исходную строку.
 *
 * @param value Дата в произвольном формате.
 * @returns Дата вида DD.MM или исходная строка.
 */
function formatDate(value: string): string {
    if (value === '') return '';
    const ddmmyyyy = /^(\d{2})\.(\d{2})\.\d{4}$/.exec(value);
    if (ddmmyyyy !== null) return `${ddmmyyyy[1]}.${ddmmyyyy[2]}`;
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
 * Применяет к текущему нормализованному заказу новое событие WS-трекера:
 * меняет статус и URL оплаты, пересобирает нормализованный объект (чтобы
 * UI-статус согласовался с raw-статусом), сохраняет текст ошибки.
 *
 * @param current Текущий нормализованный заказ.
 * @param event Событие шлюза с обновлением.
 * @returns Новый нормализованный заказ.
 */
function mergeEvent(current: NormalizedOrder, event: GatewayWsEvent): NormalizedOrder {
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

/**
 * Модалка статуса заказа.
 *
 * Виджет всегда смонтирован, но отображается только когда вызван
 * `controller.open(order)`. До первого open сигнал `order` равен null, и
 * корневой `.modal-overlay` рендерится без класса `_active`, оставаясь
 * невидимым.
 *
 * @param props Пропсы модалки: controllerRef, initialOrder, initialOptions.
 * @returns VNode-дерево модалки.
 */
export function OrderStatusModal(props: OrderStatusModalProps): VNode {
    /**
     * Текущий нормализованный заказ. null означает, что модалка ещё не
     * открывалась или закрыта.
     */
    const order = signal<NormalizedOrder | null>(null);

    /** Активна ли модалка визуально (управляется классом `_active`). */
    const isActive = signal<boolean>(false);

    /** Флаг ожидания подтверждения оплаты после клика по кнопке "Оплатить". */
    const processing = signal<boolean>(false);

    /** Локальное состояние ошибки, отображаемое поверх данных заказа. */
    const errorText = computed<string>(() => order()?.error ?? '');

    /**
     * Индекс активного шага прогресс-бара. Вынесен в computed, чтобы реактивные
     * классы каждого шага читали его и обновлялись без перерисовки списка.
     */
    const currentStepIdx = computed<number>(() => {
        const o = order();
        return o === null ? -1 : activeStepIndex(o.status);
    });

    /** Шаги прогресс-бара. Пустой массив, пока заказ не открыт. */
    const steps = computed<readonly ProgressStep[]>(() =>
        order() === null ? [] : PROGRESS_STEPS,
    );

    /** Текст статуса заказа в шапке прогресс-бара. */
    const statusText = computed<string>(() => {
        const o = order();
        return o === null ? '' : STATUS_TEXT[o.status](o.eta_minutes);
    });

    /** Видна ли кнопка "Оплатить". */
    const showPaymentButton = computed<boolean>(() => {
        if (processing()) return false;
        const o = order();
        return o !== null && o.status === 'awaiting_payment' && o.payment_url !== undefined;
    });

    /** Видна ли кнопка "Отменить заказ". */
    const showCancelButton = computed<boolean>(() => {
        if (processing()) return false;
        const o = order();
        return o !== null && CANCELLABLE_STATUSES.has(o.status);
    });

    /** Активный WS-трекер заказа, либо null, если подписка не открыта. */
    let tracker: OrderTracker | null = null;

    /** Таймер ожидания подтверждения оплаты; снимается при разрешении или при закрытии. */
    let paymentTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

    /** Колбэк закрытия, переданный в open(). */
    let onCloseCallback: (() => void) | null = null;

    /**
     * Сбрасывает состояние ожидания оплаты и отменяет таймер таймаута.
     */
    const endPaymentProcessing = (): void => {
        processing.set(false);
        if (paymentTimeoutTimer !== null) {
            clearTimeout(paymentTimeoutTimer);
            paymentTimeoutTimer = null;
        }
    };

    /**
     * Переводит модалку в состояние ожидания подтверждения оплаты.
     */
    const beginPaymentProcessing = (): void => {
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

    /**
     * Закрывает активный WS-трекер.
     */
    const disconnectTracker = (): void => {
        if (tracker !== null) {
            tracker.close();
            tracker = null;
        }
    };

    /**
     * Применяет событие из WS-трекера к текущему заказу.
     *
     * @param event Событие шлюза с обновлением заказа.
     */
    const applyEvent = (event: GatewayWsEvent): void => {
        const current = order();
        if (current === null) return;
        const next = mergeEvent(current, event);
        if (PAYMENT_SETTLED_RAW_STATUSES.has(next.raw_status)) {
            endPaymentProcessing();
        }
        order.set(next);
    };

    /**
     * Подключается к WS-трекеру обновлений заказа.
     *
     * @param orderId Идентификатор заказа для отслеживания.
     */
    const subscribeToOrder = (orderId: string): void => {
        tracker = connectOrderTracker(orderId, {
            onEvent: (event) => applyEvent(event),
        });
    };

    /**
     * Открывает модалку для заданного заказа.
     *
     * @param rawOrder Заказ в исходном представлении API.
     * @param options Опции открытия (подписка, колбэк закрытия).
     */
    const open = (rawOrder: Order, options: OrderStatusModalOpenOptions = {}): void => {
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

    /**
     * Закрывает модалку: сбрасывает подписку, состояние оплаты и видимость,
     * вызывает зарегистрированный колбэк onClose.
     */
    const close = (): void => {
        disconnectTracker();
        endPaymentProcessing();
        isActive.set(false);
        const cb = onCloseCallback;
        onCloseCallback = null;
        if (cb !== null) cb();
    };

    /**
     * Запрашивает у пользователя подтверждение и отменяет заказ через API.
     */
    const handleCancel = async (): Promise<void> => {
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

    /**
     * Обрабатывает клик по кнопке "Оплатить".
     */
    const handlePay = (): void => {
        const current = order();
        if (current === null || current.payment_url === undefined) return;
        beginPaymentProcessing();
        window.open(current.payment_url, '_blank', 'noopener');
    };

    /**
     * Обрабатывает клик по затемнению модалки: закрывает модалку, если клик
     * пришёл прямо по оверлею, а не по содержимому.
     *
     * @param event Событие клика.
     */
    const handleOverlayClick = (event: Event): void => {
        if (event.target !== event.currentTarget) return;
        close();
    };

    /**
     * Обрабатывает ошибку загрузки картинки: подменяет src на дефолтную.
     *
     * @param event Событие error.
     */
    const handleImageError = (event: Event): void => {
        const img = event.target as HTMLImageElement;
        if (img.src !== DEFAULT_IMAGE_URL) img.src = DEFAULT_IMAGE_URL;
    };

    const controller: OrderStatusModalController = { open, close };

    // Controller отдаётся синхронно при рендере: страница может сохранить
    // ссылку до того, как асинхронный ответ create-order запустит
    // controller.open(...). initialOrder, если передан, открывается уже
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
            class={(): string =>
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
                        Заказ от {(): string => formatDate(order()?.created_at ?? '')} на сумму{' '}
                        {(): string => formatRubles(order()?.total_cost ?? 0)}₽
                    </div>

                    <div class="order-status-modal__restaurant">
                        <img
                            class="order-status-modal__restaurant-img"
                            src={(): string => order()?.restaurant.image_url ?? ''}
                            alt={(): string => order()?.restaurant.name ?? ''}
                            onError={handleImageError}
                        />
                        <div class="order-status-modal__restaurant-info">
                            <div class="order-status-modal__restaurant-name">
                                {(): string => order()?.restaurant.name ?? ''}
                            </div>
                            <div class="order-status-modal__restaurant-rating">
                                <span class="order-status-modal__star">★</span>
                                <span>
                                    {(): string => String(order()?.restaurant.rating ?? 0)} (
                                    {(): string =>
                                        formatReviews(order()?.restaurant.reviews_count ?? 0)
                                    }
                                    )
                                </span>
                            </div>
                        </div>
                    </div>

                    <div
                        class={(): string =>
                            order()?.status === 'cancelled'
                                ? 'order-status-modal__progress order-status-modal__progress_cancelled'
                                : 'order-status-modal__progress'
                        }
                    >
                        <div class="order-status-modal__progress-text">
                            {(): string => statusText()}
                        </div>
                        <div class="order-status-modal__progress-track">
                            <For
                                each={(): readonly ProgressStep[] => steps()}
                                key={(s): string => s.key}
                            >
                                {(step, idx): VNode => {
                                    // Реактивные computed по idx этого шага: пересчитываются,
                                    // когда currentStepIdx (читай: статус заказа) меняется.
                                    const reached = computed<boolean>(
                                        () => idx <= currentStepIdx() && currentStepIdx() >= 0,
                                    );
                                    const current = computed<boolean>(() => idx === currentStepIdx());
                                    return (
                                        <>
                                            <Show when={(): boolean => idx > 0}>
                                                <div
                                                    class={(): string =>
                                                        reached()
                                                            ? 'order-status-modal__progress-dot order-status-modal__progress-dot_active'
                                                            : 'order-status-modal__progress-dot'
                                                    }
                                                />
                                            </Show>
                                            <div
                                                class={(): string => {
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
                                onClick={(): void => {
                                    void handleCancel();
                                }}
                            >
                                Отменить заказ
                            </button>
                        </Show>
                        <Show when={(): boolean => errorText() !== ''}>
                            <div class="order-status-modal__error">
                                {(): string => errorText()}
                            </div>
                        </Show>
                    </div>

                    <div class="order-status-modal__divider" />

                    <div class="order-status-modal__section-title">Состав заказа</div>

                    <div class="order-status-modal__items">
                        <For
                            each={(): readonly NormalizedOrder['items'][number][] =>
                                order()?.items ?? []
                            }
                            key={(it): string => `${String(it.dish_id)}-${it.name}`}
                        >
                            {(item): VNode => (
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
                                {(): string => formatRubles(order()?.service_fee ?? 0)}₽
                            </div>
                        </div>

                        <div class="order-status-modal__fee-row">
                            <div class="order-status-modal__fee-label">Доставка:</div>
                            <div class="order-status-modal__fee-value">
                                {(): string => formatRubles(order()?.delivery_cost ?? 0)}₽
                            </div>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    ) as VNode;
}
