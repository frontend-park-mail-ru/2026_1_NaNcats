import { httpClient, ApiError } from '@shared/api/http';
import type { CartItem } from '../model/types';

interface CartResponse {
    items?: CartItem[];
    restaurant_id?: number;
}

export const cartApi = {
    async load(): Promise<{ items: CartItem[]; restaurantId: number }> {
        const res = await httpClient.get('/cart');
        if (!res.ok) {
            throw new ApiError('cart.load failed', { status: res.status, url: '/cart' });
        }
        const data = (await res.json()) as CartResponse;
        return { items: data.items ?? [], restaurantId: data.restaurant_id ?? 0 };
    },

    async sync(restaurantId: number, items: CartItem[]): Promise<void> {
        const payload = {
            restaurant_id: restaurantId,
            items: items.map((i) => ({ dish_id: i.dish_id, quantity: i.quantity })),
        };
        const res = await httpClient.put('/cart', payload);
        if (!res.ok) {
            throw new ApiError('cart.sync failed', { status: res.status, url: '/cart' });
        }
    },
};
