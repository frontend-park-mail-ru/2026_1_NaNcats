import { Store } from '@shared/lib/store';
import { cartApi } from '../api/cartApi';
import type { CartConfirmer, CartState, DishToAdd } from './types';

class CartStore extends Store<CartState> {
    constructor() {
        super({ id: '', items: [], restaurantId: 0, status: 'idle' });
    }

    async load(): Promise<void> {
        this.setState({ status: 'loading' });
        try {
            const { id, items, restaurantId } = await cartApi.load();
            this.setState({ id, items, restaurantId, status: 'idle', error: undefined });
        } catch (e) {
            console.error('cartStore.load', e);
            this.setState({ status: 'error', error: 'load failed' });
        }
    }

    async addDish(dish: DishToAdd, restaurantId: number, confirmer?: CartConfirmer): Promise<void> {
        const state = this.getState();
        
        // Если меняем ресторан — сначала чистим
        if (state.items.length > 0 && state.restaurantId !== restaurantId) {
            const ok = confirmer ? await confirmer() : false;
            if (!ok) return;
            await this.clear();
        }

        this.setState({ status: 'syncing' });
        try {
            const existing = state.items.find((i) => i.dish_id === dish.id);
            if (existing) {
                // Если товар уже есть, увеличиваем кол-во
                await cartApi.update(state.id, dish.id, existing.quantity + 1);
            } else {
                // Иначе добавляем новый
                await cartApi.add(state.id, dish.id, 1);
            }
            await this.load(); // Подтягиваем актуальное состояние с бэка
        } catch (e) {
            console.error('cartStore.addDish', e);
            this.setState({ status: 'error', error: 'add failed' });
        }
    }

    async changeQuantity(dishId: number, delta: number): Promise<void> {
        const state = this.getState();
        const target = state.items.find((i) => i.dish_id === dishId);
        if (!target) return;

        const nextQty = target.quantity + delta;
        this.setState({ status: 'syncing' });

        try {
            if (nextQty <= 0) {
                await cartApi.remove(state.id, dishId);
            } else {
                await cartApi.update(state.id, dishId, nextQty);
            }
            await this.load();
        } catch (e) {
            console.error('cartStore.changeQuantity', e);
            this.setState({ status: 'error', error: 'update failed' });
        }
    }

    async clear(): Promise<void> {
        const state = this.getState();
        if (!state.id) return;
        
        this.setState({ status: 'syncing' });
        try {
            await cartApi.clear(state.id);
            await this.load();
        } catch (e) {
            console.error('cartStore.clear', e);
            this.setState({ status: 'error', error: 'clear failed' });
        }
    }
}

export const cartStore = new CartStore();
