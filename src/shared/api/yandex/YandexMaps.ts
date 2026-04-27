import { env } from '@shared/config/env';

declare namespace ymaps {
    function ready(callback: () => void): void;
    function geocode(request: string | [number, number]): Promise<YandexGeocodeResult>;
    class Map {
        constructor(element: HTMLElement, state: { center: [number, number]; zoom: number; controls: string[] });
        events: { add(eventName: string, callback: () => void): void };
        getCenter(): [number, number];
        setCenter(center: [number, number], zoom: number): void;
        destroy(): void;
    }
}

interface YandexGeocodeResult {
    geoObjects: {
        get(index: number): {
            getAddressLine(): string;
            geometry: { getCoordinates(): [number, number] };
        };
    };
}

interface YandexSuggestResponse {
    results: Array<{ title: { text: string } }>;
}

export interface MapInstance {
    setCenter(center: [number, number], zoom: number): void;
    getCenter(): [number, number];
    destroy(): void;
    onActionEnd(cb: (center: [number, number]) => void): void;
}

export const yandexMaps = {
    ready(): Promise<void> {
        return new Promise((resolve) => ymaps.ready(() => resolve()));
    },

    createMap(container: HTMLElement, center: [number, number], zoom = 16): MapInstance {
        const m = new ymaps.Map(container, { center, zoom, controls: [] });
        return {
            setCenter: (c, z) => m.setCenter(c, z),
            getCenter: () => m.getCenter(),
            destroy: () => m.destroy(),
            onActionEnd: (cb) => m.events.add('actionend', () => cb(m.getCenter())),
        };
    },

    async reverseGeocode(coords: [number, number]): Promise<string | null> {
        try {
            const res = await ymaps.geocode(coords);
            return res.geoObjects.get(0).getAddressLine();
        } catch (e) {
            console.error('reverseGeocode error', e);
            return null;
        }
    },

    async geocode(query: string): Promise<[number, number] | null> {
        try {
            const res = await ymaps.geocode(query);
            return res.geoObjects.get(0).geometry.getCoordinates();
        } catch (e) {
            console.error('geocode error', e);
            return null;
        }
    },

    async fetchSuggestions(query: string): Promise<string[]> {
        if (!env.yandexSuggestKey) return [];
        try {
            const url = `https://suggest-maps.yandex.ru/v1/suggest?text=${encodeURIComponent(query)}&lang=ru_RU&apikey=${env.yandexSuggestKey}`;
            const res = await fetch(url);
            const data = (await res.json()) as YandexSuggestResponse;
            return data.results.map((item) => item.title.text);
        } catch {
            return [];
        }
    },
};
