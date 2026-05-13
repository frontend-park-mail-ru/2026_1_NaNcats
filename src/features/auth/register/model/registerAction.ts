import { userApi, userStore } from '@entities/user';

/**
 * Регистрирует нового пользователя и подгружает текущий профиль в хранилище.
 *
 * @param payload Данные нового пользователя (имя, почта, пароль).
 */
export const registerAction = async (payload: { name: string; email: string; password: string }) => {
    await userApi.register(payload);
    await userStore.loadCurrent();
};
