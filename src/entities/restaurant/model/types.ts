/**
 * Краткое представление ресторана-бренда (агрегата филиалов).
 */
export interface Restaurant {
    /** Идентификатор бренда. */
    id: number | string;
    /** Название бренда. */
    name: string;
    /** Ссылка на логотип. */
    logo_url: string;
    /** Описание бренда. */
    description?: string;
}

/**
 * Блюдо из меню ресторана.
 */
export interface Dish {
    /** Идентификатор блюда. */
    id: number;
    /** Название блюда. */
    name: string;
    /** Цена за единицу в микрорублях. */
    price: number;
    /** Ссылка на изображение блюда. */
    image_url: string;
    /** Описание блюда. */
    description?: string;
}

/**
 * Категория кухни (используется для фильтрации главной страницы).
 */
export interface Category {
    /** Slug-идентификатор категории. */
    id: string;
    /** Отображаемое название. */
    name: string;
    /** Эмодзи-иконка. */
    emoji: string;
}

/**
 * Отзыв пользователя на ресторан.
 */
export interface Review {
    /** Идентификатор отзыва. */
    id: number;
    /** Идентификатор ресторана. */
    restaurant_id: number;
    /** Имя автора. */
    author_name: string;
    /** Оценка от 1 до 5. */
    rating: number;
    /** Текст отзыва. */
    comment: string;
    /** ISO-метка времени создания. */
    created_at: string;
}

/**
 * Ответ эндпоинта списка брендов.
 */
export interface BrandsResponse {
    /** Список брендов; может отсутствовать, если ничего не найдено. */
    restaurants?: Restaurant[];
}

/**
 * Ответ эндпоинта меню ресторана.
 */
export interface DishesResponse {
    /** Список блюд; может отсутствовать. */
    dishes?: Dish[];
}

/**
 * Ответ эндпоинта списка категорий.
 */
export interface CategoriesResponse {
    /** Список категорий; может отсутствовать. */
    categories?: Category[];
}

/**
 * Ответ эндпоинта списка отзывов.
 */
export interface ReviewsResponse {
    /** Список отзывов; может отсутствовать. */
    reviews?: Review[];
    /** Общее количество отзывов на ресторан. */
    total?: number;
}

/**
 * Ответ эндпоинта поиска по ресторанам (только бренды).
 */
export interface SearchResult {
    /** Найденные бренды. */
    restaurants?: Restaurant[];
}

/**
 * Найденное блюдо в результатах глобального поиска. Включает идентификатор
 * бренда, чтобы из карточки блюда можно было перейти на страницу ресторана.
 */
export interface DishSearchHit {
    /** Идентификатор блюда. */
    id: number | string;
    /** Название блюда. */
    name: string;
    /** Описание блюда. */
    description?: string;
    /** Ссылка на изображение блюда. */
    image_url: string;
    /** Цена за единицу в микрорублях. */
    price: number;
    /** Идентификатор бренда, в меню которого находится блюдо. */
    restaurant_brand_id: string | number;
}

/**
 * Сырой ответ эндпоинта глобального поиска (бренды и блюда вместе).
 */
export interface SearchAllResponse {
    /** Найденные бренды. */
    restaurants?: Restaurant[];
    /** Найденные блюда. */
    dishes?: DishSearchHit[];
}

/**
 * Нормализованный результат глобального поиска: оба списка гарантированно
 * присутствуют, чтобы вызывающий код мог не проверять их на `undefined`.
 */
export interface SearchAllResult {
    /** Найденные бренды. */
    restaurants: Restaurant[];
    /** Найденные блюда. */
    dishes: DishSearchHit[];
}
