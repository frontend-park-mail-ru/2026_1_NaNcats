import { userApi, userStore } from '@entities/user';

/**
 * Выполняет вход пользователя по почте и паролю и подгружает текущий профиль
 * в хранилище.
 *
 * @param email Адрес электронной почты пользователя.
 * @param password Пароль пользователя в открытом виде.
 */
export const loginAction = async (email: string, password: string) => {
    await userApi.login(email, password);
    await userStore.loadCurrent();
};
