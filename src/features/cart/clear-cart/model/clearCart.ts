import { cartStore } from '@entities/cart';

/**
 * Очищает корзину текущего пользователя через хранилище.
 */
export const clearCart = async (): Promise<void> => {
    await cartStore.clear();
};
