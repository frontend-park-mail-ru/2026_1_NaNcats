import { userStore } from '@entities/user';
import { cartStore } from '@entities/cart';

/**
 * Выполняет выход пользователя через хранилище: завершает сессию на сервере
 * и сбрасывает связанные с пользователем данные в клиентском состоянии.
 *
 * Корзина сбрасывается отдельно: её состояние и WebSocket-канал совместной
 * корзины привязаны к сессии и не должны переживать выход из аккаунта.
 */
export const logoutAction = async () => {
    await userStore.logout();
    cartStore.reset();
};
