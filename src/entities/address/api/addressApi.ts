import { httpClient } from '@shared/api/http';
import type { Address, AddressListResponse, AddressUpsertPayload } from '../model/types';

/**
 * REST-клиент для работы с сохранёнными адресами доставки в профиле
 * пользователя. Делегирует HTTP-запросы общему {@link httpClient}, нормализуя
 * ответы под доменные типы.
 */
export const addressApi = {
    /**
     * Загружает список сохранённых адресов текущего пользователя.
     *
     * @returns Массив адресов; пустой массив, если бэкенд вернул `null`.
     */
    async list(): Promise<Address[]> {
        const data = await httpClient.getJson<AddressListResponse>('/profile/addresses');
        return data.addresses ?? [];
    },

    /**
     * Создаёт новый адрес в профиле.
     *
     * @param payload Данные нового адреса (текст, координаты, детали).
     */
    create(payload: AddressUpsertPayload): Promise<void> {
        return httpClient.send('POST', '/profile/addresses', payload);
    },

    /**
     * Частично обновляет существующий адрес.
     *
     * @param id Идентификатор адреса.
     * @param payload Полный набор полей адреса для записи.
     */
    patch(id: string, payload: AddressUpsertPayload): Promise<void> {
        return httpClient.send('PATCH', `/profile/addresses/${id}`, payload);
    },

    /**
     * Удаляет адрес из профиля.
     *
     * @param id Идентификатор адреса.
     */
    remove(id: string): Promise<void> {
        return httpClient.send('DELETE', `/profile/addresses/${id}`);
    },
};
