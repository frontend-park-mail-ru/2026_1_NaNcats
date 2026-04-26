export interface Restaurant {
    id: number | string;
    name: string;
    logo_url: string;
}

export interface Dish {
    id: number;
    name: string;
    price: number;
    image_url: string;
    description?: string;
}

export interface BrandsResponse {
    restaurants?: Restaurant[];
}

export interface DishesResponse {
    dishes?: Dish[];
}
