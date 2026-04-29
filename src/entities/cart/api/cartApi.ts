import { httpClient } from '@shared/api/http';
import type { CartItem } from '../model/types';

interface CartResponse {
    cart_id?: string;
    items?: CartItem[];
    restaurant_id?: number;
}

export const cartApi = {
    async load(): Promise<{ id: string; items: CartItem[]; restaurantId: number }> {
        const data = await httpClient.getJson<CartResponse>('/cart');
        return { 
            id: data.cart_id ?? '', 
            items: data.items ?? [], 
            restaurantId: data.restaurant_id ?? 0 
        };
    },

    add(cartId: string, dishId: number, quantity: number): Promise<void> {
        return httpClient.postJson('/cart/items', { cart_id: cartId, dish_id: dishId, quantity });
    },

    update(cartId: string, dishId: number, quantity: number): Promise<void> {
        return httpClient.putJson('/cart/items', { cart_id: cartId, dish_id: dishId, quantity });
    },

    remove(cartId: string, dishId: number): Promise<void> {
        return httpClient.deleteJson('/cart/items', { cart_id: cartId, dish_id: dishId });
    },

    clear(cartId: string): Promise<void> {
        return httpClient.deleteJson('/cart', { cart_id: cartId });
    }
};
