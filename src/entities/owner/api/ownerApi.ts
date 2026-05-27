/**
 * REST-клиент для owner-эндпоинтов: управление брендами, блюдами и аналитика.
 * Все эндпоинты требуют роль owner; при 403 выбрасывается ApiError.
 */

import { httpClient, csrfStore } from '@shared/api/http';
import type { OwnerBrand, OwnerDish, OwnerStats } from '../model/types';

/** Генерирует уникальный ключ идемпотентности. */
function genIdemKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Отправляет FormData с методом method; добавляет CSRF и Idempotency-Key. */
async function formRequest<T>(method: string, path: string, fd: FormData): Promise<T> {
    const headers: Record<string, string> = {
        'Idempotency-Key': genIdemKey(),
    };
    const token = csrfStore.getToken();
    if (token) headers['X-CSRF-Token'] = token;

    const res = await fetch(`/api${path}`, {
        method,
        headers,
        body: fd,
        credentials: 'include',
    });
    if (!res.ok) {
        let msg = `${method} ${path} failed`;
        try {
            const body = (await res.json()) as { message?: string };
            if (body?.message) msg = body.message;
        } catch {
            /* ignore */
        }
        throw new Error(msg);
    }
    // 204 No Content
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
}

export const ownerApi = {
    /**
     * Создаёт новый бренд ресторана.
     * POST /api/owner/restaurants
     */
    async createBrand(payload: { name: string; description: string; logo?: File }): Promise<OwnerBrand> {
        const fd = new FormData();
        fd.append('name', payload.name);
        fd.append('description', payload.description);
        if (payload.logo) fd.append('logo', payload.logo);
        try {
            return await formRequest<OwnerBrand>('POST', '/owner/restaurants', fd);
        } catch (e) {
            if (e instanceof Error && (e.message.includes('duplicate key') || e.message.includes('23505'))) {
                throw new Error('Ресторан с таким названием уже существует');
            }
            throw e;
        }
    },

    /**
     * Обновляет название/описание бренда.
     * PATCH /api/owner/restaurants/{id}
     */
    async updateBrand(id: string, payload: { name?: string; description?: string }): Promise<OwnerBrand> {
        try {
            return await httpClient.patchJson<OwnerBrand>(`/owner/restaurants/${id}`, payload);
        } catch (e) {
            if (e instanceof Error && (e.message.includes('duplicate key') || e.message.includes('23505'))) {
                throw new Error('Ресторан с таким названием уже существует');
            }
            throw e;
        }
    },

    /**
     * Обновляет только логотип бренда.
     * PATCH /api/owner/restaurants/{id}/logo
     */
    async updateBrandLogo(id: string, logo: File): Promise<void> {
        const fd = new FormData();
        fd.append('logo', logo);
        await formRequest<void>('PATCH', `/owner/restaurants/${id}/logo`, fd);
    },

    /**
     * Удаляет бренд: сначала удаляет все блюда (FK-constraint), потом сам бренд.
     * DELETE /api/owner/dishes/{dishId} N раз = DELETE /api/owner/restaurants/{id}
     */
    async deleteBrand(id: string): Promise<void> {
        // Получаем список блюд и удаляем каждое — бэк не каскадит FK
        try {
            const dishes = await ownerApi.getDishes(id);
            await Promise.all(dishes.map((d) => ownerApi.deleteDish(d.id)));
        } catch {
            // Если не удалось получить блюда — пробуем удалить бренд напрямую
        }
        await httpClient.send('DELETE', `/owner/restaurants/${id}`);
    },

    /**
     * Получает список блюд бренда (использует публичный эндпоинт).
     * GET /api/restaurants/brands/{id}/dishes
     */
    async getDishes(brandId: string): Promise<OwnerDish[]> {
        const data = await httpClient.getJson<{ dishes?: OwnerDish[] }>(`/restaurants/brands/${brandId}/dishes`, {
            limit: 100,
            offset: 0,
        });
        return (data.dishes ?? []).map((d) => ({ ...d, id: String(d.id), price: Number(d.price) }));
    },

    /**
     * Создаёт блюдо в меню бренда.
     * POST /api/owner/restaurants/{brandId}/dishes
     */
    async createDish(
        brandId: string,
        payload: { name: string; description: string; price: number; image?: File },
    ): Promise<OwnerDish> {
        const fd = new FormData();
        fd.append('name', payload.name);
        fd.append('description', payload.description);
        fd.append('price', String(payload.price)); // уже в raw единицах
        if (payload.image) fd.append('image', payload.image);
        return formRequest<OwnerDish>('POST', `/owner/restaurants/${brandId}/dishes`, fd);
    },

    /**
     * Обновляет блюдо.
     * PUT /api/owner/dishes/{id}
     */
    async updateDish(
        dishId: string,
        payload: { name?: string; description?: string; price?: number; image?: File },
    ): Promise<OwnerDish> {
        const fd = new FormData();
        if (payload.name !== undefined) fd.append('name', payload.name);
        if (payload.description !== undefined) fd.append('description', payload.description);
        if (payload.price !== undefined) fd.append('price', String(payload.price));
        if (payload.image) fd.append('image', payload.image);
        return formRequest<OwnerDish>('PUT', `/owner/dishes/${dishId}`, fd);
    },

    /**
     * Удаляет блюдо.
     * DELETE /api/owner/dishes/{id}
     */
    async deleteDish(dishId: string): Promise<void> {
        await httpClient.send('DELETE', `/owner/dishes/${dishId}`);
    },

    /**
     * Получает статистику владельца за период.
     * GET /api/owner/analytics?restaurant_id=&start_time=&end_time=
     */
    async getAnalytics(restaurantId: string, startTime: string, endTime: string): Promise<OwnerStats> {
        return httpClient.getJson<OwnerStats>('/owner/analytics', {
            restaurant_id: restaurantId,
            start_time: startTime,
            end_time: endTime,
        });
    },

    /**
     * Возвращает список ресторанов текущего владельца.
     * GET /api/owner/restaurants
     */
    async getMyBrands(): Promise<OwnerBrand[]> {
        const data = await httpClient.getJson<{ restaurants?: OwnerBrand[] }>('/owner/restaurants');
        return (data.restaurants ?? []).map((b) => ({ ...b, id: String(b.id) }));
    },

    /**
     * Проверяет, является ли текущий пользователь владельцем.
     * Возвращает true, если ответ не 401/403.
     */
    async checkOwnerAccess(): Promise<boolean> {
        try {
            const res = await httpClient.get(
                '/owner/analytics?restaurant_id=0&start_time=2020-01-01&end_time=2020-01-01',
            );
            return res.status !== 403 && res.status !== 401;
        } catch {
            return false;
        }
    },
};
