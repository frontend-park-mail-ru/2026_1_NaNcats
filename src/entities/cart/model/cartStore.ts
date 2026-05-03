import { Store } from '@shared/lib/store';
import { ApiError } from '@shared/api/http';
import { cartApi } from '../api/cartApi';
import type { CartConfirmer, CartSnapshot, CartState, DishToAdd } from './types';

const isMultipleRestaurantsError = (e: unknown): boolean => {
    if (!(e instanceof ApiError)) return false;
    return e.status === 409 && e.message === 'MULTIPLE_RESTAURANTS';
};

const isCartLockedError = (e: unknown): boolean => {
    if (!(e instanceof ApiError)) return false;
    return e.status === 409 && e.message === 'CART_LOCKED';
};

class CartStore extends Store<CartState> {
    constructor() {
        super({
            cartId: null,
            items: [],
            restaurantId: 0,
            mode: 'solo',
            roomStatus: '',
            adminId: null,
            members: [],
            totalCost: 0,
            status: 'idle',
        });
    }

    async load(): Promise<void> {
        this.setState({ status: 'loading', error: undefined });

        try {
            const snapshot = await cartApi.load();
            this.applySnapshot(snapshot, 'idle');
        } catch (e) {
            console.error('cartStore.load', e);
            this.setState({ status: 'error', error: 'load failed' });
        }
    }

    async addDish(dish: DishToAdd, restaurantId: number, confirmer?: CartConfirmer): Promise<void> {
        this.setState({ status: 'syncing', error: undefined });

        try {
            let snapshot = await this.ensureLoaded();

            if (snapshot.items.length > 0 && snapshot.restaurantId !== 0 && snapshot.restaurantId !== restaurantId) {
                const ok = confirmer ? await confirmer() : false;
                if (!ok) {
                    this.setState({ status: 'idle' });
                    return;
                }

                const currentCartId = snapshot.cartId;
                if (!currentCartId) {
                    throw new Error('cartStore.addDish: cart_id is missing before clear');
                }

                await cartApi.clear(currentCartId);
                snapshot = await this.refresh();
            }

            await this.addOrIncrement(snapshot, dish, restaurantId, confirmer);
            await this.refresh();
        } catch (e) {
            console.error('cartStore.addDish', e);
            this.setState({ status: 'error', error: e instanceof Error ? e.message : 'add failed' });
            throw e;
        }
    }

    private async addOrIncrement(
        snapshot: CartSnapshot,
        dish: DishToAdd,
        restaurantId: number,
        confirmer?: CartConfirmer,
    ): Promise<void> {
        const existing = snapshot.items.find((i) => i.dish_id === dish.id);

        try {
            if (existing) {
                const currentCartId = snapshot.cartId;
                if (!currentCartId) {
                    throw new Error('cartStore.addDish: cart_id is missing for quantity update');
                }
                await cartApi.updateQuantity(currentCartId, dish.id, existing.quantity + 1);
            } else {
                await cartApi.addItem(snapshot.cartId, dish.id, 1);
            }
        } catch (e) {
            if (isCartLockedError(e)) {
                const fresh = await this.refresh();
                if (fresh.cartId) {
                    await cartApi.clear(fresh.cartId);
                    await this.refresh();
                }
                await cartApi.addItem(null, dish.id, 1);
                return;
            }

            if (!isMultipleRestaurantsError(e)) throw e;

            const ok = confirmer ? await confirmer() : false;
            if (!ok) {
                this.setState({ status: 'idle' });
                return;
            }

            const fresh = await this.refresh();
            if (fresh.cartId) {
                await cartApi.clear(fresh.cartId);
                await this.refresh();
            }
            await cartApi.addItem(null, dish.id, 1);
        }

        void restaurantId;
    }

    async changeQuantity(dishId: number, delta: number): Promise<void> {
        this.setState({ status: 'syncing', error: undefined });

        try {
            const state = await this.ensureLoaded();

            const currentCartId = state.cartId;
            if (!currentCartId) {
                throw new Error('cartStore.changeQuantity: cart_id is missing');
            }

            const target = state.items.find((i) => i.dish_id === dishId);
            if (!target) {
                this.setState({ status: 'idle' });
                return;
            }

            const nextQty = target.quantity + delta;

            if (nextQty <= 0) {
                await cartApi.removeItem(currentCartId, dishId);
            } else {
                await cartApi.updateQuantity(currentCartId, dishId, nextQty);
            }

            await this.refresh();
        } catch (e) {
            console.error('cartStore.changeQuantity', e);
            this.setState({ status: 'error', error: 'change quantity failed' });
        }
    }

    async clear(): Promise<void> {
        this.setState({ status: 'syncing', error: undefined });

        try {
            const state = await this.ensureLoaded();

            if (!state.cartId) {
                this.setState({
                    cartId: null,
                    items: [],
                    restaurantId: 0,
                    mode: 'solo',
                    roomStatus: '',
                    adminId: null,
                    members: [],
                    totalCost: 0,
                    status: 'idle',
                    error: undefined,
                });
                return;
            }

            await cartApi.clear(state.cartId);
            await this.refresh();
        } catch (e) {
            console.error('cartStore.clear', e);
            this.setState({ status: 'error', error: 'clear failed' });
        }
    }

    private applySnapshot(snapshot: CartSnapshot, status: CartState['status']): void {
        this.setState({
            cartId: snapshot.cartId,
            items: snapshot.items,
            restaurantId: snapshot.restaurantId,
            mode: snapshot.mode,
            roomStatus: snapshot.roomStatus,
            adminId: snapshot.adminId,
            members: snapshot.members,
            totalCost: snapshot.totalCost,
            status,
            error: undefined,
        });
    }

    private async refresh(): Promise<CartState> {
        const fresh = await cartApi.load();
        this.applySnapshot(fresh, 'idle');
        return this.getState();
    }

    private async ensureLoaded(): Promise<CartState> {
        const state = this.getState();

        if (state.cartId || state.items.length > 0) {
            return state;
        }

        const fresh = await cartApi.load();
        this.applySnapshot(fresh, 'idle');
        return this.getState();
    }
}

export const cartStore = new CartStore();
