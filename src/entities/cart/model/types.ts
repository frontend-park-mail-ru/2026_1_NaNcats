export interface CartItem {
    dish_id: number;
    name: string;
    price: number;
    quantity: number;
    image_url: string;
}

export interface DishToAdd {
    id: number;
    name: string;
    price: number;
    image_url: string;
}

export type CartStatus = 'idle' | 'loading' | 'syncing' | 'error';

export interface CartState {
    id: string;
    items: CartItem[];
    restaurantId: number;
    status: CartStatus;
    error?: string;
}

export type CartConfirmer = () => Promise<boolean>;
