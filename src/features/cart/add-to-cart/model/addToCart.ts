import { cartStore, type CartConfirmer, type DishToAdd } from '@entities/cart';

/**
 * Добавляет блюдо в корзину через хранилище.
 *
 * Если в корзине уже есть блюда из другого ресторана, хранилище запрашивает
 * подтверждение очистки через переданный коллбэк.
 *
 * @param dish Блюдо для добавления.
 * @param restaurantId Идентификатор ресторана, из которого берётся блюдо.
 * @param confirmer Коллбэк подтверждения очистки корзины при смене ресторана.
 */
export const addToCart = async (dish: DishToAdd, restaurantId: number, confirmer?: CartConfirmer): Promise<void> => {
    await cartStore.addDish(dish, restaurantId, confirmer);
};
