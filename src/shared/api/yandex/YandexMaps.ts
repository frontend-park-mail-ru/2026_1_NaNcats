import { env } from '@shared/config/env';

/**
 * Пара координат в порядке [широта, долгота], в формате, который принимает
 * и возвращает API Яндекс.Карт.
 */
export type LatLng = [number, number];

declare namespace ymaps {
    function ready(callback: () => void): void;
    function geocode(request: string | LatLng): Promise<YandexGeocodeResult>;
    class Map {
        constructor(
            element: HTMLElement,
            state: { center: LatLng; zoom: number; controls: string[]; behaviors?: string[] },
            options?: { suppressMapOpenBlock?: boolean; yandexMapDisablePoiInteractivity?: boolean },
        );
        events: { add(eventName: string, callback: () => void): void };
        getCenter(): LatLng;
        setCenter(center: LatLng, zoom: number): void;
        container: { fitToViewport(): void };
        destroy(): void;
    }
}

/**
 * Минимальная форма ответа Яндекс-геокодера, которой пользуется обёртка.
 */
interface YandexGeocodeResult {
    /** Коллекция найденных гео-объектов. */
    geoObjects: {
        get(index: number): {
            getAddressLine(): string;
            geometry: { getCoordinates(): LatLng };
        };
    };
}

/**
 * Минимальная форма ответа сервиса автодополнения адресов Яндекса.
 */
interface YandexSuggestResponse {
    /** Список найденных подсказок с заголовками. */
    results: Array<{ title: { text: string } }>;
}

/**
 * Внешний контракт карты, скрывающий тип ymaps.Map от вызывающего кода.
 */
export interface MapInstance {
    /** Перемещает карту в указанный центр и масштаб. */
    setCenter(center: LatLng, zoom: number): void;
    /** Возвращает текущие координаты центра карты. */
    getCenter(): LatLng;
    /** Освобождает ресурсы, занятые картой, и удаляет её из DOM. */
    destroy(): void;
    /**
     * Подписывает коллбэк на завершение пользовательского действия (drag/zoom),
     * вызывая его с новым центром карты.
     */
    onActionEnd(cb: (center: LatLng) => void): void;
    /** Пересчитывает размеры карты после изменения её контейнера. */
    fitToViewport(): void;
}

/**
 * Фасад над глобальным API Яндекс.Карт.
 *
 * Прячет загрузку SDK (через ymaps.ready), типы внешнего пространства имён
 * и нюансы геокодера за узким набором промис-ориентированных методов.
 * Все методы безопасны к ошибкам сети: возвращают null или пустой массив
 * вместо проброса исключения, чтобы UI не падал из-за отказа стороннего
 * сервиса.
 */
export const yandexMaps = {
    /**
     * Дожидается готовности SDK Яндекс.Карт.
     *
     * @returns Промис, который разрешается, как только ymaps готов к использованию.
     */
    ready(): Promise<void> {
        return new Promise((resolve) => ymaps.ready(() => resolve()));
    },

    /**
     * Создаёт карту в переданном контейнере и возвращает её внешний контракт.
     *
     * @param container DOM-элемент, в котором будет нарисована карта.
     * @param center Стартовые координаты центра карты.
     * @param zoom Начальный масштаб карты; по умолчанию 16.
     * @returns Объект {@link MapInstance} для управления картой.
     */
    createMap(container: HTMLElement, center: LatLng, zoom = 16): MapInstance {
        const m = new ymaps.Map(
            container,
            {
                center,
                zoom,
                controls: [],
                behaviors: ['drag', 'multiTouch', 'dblClickZoom', 'rightMouseButtonMagnifier'],
            },
            { suppressMapOpenBlock: true },
        );
        return {
            setCenter: (c, z) => m.setCenter(c, z),
            getCenter: () => m.getCenter(),
            destroy: () => m.destroy(),
            onActionEnd: (cb) => m.events.add('actionend', () => cb(m.getCenter())),
            fitToViewport: () => m.container.fitToViewport(),
        };
    },

    /**
     * Преобразует координаты в текстовый адрес.
     *
     * Возвращает null при ошибке геокодера, чтобы вызывающий код мог показать
     * нейтральный fallback.
     *
     * @param coords Координаты вида [широта, долгота].
     * @returns Строка с адресом или null при сбое.
     */
    async reverseGeocode(coords: LatLng): Promise<string | null> {
        try {
            const res = await ymaps.geocode(coords);
            return res.geoObjects.get(0).getAddressLine();
        } catch (e) {
            console.error('reverseGeocode error', e);
            return null;
        }
    },

    /**
     * Преобразует текстовый запрос в координаты первого совпадения.
     *
     * @param query Поисковый запрос (адрес или название места).
     * @returns Пара [широта, долгота] или null при сбое.
     */
    async geocode(query: string): Promise<LatLng | null> {
        try {
            const res = await ymaps.geocode(query);
            return res.geoObjects.get(0).geometry.getCoordinates();
        } catch (e) {
            console.error('geocode error', e);
            return null;
        }
    },

    /**
     * Возвращает список подсказок адресов для поля автодополнения.
     *
     * Если ключ API не настроен, метод сразу возвращает пустой массив, чтобы
     * не делать заведомо неудачный запрос. Любая ошибка сети тоже превращается
     * в пустой массив.
     *
     * @param query Текущий ввод пользователя.
     * @returns Массив строк-подсказок (может быть пустым).
     */
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
