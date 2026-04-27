import { httpClient } from '@shared/api/http';
import type { CartItem } from '../model/types';

interface CartResponse {
    items?: CartItem[];
    restaurant_id?: number;
}

export const cartApi = {
    async load(): Promise<{ items: CartItem[]; restaurantId: number }> {
        const data = await httpClient.getJson<CartResponse>('/cart');
        return { items: data.items ?? [], restaurantId: data.restaurant_id ?? 0 };
    },

    sync(restaurantId: number, items: CartItem[]): Promise<void> {
        return httpClient.send('PUT', '/cart', {
            restaurant_id: restaurantId,
            items: items.map((i) => ({ dish_id: i.dish_id, quantity: i.quantity })),
        });
    },
};
