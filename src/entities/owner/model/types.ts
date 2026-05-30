/**
 * Типы данных для панели владельца ресторана.
 */

/** Бренд ресторана, принадлежащий владельцу. */
export interface OwnerBrand {
    id: string;
    name: string;
    description: string;
    logo_url: string;
}

/** Блюдо в меню ресторана. */
export interface OwnerDish {
    id: string;
    name: string;
    description: string;
    price: number; // в микрорублях (raw)
    image_url: string;
}

/** АНАЛИТИКА */

/** Финансовые показатели. */
export interface FinancialStats {
    total_revenue_raw: number;
    average_ticket_raw: number;
    total_discounts_raw: number;
    total_orders_count: number;
}

/** Операционные метрики. */
export interface OperationalStats {
    avg_cooking_time_sec: number;
    status_counts: Record<string, number>;
}

/** Статистика по блюду. */
export interface DishStat {
    dish_id: number;
    dish_name: string;
    units_sold: number;
    total_revenue_raw: number;
}

/** Статистика по типу заказа. */
export interface OrderTypeStat {
    order_type: string;
    orders_count: number;
    avg_group_size: number;
}

/** Точка временного ряда. */
export interface TimelinePoint {
    date: string;
    revenue_raw: number;
    orders_count: number;
}

/** Полная структура аналитики владельца. */
export interface OwnerStats {
    financial: FinancialStats;
    operational: OperationalStats;
    dishes: DishStat[];
    order_types: OrderTypeStat[];
    timeline: TimelinePoint[];
}

/** Параметры запроса аналитики. */
export interface AnalyticsParams {
    restaurant_id: string;
    start_time: string; // YYYY-MM-DD
    end_time: string; // YYYY-MM-DD
}
