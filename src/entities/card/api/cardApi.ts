import { httpClient } from '@shared/api/http';
import type { Card, CardBindResponse } from '../model/types';

/**
 * REST-клиент для работы с привязанными банковскими картами в профиле
 * пользователя.
 */
export const cardApi = {
    /**
     * Возвращает список привязанных карт.
     *
     * @returns Массив карт.
     */
    list(): Promise<Card[]> {
        return httpClient.getJson<Card[]>('/profile/cards');
    },

    /**
     * Инициирует процедуру привязки новой карты.
     *
     * @returns Ответ с URL формы подтверждения, на которую нужно редиректить
     *   пользователя.
     */
    bind(): Promise<CardBindResponse> {
        return httpClient.postJson<CardBindResponse>('/profile/cards/bind', {});
    },

    /**
     * Удаляет привязанную карту.
     *
     * @param id Идентификатор карты.
     */
    remove(id: string): Promise<void> {
        return httpClient.send('DELETE', `/profile/cards/${id}`);
    },

    /**
     * Назначает карту картой по умолчанию.
     *
     * @param id Идентификатор карты.
     */
    setDefault(id: string): Promise<void> {
        return httpClient.send('PUT', `/profile/cards/${id}`);
    },
};
