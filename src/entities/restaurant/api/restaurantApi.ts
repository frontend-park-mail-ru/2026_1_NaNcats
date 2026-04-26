import { httpClient, ApiError } from '@shared/api/http';
import type { BrandsResponse, DishesResponse, Dish, Restaurant } from '../model/types';

export const restaurantApi = {
    async listBrands(limit: number, offset: number): Promise<Restaurant[]> {
        const res = await httpClient.get(`/restaurants/brands?limit=${limit}&offset=${offset}`);
        if (!res.ok) {
            throw new ApiError('listBrands failed', { status: res.status, url: '/restaurants/brands' });
        }
        const data = (await res.json()) as BrandsResponse;
        return data.restaurants ?? [];
    },

    async getBrand(id: string | number): Promise<Restaurant> {
        const url = `/restaurants/brands/${id}`;
        const res = await httpClient.get(url);
        if (!res.ok) {
            throw new ApiError('getBrand failed', { status: res.status, url });
        }
        return (await res.json()) as Restaurant;
    },

    async listDishes(brandId: string | number, limit: number, offset: number): Promise<Dish[]> {
        const url = `/restaurants/brands/${brandId}/dishes?limit=${limit}&offset=${offset}`;
        const res = await httpClient.get(url);
        if (!res.ok) {
            throw new ApiError('listDishes failed', { status: res.status, url });
        }
        const data = (await res.json()) as DishesResponse;
        return data.dishes ?? [];
    },
};
