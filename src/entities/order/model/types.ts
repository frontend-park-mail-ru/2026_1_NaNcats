/**
 * Полезная нагрузка для создания заказа.
 */
export interface OrderCreatePayload {
    /** Идентификатор адреса доставки. */
    address_id: string;
    /** Идентификатор филиала ресторана. */
    branch_id: number;
    /** Идентификатор бренда ресторана. */
    brand_id: number;
    /** Признак режима «оплачивает один за всех» в групповой корзине. */
    pay_for_all: boolean;
    /** Идентификатор привязанной карты для оплаты. */
    payment_method_id: string;
    /** Стоимость доставки в микрорублях. */
    delivery_cost: number;
    /** Сервисный сбор в микрорублях. */
    service_fee: number;
    /** Итоговая стоимость заказа в микрорублях. */
    total_cost: number;
}

/**
 * Ответ эндпоинта создания заказа.
 */
export interface OrderCreateResponse {
    /** Идентификатор созданного заказа. */
    order_id: string;
    /** URL страницы подтверждения оплаты, если она требуется. */
    confirmation_url?: string;
}

/**
 * Сырой статус заказа в формате бэкенда.
 *
 * Покрывает все стадии жизненного цикла: от создания и блокировки корзины,
 * через готовность к оплате, готовку и доставку, до финальных состояний.
 */
export type OrderRawStatus =
    | 'created'
    | 'cart_locked'
    | 'payment_ready'
    | 'paid'
    | 'in_progress'
    | 'waiting'
    | 'delivering'
    | 'finished'
    | 'cancelled'
    | 'failed';

/**
 * Статус заказа в формате UI: укрупнённые группы, на которые маппятся сырые
 * статусы бэкенда. Используется для упрощения логики отображения и иконок.
 */
export type OrderUiStatus = 'awaiting_payment' | 'created' | 'cooking' | 'delivering' | 'delivered' | 'cancelled';

/**
 * Позиция заказа.
 */
export interface OrderItem {
    /** Идентификатор блюда. */
    dish_id: number;
    /** Название блюда. */
    name: string;
    /** Количество единиц. */
    quantity: number;
    /** Цена за единицу в микрорублях. */
    price: number;
    /** Ссылка на изображение блюда. */
    image_url?: string;
}

/**
 * Краткая информация о ресторане, прикреплённая к заказу.
 */
export interface OrderRestaurant {
    /** Идентификатор ресторана. */
    id: number;
    /** Название ресторана. */
    name: string;
    /** Ссылка на логотип. */
    image_url?: string;
    /** Средний рейтинг. */
    rating?: number;
    /** Количество отзывов. */
    reviews_count?: number;
}

/**
 * Сырая форма заказа, которую возвращает бэкенд. Большинство полей
 * опциональны, поэтому работа с заказом ведётся через нормализованную форму
 * {@link NormalizedOrder}.
 */
export interface Order {
    /** Идентификатор заказа. */
    order_id: string;
    /** Сырой статус заказа. */
    status: string;
    /** Итоговая стоимость в микрорублях. */
    total_cost?: number;
    /** ISO-метка времени создания. */
    created_at?: string;
    /** Идентификатор ресторана. */
    restaurant_id?: number;
    /** Название ресторана. */
    restaurant_name?: string;
    /** Ссылка на логотип ресторана. */
    restaurant_image_url?: string;
    /** Рейтинг ресторана. */
    restaurant_rating?: number;
    /** Количество отзывов о ресторане. */
    restaurant_reviews_count?: number;
    /** Позиции заказа. */
    items?: OrderItem[];
    /** Сервисный сбор в микрорублях. */
    service_fee?: number;
    /** Стоимость доставки в микрорублях. */
    delivery_cost?: number;
    /** Расчётное время доставки в минутах. */
    eta_minutes?: number;
    /** URL страницы подтверждения оплаты. */
    payment_url?: string;
    /** Произвольные дополнительные поля бэкенда. */
    [extra: string]: unknown;
}

/**
 * Нормализованная форма заказа для UI: все обязательные поля заполнены,
 * данные ресторана сгруппированы, статус приведён к UI-варианту.
 */
export interface NormalizedOrder {
    /** Идентификатор заказа. */
    order_id: string;
    /** UI-статус заказа. */
    status: OrderUiStatus;
    /** Сырой статус из бэкенда (для бейджа и трекинга). */
    raw_status: string;
    /** ISO-метка времени создания. */
    created_at: string;
    /** Расчётное время доставки в минутах. */
    eta_minutes: number;
    /** Информация о ресторане. */
    restaurant: OrderRestaurant;
    /** Позиции заказа. */
    items: OrderItem[];
    /** Сервисный сбор в микрорублях. */
    service_fee: number;
    /** Стоимость доставки в микрорублях. */
    delivery_cost: number;
    /** Итоговая стоимость в микрорублях. */
    total_cost: number;
    /** URL страницы подтверждения оплаты, если она требуется. */
    payment_url?: string;
    /** Текст последней ошибки, если она была. */
    error?: string;
}

/**
 * Событие, приходящее по WebSocket-каналу трекинга заказа.
 */
export interface GatewayWsEvent {
    /** Идентификатор заказа. */
    order_id: string;
    /** Сырой статус заказа. */
    status: string;
    /** URL страницы подтверждения оплаты, если бэкенд её сгенерировал. */
    payment_url?: string;
    /** Текст ошибки, если статус терминальный с ошибкой. */
    error?: string;
}
