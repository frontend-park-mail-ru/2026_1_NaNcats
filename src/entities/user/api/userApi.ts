import { httpClient, ApiError, csrfStore } from '@shared/api/http';
import type { User } from '../model/types';

/**
 * Сырая форма ответа эндпоинтов аутентификации, содержащая CSRF-токен.
 */
interface AuthResponse {
    csrf_token?: string;
}

/**
 * REST-клиент для работы с аккаунтом пользователя: вход, регистрация,
 * получение профиля, обновление, аватар, выход. Все методы, возвращающие
 * CSRF-токен, прозрачно записывают его в {@link csrfStore}, чтобы
 * последующие защищённые запросы получили актуальный токен автоматически.
 */
export const userApi = {
    /**
     * Выполняет вход по email и паролю.
     *
     * @param email Email пользователя.
     * @param password Пароль пользователя.
     */
    async login(email: string, password: string): Promise<void> {
        const data = await httpClient.postJson<AuthResponse>('/auth/login', { login: email, password });
        if (data?.csrf_token) csrfStore.setToken(data.csrf_token);
    },

    /**
     * Регистрирует нового пользователя.
     *
     * @param payload Имя, email и пароль.
     */
    async register(payload: { name: string; email: string; password: string }): Promise<void> {
        const data = await httpClient.postJson<AuthResponse>('/auth/register', payload);
        if (data?.csrf_token) csrfStore.setToken(data.csrf_token);
    },

    /**
     * Возвращает текущего авторизованного пользователя.
     *
     * @returns Профиль пользователя или `null`, если запрос вернул 401
     *   (пользователь не авторизован).
     * @throws ApiError при любых других неуспешных статусах ответа.
     */
    async getMe(): Promise<User | null> {
        const res = await httpClient.get('/auth/me');
        if (res.status === 401) return null;
        if (!res.ok) {
            throw new ApiError('GET /auth/me failed', { status: res.status, url: '/auth/me' });
        }
        return (await res.json()) as User;
    },

    /**
     * Частично обновляет профиль (имя и email).
     *
     * @param patch Новые значения имени и email.
     */
    async updateProfile(patch: { name: string; email: string }): Promise<void> {
        await httpClient.patchJson<{ message: string }>('/profile', patch);
    },

    /**
     * Загружает новый аватар пользователя.
     *
     * @param file Файл изображения.
     * @returns Обновлённый профиль с новой ссылкой на аватар.
     */
    uploadAvatar(file: File): Promise<User> {
        const fd = new FormData();
        fd.append('avatar', file);
        return httpClient.postFormJson<User>('/profile/avatar', fd);
    },

    /**
     * Удаляет аватар пользователя.
     *
     * @returns Обновлённый профиль (со ссылкой на дефолтный аватар).
     */
    deleteAvatar(): Promise<User> {
        return httpClient.deleteJson<User>('/profile/avatar');
    },

    /**
     * Выполняет выход из аккаунта и очищает CSRF-токен.
     *
     * Статус 401 в ответе считается успешным завершением (сессия и так
     * закончилась), любые другие неуспешные статусы поднимаются как
     * ApiError.
     */
    async logout(): Promise<void> {
        const res = await httpClient.post('/auth/logout');
        csrfStore.clear();
        if (!res.ok && res.status !== 401) {
            throw new ApiError('logout failed', { status: res.status, url: '/auth/logout' });
        }
    },
};
