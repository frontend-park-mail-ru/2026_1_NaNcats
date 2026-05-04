import { httpClient } from '@shared/api/http';
import type {
    BrandsResponse,
    DishesResponse,
    CategoriesResponse,
    ReviewsResponse,
    Dish,
    Restaurant,
    Category,
    Review,
    SearchResult,
    SearchAllResponse,
    SearchAllResult,
    DishSearchHit,
} from '../model/types';

/**
 * REST-клиент для работы с каталогом ресторанов: список брендов, меню,
 * категории, поиск, отзывы.
 */
export const restaurantApi = {
    /**
     * Возвращает страницу списка брендов.
     *
     * @param limit Размер страницы.
     * @param offset Смещение от начала.
     * @returns Список брендов; пустой массив, если бэкенд вернул `null`.
     */
    async listBrands(limit: number, offset: number): Promise<Restaurant[]> {
        const data = await httpClient.getJson<BrandsResponse>('/restaurants/brands', { limit, offset });
        return data.restaurants ?? [];
    },

    /**
     * Возвращает один бренд по идентификатору.
     *
     * @param id Идентификатор бренда.
     * @returns Объект бренда.
     */
    getBrand(id: string | number): Promise<Restaurant> {
        return httpClient.getJson<Restaurant>(`/restaurants/brands/${id}`);
    },

    /**
     * Возвращает страницу меню бренда.
     *
     * @param brandId Идентификатор бренда.
     * @param limit Размер страницы.
     * @param offset Смещение от начала.
     * @returns Список блюд; пустой массив, если бэкенд вернул `null`.
     */
    async listDishes(brandId: string | number, limit: number, offset: number): Promise<Dish[]> {
        const data = await httpClient.getJson<DishesResponse>(`/restaurants/brands/${brandId}/dishes`, {
            limit,
            offset,
        });
        return data.dishes ?? [];
    },

    /**
     * Возвращает список категорий кухни.
     *
     * При ошибке сети или отсутствии эндпоинта возвращает фиксированный
     * список {@link FALLBACK_CATEGORIES}, чтобы главная страница оставалась
     * работоспособной.
     *
     * @returns Список категорий.
     */
    async listCategories(): Promise<Category[]> {
        try {
            const data = await httpClient.getJson<CategoriesResponse>('/restaurants/categories');
            return data.categories ?? [];
        } catch {
            return FALLBACK_CATEGORIES;
        }
    },

    /**
     * Возвращает страницу списка брендов в указанной категории.
     *
     * @param categorySlug Slug категории.
     * @param limit Размер страницы.
     * @param offset Смещение от начала.
     * @returns Список брендов; пустой массив, если бэкенд вернул `null`.
     */
    async listBrandsByCategory(categorySlug: string, limit: number, offset: number): Promise<Restaurant[]> {
        const data = await httpClient.getJson<BrandsResponse>(
            `/restaurants/categories/${encodeURIComponent(categorySlug)}/brands`,
            { limit, offset },
        );
        return data.restaurants ?? [];
    },

    /**
     * Поиск только по брендам.
     *
     * @param query Поисковый запрос.
     * @param limit Максимальное количество результатов (по умолчанию 20).
     * @returns Найденные бренды.
     */
    async search(query: string, limit = 20): Promise<Restaurant[]> {
        const data = await httpClient.getJson<BrandsResponse>('/restaurants/search', { q: query, limit });
        return data.restaurants ?? [];
    },

    /**
     * Глобальный поиск: одновременно по брендам и блюдам.
     *
     * @param query Поисковый запрос.
     * @param limit Максимальное количество результатов в каждой группе.
     * @returns Нормализованный результат с двумя гарантированно присутствующими списками.
     */
    async searchAll(query: string, limit = 10): Promise<SearchAllResult> {
        const data = await httpClient.getJson<SearchAllResponse>('/restaurants/search', { q: query, limit });
        return {
            restaurants: data.restaurants ?? [],
            dishes: data.dishes ?? [],
        };
    },

    /**
     * Поиск по блюдам в меню одного ресторана.
     *
     * @param restaurantId Идентификатор бренда.
     * @param query Поисковый запрос.
     * @param limit Максимальное количество результатов.
     * @returns Найденные блюда.
     */
    async searchDishesInRestaurant(restaurantId: string | number, query: string, limit = 20): Promise<DishSearchHit[]> {
        const data = await httpClient.getJson<{ dishes?: DishSearchHit[] }>(
            `/restaurants/brands/${restaurantId}/dishes`,
            { q: query, limit },
        );
        return data.dishes ?? [];
    },

    /**
     * Возвращает список отзывов на ресторан.
     *
     * @param restaurantId Идентификатор ресторана.
     * @returns Список отзывов.
     */
    async getReviews(restaurantId: string | number): Promise<Review[]> {
        const data = await httpClient.getJson<ReviewsResponse>(`/reviews/restaurants/${restaurantId}`);
        return data.reviews ?? [];
    },

    /**
     * Создаёт новый отзыв на ресторан.
     *
     * @param restaurantId Идентификатор ресторана.
     * @param payload Имя автора, оценка и текст отзыва.
     * @returns Созданный отзыв.
     */
    async createReview(
        restaurantId: string | number,
        payload: { author_name: string; rating: number; comment: string },
    ): Promise<Review> {
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
