export interface Restaurant {
    id: number | string;
    name: string;
    logo_url: string;
    description?: string;
}

export interface Dish {
    id: number;
    name: string;
    price: number;
    image_url: string;
    description?: string;
}

export interface Category {
    id: string;
    name: string;
    emoji: string;
}

export interface Review {
    id: number;
    restaurant_id: number;
    author_name: string;
    rating: number;
    comment: string;
    created_at: string;
}

export interface BrandsResponse {
    restaurants?: Restaurant[];
}

export interface DishesResponse {
    dishes?: Dish[];
}

export interface CategoriesResponse {
    categories?: Category[];
}

export interface ReviewsResponse {
    reviews?: Review[];
    total?: number;
}

export interface SearchResult {
    restaurants?: Restaurant[];
}

export interface DishSearchHit {
    id: number | string;
    name: string;
    description?: string;
    image_url: string;
    price: number;
    restaurant_brand_id: string | number;
}

export interface SearchAllResponse {
    restaurants?: Restaurant[];
    dishes?: DishSearchHit[];
}

export interface SearchAllResult {
    restaurants: Restaurant[];
    dishes: DishSearchHit[];
}
