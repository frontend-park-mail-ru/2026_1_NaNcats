import { userStore } from '@entities/user';

/**
 * Обновляет имя и почту текущего пользователя через хранилище.
 *
 * @param patch Новые значения имени и почты.
 * @returns Обновлённый профиль пользователя.
 */
export const editProfile = async (patch: { name: string; email: string }) => {
    return userStore.update(patch);
};
