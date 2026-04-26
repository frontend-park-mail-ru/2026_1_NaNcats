import { httpClient, ApiError } from '@shared/api/http';
import type { Card, CardBindResponse } from '../model/types';

export const cardApi = {
    async list(): Promise<Card[]> {
        const res = await httpClient.get('/profile/cards');
        if (!res.ok) {
            throw new ApiError('cards.list failed', { status: res.status, url: '/profile/cards' });
        }
        return (await res.json()) as Card[];
    },

    async bind(): Promise<CardBindResponse> {
        const res = await httpClient.post('/profile/cards/bind', {});
        if (!res.ok) {
            throw new ApiError('cards.bind failed', { status: res.status, url: '/profile/cards/bind' });
        }
        return (await res.json()) as CardBindResponse;
    },

    async remove(id: string): Promise<void> {
        const url = `/profile/cards/${id}`;
        const res = await httpClient.delete(url);
        if (!res.ok) {
            throw new ApiError('cards.remove failed', { status: res.status, url });
        }
    },

    async setDefault(id: string): Promise<void> {
        const url = `/profile/cards/${id}`;
        const res = await httpClient.put(url);
        if (!res.ok) {
            throw new ApiError('cards.setDefault failed', { status: res.status, url });
        }
    },
};
