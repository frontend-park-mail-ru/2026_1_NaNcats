import { cartStore } from '@entities/cart';

export const clearCart = async (): Promise<void> => {
    await cartStore.clear();
};
