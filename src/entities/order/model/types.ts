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

export interface Order {
    id: string;
    status: string;
    total_cost?: number;
    [extra: string]: unknown;
}
