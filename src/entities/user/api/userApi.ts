import { httpClient, ApiError, csrfStore } from '@shared/api/http';
import type { User } from '../model/types';

interface AuthResponse {
    csrf_token?: string;
}

export const userApi = {
    async login(email: string, password: string): Promise<void> {
        const res = await httpClient.post('/auth/login', { login: email, password });
        if (!res.ok) {
            const body = await safeJson(res);
            throw new ApiError(body?.message ?? 'login failed', { status: res.status, url: '/auth/login' });
        }
        const data = (await safeJson(res)) as AuthResponse | null;
        if (data?.csrf_token) csrfStore.setToken(data.csrf_token);
    },

    async register(payload: { name: string; email: string; password: string }): Promise<void> {
        const res = await httpClient.post('/auth/register', payload);
        if (!res.ok) {
            const body = await safeJson(res);
            throw new ApiError(body?.message ?? 'register failed', { status: res.status, url: '/auth/register' });
        }
        const data = (await safeJson(res)) as AuthResponse | null;
        if (data?.csrf_token) csrfStore.setToken(data.csrf_token);
    },

    async getMe(): Promise<User | null> {
        const res = await httpClient.get('/auth/me');
        if (res.status === 401) return null;
        if (!res.ok) {
            throw new ApiError('GET /auth/me failed', { status: res.status, url: '/auth/me' });
        }
        return (await res.json()) as User;
    },

    async updateProfile(patch: { name: string; email: string }): Promise<User> {
        const res = await httpClient.patch('/profile', patch);
        if (!res.ok) {
            const body = await safeJson(res);
            throw new ApiError(body?.message ?? 'updateProfile failed', { status: res.status, url: '/profile' });
        }
        return (await res.json()) as User;
    },

    async uploadAvatar(file: File): Promise<User> {
        const fd = new FormData();
        fd.append('avatar', file);
        const res = await httpClient.postForm('/profile/avatar', fd);
        if (!res.ok) {
            const body = await safeJson(res);
            throw new ApiError(body?.message ?? 'uploadAvatar failed', { status: res.status, url: '/profile/avatar' });
        }
        return (await res.json()) as User;
    },

    async deleteAvatar(): Promise<User> {
        const res = await httpClient.delete('/profile/avatar');
        if (!res.ok) {
            throw new ApiError('deleteAvatar failed', { status: res.status, url: '/profile/avatar' });
        }
        return (await res.json()) as User;
    },

    async logout(): Promise<void> {
        const res = await httpClient.post('/auth/logout');
        csrfStore.clear();
        if (!res.ok && res.status !== 401) {
            throw new ApiError('logout failed', { status: res.status, url: '/auth/logout' });
        }
    },
};

async function safeJson(res: Response): Promise<{ message?: string } | null> {
    try {
        return await res.json();
    } catch {
        return null;
    }
}
