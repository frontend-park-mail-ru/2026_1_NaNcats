import { userStore, type User } from '@entities/user';

/**
 * Загружает новый аватар пользователя через хранилище.
 *
 * @param file Файл изображения, выбранный пользователем.
 * @returns Обновлённый профиль пользователя.
 */
export const uploadAvatar = (file: File): Promise<User> => userStore.uploadAvatar(file);

/**
 * Удаляет текущий аватар пользователя через хранилище.
 *
 * @returns Обновлённый профиль пользователя.
 */
export const deleteAvatar = (): Promise<User> => userStore.deleteAvatar();
