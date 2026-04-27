import { Store } from '@shared/lib/store';
import { cartApi } from '../api/cartApi';
import type { CartConfirmer, CartItem, CartState, DishToAdd } from './types';

class CartStore extends Store<CartState> {
    constructor() {
        super({ items: [], restaurantId: 0, status: 'idle' });
    }

    async load(): Promise<void> {
        this.setState({ status: 'loading' });
        try {
            const { items, restaurantId } = await cartApi.load();
            this.setState({ items, restaurantId, status: 'idle', error: undefined });
        } catch (e) {
            console.error('cartStore.load', e);
            this.setState({ status: 'error', error: 'load failed' });
        }
    }

    async addDish(dish: DishToAdd, restaurantId: number, confirmer?: CartConfirmer): Promise<void> {
        const state = this.getState();
        let items = state.items;

        if (items.length > 0 && state.restaurantId !== restaurantId) {
            const ok = confirmer ? await confirmer() : false;
            if (!ok) return;
            items = [];
        }

        const existing = items.find((i) => i.dish_id === dish.id);
        const nextItems: CartItem[] = existing
            ? items.map((i) => (i.dish_id === dish.id ? { ...i, quantity: i.quantity + 1 } : i))
            : [
                  ...items,
                  { dish_id: dish.id, name: dish.name, price: dish.price, image_url: dish.image_url, quantity: 1 },
              ];

        this.setState({ items: nextItems, restaurantId, status: 'syncing' });
        await this.sync();
    }

    async changeQuantity(dishId: number, delta: number): Promise<void> {
        const { items } = this.getState();
        const target = items.find((i) => i.dish_id === dishId);
        if (!target) return;

        const nextQty = target.quantity + delta;
        const nextItems = nextQty <= 0
            ? items.filter((i) => i.dish_id !== dishId)
            : items.map((i) => (i.dish_id === dishId ? { ...i, quantity: nextQty } : i));

        this.setState({ items: nextItems, status: 'syncing' });
        await this.sync();
    }

    async clear(): Promise<void> {
        this.setState({ items: [], restaurantId: 0, status: 'syncing' });
        await this.sync();
    }

    private async sync(): Promise<void> {
        const { items, restaurantId } = this.getState();
        try {
            await cartApi.sync(restaurantId, items);
            const fresh = await cartApi.load();
            this.setState({ items: fresh.items, restaurantId: fresh.restaurantId, status: 'idle', error: undefined });
        } catch (e) {
            console.error('cartStore.sync', e);
            this.setState({ status: 'error', error: 'sync failed' });
        }
    }
}

export const cartStore = new CartStore();
