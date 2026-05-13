import { userStore } from '@entities/user';

/**
 * Выполняет выход пользователя через хранилище: завершает сессию на сервере
 * и сбрасывает связанные с пользователем данные в клиентском состоянии.
 */
export const logoutAction = async () => {
    await userStore.logout();
};
