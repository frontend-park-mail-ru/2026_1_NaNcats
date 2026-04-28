export interface OrderCreatePayload {
    address_id: string;
    branch_id: number;
    payment_method_id: string;
    delivery_cost: number;
    service_fee: number;
    total_cost: number;
}

export interface OrderCreateResponse {
    confirmation_url?: string;
}

export type OrderStatus = 'created' | 'cooking' | 'delivering' | 'delivered' | 'cancelled';

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
    id: string;
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
    [extra: string]: unknown;
}

export interface NormalizedOrder {
    id: string;
    status: OrderStatus;
    created_at: string;
    eta_minutes: number;
    restaurant: OrderRestaurant;
    items: OrderItem[];
    service_fee: number;
    delivery_cost: number;
    total_cost: number;
}
