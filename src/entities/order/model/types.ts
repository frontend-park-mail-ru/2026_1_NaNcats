export interface OrderCreatePayload {
    address_id: string;
    branch_id: number;
    brand_id: number;  
    pay_for_all: boolean;
    payment_method_id: string;
    delivery_cost: number;
    service_fee: number;
    total_cost: number;
}

export interface OrderCreateResponse {
    order_id: string;
    confirmation_url?: string;
}

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

export type OrderUiStatus =
    | 'awaiting_payment'
    | 'created'
    | 'cooking'
    | 'delivering'
    | 'delivered'
    | 'cancelled';

export interface OrderItem {
    dish_id: number;
    name: string;
    quantity: number;
    price: number;
    image_url?: string;
}

export interface OrderRestaurant {
    id: number;
    name: string;
    image_url?: string;
    rating?: number;
    reviews_count?: number;
}

export interface Order {
    order_id: string;
    status: string;
    total_cost?: number;
    created_at?: string;
    restaurant_id?: number;
    restaurant_name?: string;
    restaurant_image_url?: string;
    restaurant_rating?: number;
    restaurant_reviews_count?: number;
    items?: OrderItem[];
    service_fee?: number;
    delivery_cost?: number;
    eta_minutes?: number;
    payment_url?: string;
    [extra: string]: unknown;
}

export interface NormalizedOrder {
    order_id: string;
    status: OrderUiStatus;
    raw_status: string;
    created_at: string;
    eta_minutes: number;
    restaurant: OrderRestaurant;
    items: OrderItem[];
    service_fee: number;
    delivery_cost: number;
    total_cost: number;
    payment_url?: string;
    error?: string;
}

export interface GatewayWsEvent {
    order_id: string;
    status: string;
    payment_url?: string;
    error?: string;
}
