import { Store } from '@shared/lib/store';
import { ApiError } from '@shared/api/http';
import { userApi } from '../api/userApi';
import type { User, UserState } from './types';

/**
 * Стор текущего пользователя.
 *
 * Хранит профиль и поддерживает локальное состояние в актуальном виде после
 * операций обновления (профиль, аватар), не делая лишних повторных запросов
 * `GET /auth/me`. После выхода сбрасывает пользователя в `null`. Ошибка
 * сетевого запроса при выходе не считается фатальной (сессия в любом случае
 * завершается на клиенте).
 */
class UserStore extends Store<UserState> {
    constructor() {
        super({ user: null, status: 'idle' });
    }

    /**
     * Загружает текущего пользователя через {@link userApi.getMe} и
     * записывает в состояние. При ошибке статус переводится в `error`,
     * прежний пользователь сохраняется без изменений.
     */
    async loadCurrent(): Promise<void> {
        this.setState({ status: 'loading' });
        try {
            const user = await userApi.getMe();
            this.setState({ user, status: 'idle' });
        } catch (e) {
            console.error('userStore.loadCurrent', e);
            this.setState({ status: 'error' });
        }
    }

    /**
     * Обновляет имя и email пользователя.
     *
     * Если в локальном состоянии пользователя ещё нет, сначала перечитывает
     * его с сервера, чтобы вернуть согласованную форму. Иначе сливает патч с
     * существующим профилем без повторного запроса.
     *
     * @param patch Новые значения имени и email.
     * @returns Обновлённый профиль.
     */
    async update(patch: { name: string; email: string }): Promise<User> {
        await userApi.updateProfile(patch);
        const existing = this.getState().user;
        if (!existing) {
            await this.loadCurrent();
            return this.getState().user as User;
        }
        const merged: User = { ...existing, ...patch };
        this.setState({ user: merged });
        return merged;
    }

    /**
     * Загружает новый аватар, сливает поля ответа с локальным профилем и
     * возвращает результат.
     *
     * @param file Файл изображения.
     * @returns Обновлённый профиль.
     */
    async uploadAvatar(file: File): Promise<User> {
        const updated = await userApi.uploadAvatar(file);
        const existing = this.getState().user;
        const merged: User = existing ? { ...existing, ...updated } : updated;
        this.setState({ user: merged });
        return merged;
    }

    /**
     * Удаляет аватар, сливает поля ответа с локальным профилем и возвращает
     * результат.
     *
     * @returns Обновлённый профиль.
     */
    async deleteAvatar(): Promise<User> {
        const updated = await userApi.deleteAvatar();
        const existing = this.getState().user;
        const merged: User = existing ? { ...existing, ...updated } : updated;
        this.setState({ user: merged });
        return merged;
    }

    /**
     * Выполняет выход из аккаунта и сбрасывает локальное состояние.
     *
     * Сетевые ошибки, не относящиеся к ApiError, логируются; ApiError
     * подавляется, потому что серверная сессия в любом случае завершается на
     * клиенте.
     */
    async logout(): Promise<void> {
        try {
            await userApi.logout();
        } catch (e) {
            if (!(e instanceof ApiError)) console.error('userStore.logout', e);
        }
        this.setState({ user: null, status: 'idle' });
    }
}

export const userStore = new UserStore();
