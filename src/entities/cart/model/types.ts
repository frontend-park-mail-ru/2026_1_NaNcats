export interface CartItem {
    dish_id: number;
    name: string;
    price: number;
    quantity: number;
    image_url: string;
    owner_user_id?: number | null;
}

export interface DishToAdd {
    id: number;
    name: string;
    price: number;
    image_url: string;
}

export interface CartMember {
    user_id: number;
    joined_at: string;
}

export interface CartSnapshot {
    cartId: string | null;
    items: CartItem[];
    restaurantId: number;
    mode: string;
    roomStatus: string;
    adminId: number | null;
    members: CartMember[];
    totalCost: number;
}

export type CartStatus = 'idle' | 'loading' | 'syncing' | 'error';

export interface CartState extends CartSnapshot {
    status: CartStatus;
    error?: string;
}

export type CartConfirmer = () => Promise<boolean>;
