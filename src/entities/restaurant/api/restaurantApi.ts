import { httpClient } from '@shared/api/http';
import type { BrandsResponse, DishesResponse, Dish, Restaurant } from '../model/types';

export const restaurantApi = {
    async listBrands(limit: number, offset: number): Promise<Restaurant[]> {
        const data = await httpClient.getJson<BrandsResponse>('/restaurants/brands', { limit, offset });
        return data.restaurants ?? [];
    },

    getBrand(id: string | number): Promise<Restaurant> {
        return httpClient.getJson<Restaurant>(`/restaurants/brands/${id}`);
    },

    async listDishes(brandId: string | number, limit: number, offset: number): Promise<Dish[]> {
        const data = await httpClient.getJson<DishesResponse>(
            `/restaurants/brands/${brandId}/dishes`,
            { limit, offset },
        );
        return data.dishes ?? [];
    },
};
