import { Store } from '@shared/lib/store';
import { ApiError } from '@shared/api/http';
import { userApi } from '../api/userApi';
import type { User, UserState } from './types';

class UserStore extends Store<UserState> {
    constructor() {
        super({ user: null, status: 'idle' });
    }

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

    async uploadAvatar(file: File): Promise<User> {
        const updated = await userApi.uploadAvatar(file);
        const existing = this.getState().user;
        const merged: User = existing ? { ...existing, ...updated } : updated;
        this.setState({ user: merged });
        return merged;
    }

    async deleteAvatar(): Promise<User> {
        const updated = await userApi.deleteAvatar();
        const existing = this.getState().user;
        const merged: User = existing ? { ...existing, ...updated } : updated;
        this.setState({ user: merged });
        return merged;
    }

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
