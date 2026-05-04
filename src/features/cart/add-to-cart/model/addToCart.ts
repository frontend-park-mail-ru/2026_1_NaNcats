import { cartStore, type CartConfirmer, type DishToAdd } from '@entities/cart';

export const addToCart = async (dish: DishToAdd, restaurantId: number, confirmer?: CartConfirmer): Promise<void> => {
    await cartStore.addDish(dish, restaurantId, confirmer);
};
