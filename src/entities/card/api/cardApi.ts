import { httpClient } from '@shared/api/http';
import type { Card, CardBindResponse } from '../model/types';

export const cardApi = {
    list(): Promise<Card[]> {
        return httpClient.getJson<Card[]>('/profile/cards');
    },

    bind(): Promise<CardBindResponse> {
        return httpClient.postJson<CardBindResponse>('/profile/cards/bind', {});
    },

    remove(id: string): Promise<void> {
        return httpClient.send('DELETE', `/profile/cards/${id}`);
    },

    setDefault(id: string): Promise<void> {
        return httpClient.send('PUT', `/profile/cards/${id}`);
    },
};
