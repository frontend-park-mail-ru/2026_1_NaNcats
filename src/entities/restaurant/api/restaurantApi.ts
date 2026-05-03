import { httpClient } from '@shared/api/http';
import type {
    BrandsResponse, DishesResponse, CategoriesResponse, ReviewsResponse,
    Dish, Restaurant, Category, Review, SearchResult,
    SearchAllResponse, SearchAllResult, DishSearchHit
} from '../model/types';

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

    async listCategories(): Promise<Category[]> {
        try {
            const data = await httpClient.getJson<CategoriesResponse>('/restaurants/categories');
            return data.categories ?? [];
        } catch {
            return FALLBACK_CATEGORIES;
        }
    },

    async listBrandsByCategory(categorySlug: string, limit: number, offset: number): Promise<Restaurant[]> {
        const data = await httpClient.getJson<BrandsResponse>(
            `/restaurants/categories/${encodeURIComponent(categorySlug)}/brands`,
            { limit, offset },
        );
        return data.restaurants ?? [];
    },

    async search(query: string, limit = 20): Promise<Restaurant[]> {
        const data = await httpClient.getJson<BrandsResponse>(
            '/restaurants/search',
            { q: query, limit },
        );
        return data.restaurants ?? [];
    },

    async searchAll(query: string, limit = 10): Promise<SearchAllResult> {
        const data = await httpClient.getJson<SearchAllResponse>(
            '/restaurants/search',
            { q: query, limit },
        );
        return {
            restaurants: data.restaurants ?? [],
            dishes: data.dishes ?? [],
        };
    },

    async searchDishesInRestaurant(restaurantId: string | number, query: string, limit = 20): Promise<DishSearchHit[]> {
        const data = await httpClient.getJson<{ dishes?: DishSearchHit[] }>(
            `/restaurants/brands/${restaurantId}/dishes`,
            { q: query, limit },
        );
        return data.dishes ?? [];
    },

    async getReviews(restaurantId: string | number): Promise<Review[]> {
        const data = await httpClient.getJson<ReviewsResponse>(`/reviews/restaurants/${restaurantId}`);
        return data.reviews ?? [];
    },

    async createReview(restaurantId: string | number, payload: { author_name: string; rating: number; comment: string }): Promise<Review> {
        return httpClient.postJson<Review>(`/reviews/restaurants/${restaurantId}`, payload);
    },
};

const FALLBACK_CATEGORIES: Category[] = [
    { id: 'popular', name: 'Популярное', emoji: '🔥' },
    { id: 'pizza', name: 'Пицца', emoji: '🍕' },
    { id: 'sushi', name: 'Суши', emoji: '🍣' },
    { id: 'burgers', name: 'Бургеры', emoji: '🍔' },
    { id: 'desserts', name: 'Десерты', emoji: '🍰' },
    { id: 'breakfast', name: 'Завтраки', emoji: '🍳' },
    { id: 'health', name: 'Здоровье', emoji: '🥦' },
    { id: 'coffee', name: 'Кофе', emoji: '☕' },
    { id: 'steaks', name: 'Стейки', emoji: '🥩' },
    { id: 'pasta', name: 'Паста', emoji: '🍝' },
    { id: 'asian', name: 'Азиатская кухня', emoji: '🥢' },
    { id: 'seafood', name: 'Морепродукты', emoji: '🦞' },
    { id: 'fastfood', name: 'Фастфуд', emoji: '🍟' },
    { id: 'russian', name: 'Русская кухня', emoji: '🇷🇺' },
    { id: 'chinese', name: 'Китайская кухня', emoji: '🥠' },
    { id: 'georgian', name: 'Грузинская кухня', emoji: '🥙' },
    { id: 'home', name: 'Домашняя кухня', emoji: '🏠' },
    { id: 'bread', name: 'Хлеб и выпечка', emoji: '🥖' },
    { id: 'salads', name: 'Салаты', emoji: '🥗' },
    { id: 'soups', name: 'Супы', emoji: '🥣' },
];
