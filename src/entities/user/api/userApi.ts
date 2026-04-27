import { httpClient, ApiError, csrfStore } from '@shared/api/http';
import type { User } from '../model/types';

interface AuthResponse {
    csrf_token?: string;
}

export const userApi = {
    async login(email: string, password: string): Promise<void> {
        const data = await httpClient.postJson<AuthResponse>('/auth/login', { login: email, password });
        if (data?.csrf_token) csrfStore.setToken(data.csrf_token);
    },

    async register(payload: { name: string; email: string; password: string }): Promise<void> {
        const data = await httpClient.postJson<AuthResponse>('/auth/register', payload);
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

    updateProfile(patch: { name: string; email: string }): Promise<User> {
        return httpClient.patchJson<User>('/profile', patch);
    },

    uploadAvatar(file: File): Promise<User> {
        const fd = new FormData();
        fd.append('avatar', file);
        return httpClient.postFormJson<User>('/profile/avatar', fd);
    },

    deleteAvatar(): Promise<User> {
        return httpClient.deleteJson<User>('/profile/avatar');
    },

    async logout(): Promise<void> {
        const res = await httpClient.post('/auth/logout');
        csrfStore.clear();
        if (!res.ok && res.status !== 401) {
            throw new ApiError('logout failed', { status: res.status, url: '/auth/logout' });
        }
    },
};
