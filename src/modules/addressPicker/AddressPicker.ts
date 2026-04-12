import './addressPicker.scss';
import { Component } from '../../core/Component';
import { addressPickerTemplate } from './addressPicker.tmpl';

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

declare var process: { env: { YANDEX_SUGGEST_KEY: string; }; };

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

declare var process: { env: { YANDEX_SUGGEST_KEY: string; }; };

interface AddressPickerData extends Record<string, unknown> {
    savedAddresses?: string[];
    isAuth?: boolean;
    skipDetails?: boolean;
    currentAddress?: string;
}

/**
 * Компонент выбора адреса доставки с использованием Яндекс.Карт.
 * Позволяет искать адрес через саджесты и выбирать точку на карте.
 * 
 * @class AddressPicker
 * @extends Component
 */
export class AddressPicker extends Component {
    /** @type {boolean} Флаг авторизации пользователя */
    private isAuth: boolean = true;
    
    /** @type {string} API-ключ для Яндекс Саджестов */
    private suggestKey: string;
    
    /** @type {boolean} Флаг пропуска модалки с деталями адреса (квартира, подъезд) */
    private skipDetails: boolean = false; 
    
    /** @type {string[]} Список сохраненных адресов пользователя */
    private savedAddresses: string[];
    
    /** @type {ymaps|null} Экземпляр Яндекс.Карты */
    private map: ymaps.Map | null;
    
    /** @type {[number, number]} Текущие выбранные координаты [широта, долгота] */
    private selectedCoords: [number, number];
    
    /** @type {ReturnType<typeof setTimeout>|null} Таймер для дебаунса ввода */
    private debounceTimer: ReturnType<typeof setTimeout> | null;
    
    /** @type {Function} Коллбэк, вызываемый при успешном выборе адреса */
    private onSelectCallback: (address: string, coords: [number, number]) => void;

    /**
     * Создает экземпляр компонента AddressPicker.
     * @param {Function} [onSelect] - Коллбэк при выборе адреса.
     */
    constructor(onSelect?: (address: string, coords: [number, number]) => void) {
        super(addressPickerTemplate);
        this.suggestKey = process.env.YANDEX_SUGGEST_KEY;
        this.savedAddresses = [];
        this.map = null;
        this.selectedCoords = [55.75, 37.61];
        this.debounceTimer = null;
        this.onSelectCallback = onSelect || (() => {});
    }

    /**
     * Получает подсказки адресов от API Яндекса.
     * @param {string} query - Строка запроса.
     * @returns {Promise<string[]>} Массив строк с предложенными адресами.
     */
    async fetchYandexSuggestions(query: string): Promise<string[]> {
        try {
            const response = await fetch(
                `https://suggest-maps.yandex.ru/v1/suggest?text=${encodeURIComponent(query)}&lang=ru_RU&apikey=${this.suggestKey}`
            );
            const data: YandexSuggestResponse = await response.json();
            return data.results.map((item) => item.title.text);
        } catch (e) {
            return [];
        }
    }

    /**
     * Открывает модальное окно с Яндекс Картой.
     * Инициализирует карту при первом открытии.
     * @returns {void}
     */
    public openMapModal(): void {
        const modal = this.element?.querySelector('.js-map-modal');
        if (modal) {
            modal.classList.add('modal-overlay_active');
            ymaps.ready(() => {
                if (this.map) return;
                const mapContainer = this.element?.querySelector<HTMLElement>('.js-yandex-map');
                if (!mapContainer) {
                    console.error('Контейнер для карты .js-yandex-map не найден');
                    return;
                }
                const mapInstance = new ymaps.Map(mapContainer, {
                    center: this.selectedCoords,
                    zoom: 16,
                    controls: []
                });

                this.map = mapInstance;
                mapInstance.events.add('actionend', () => {
                    const center = mapInstance.getCenter();
                    this.selectedCoords = center;
                    this.reverseGeocode(center);
                });
            });
        }
    }

    /**
     * Выполняет обратное геокодирование (по координатам получает адрес).
     * @private
     * @param {[number, number]} coords - Координаты точки.
     * @returns {Promise<void>}
     */
    private async reverseGeocode(coords: [number, number]): Promise<void> {
        try {
            const res = await ymaps.geocode(coords);
            const address = res.geoObjects.get(0).getAddressLine();
            const modalInput = this.element?.querySelector('.js-modal-address-input') as HTMLInputElement;
            if (modalInput) modalInput.value = address;
        } catch (e) {
            console.error("Geocode error:", e);
        }
    }

    /**
     * Отрисовывает компонент с переданными данными.
     * @override
     * @param {HTMLElement} container - DOM-контейнер.
     * @param {Object} data - Данные для шаблона.
     * @returns {Promise<void>}
     */
    async mount(container: HTMLElement, data: AddressPickerData): Promise<void> {
        if (this.map) {
            this.map.destroy();
            this.map = null;
        }

        this.savedAddresses = data?.savedAddresses || [];
        this.isAuth = data?.isAuth !== undefined ? data.isAuth : true;
        this.skipDetails = data?.skipDetails || false;
        super.mount(container, data);
    }

    /**
     * Метод жизненного цикла: навешивает обработчики событий после рендера.
     * @override
     * @returns {void}
     */
    afterRender(): void {
        const addressInput = this.element?.querySelector<HTMLInputElement>('.js-address-input');
        const addressDropdown = this.element?.querySelector<HTMLElement>('.js-address-dropdown');
        const openMapBtn = this.element?.querySelector<HTMLElement>('.js-open-map-btn');

        if (addressInput && addressDropdown) {
            const handleInput = (e: Event) => {
                if (!this.isAuth) {
                    addressInput.blur();
                    window.router.go('/login');
                    return;
                }
                const target = e.target as HTMLInputElement;
                const query = target.value.trim();
                addressDropdown.classList.add('address-dropdown_active');

                if (!query) {
                    if (openMapBtn) openMapBtn.style.display = 'none';
                    this.renderSuggestions(this.savedAddresses, 'js-address-suggestions', false);
                } else {
                    if (openMapBtn) openMapBtn.style.display = 'block';
                    if (this.debounceTimer) clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(async () => {
                        const results = await this.fetchYandexSuggestions(query);
                        this.renderSuggestions(results, 'js-address-suggestions', true);
                    }, 400);
                }
            };
            addressInput.addEventListener('focus', handleInput);
            addressInput.addEventListener('input', handleInput);
        }

        if (openMapBtn) {
            openMapBtn.onclick = () => this.openMapModal();
        }

        this.element?.querySelector('.js-close-map-modal')?.addEventListener('click', () => {
            this.element?.querySelector('.js-map-modal')?.classList.remove('modal-overlay_active');
        });

        const confirmBtn = this.element?.querySelector('.js-confirm-address-btn') as HTMLElement | null;
        const modalInput = this.element?.querySelector('.js-modal-address-input') as HTMLInputElement | null;
        if (modalInput) {
            modalInput.addEventListener('input', (e: Event) => {
                const target = e.target as HTMLInputElement;
                const query = target.value.trim();

                if (query.length > 2) {
                    if (this.debounceTimer) clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(async () => {
                        const results = await this.fetchYandexSuggestions(query);
                        this.renderModalSuggestions(results);
                    }, 400);
                }
            });
        }
        
        if (confirmBtn && modalInput) {
            confirmBtn.onclick = () => {
                const addr = modalInput.value;
                this.element?.querySelector('.js-map-modal')?.classList.remove('modal-overlay_active');
                
                if (this.skipDetails) {
                    this.finalizeAddress(addr, this.selectedCoords);
                } else {
                    this.openDetailsModal(addr, this.selectedCoords);
                }
            };
        }

        const detailsForm = this.element?.querySelector('.js-details-form') as HTMLFormElement | null;
        if (detailsForm) {
            detailsForm.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(detailsForm);
                const addressText = (this.element?.querySelector('.js-display-address') as HTMLInputElement).value;
                
                const payload = {
                    address_text: addressText,
                    lat: this.selectedCoords[0],
                    lon: this.selectedCoords[1],
                    apartment: formData.get('apartment'),
                    entrance: formData.get('entrance'),
                    floor: formData.get('floor'),
                    door_code: formData.get('door_code'),
                    courier_comment: formData.get('courier_comment'),
                    label: "Дом"
                };

                if (this.isAuth) {
                    try {
                        await fetch('/api/profile/addresses', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                            credentials: 'include'
                        });
                    } catch (err) { console.error(err); }
                }

                this.element?.querySelector('.js-details-modal')?.classList.remove('modal-overlay_active');
                this.finalizeAddress(addressText, this.selectedCoords);
            };
        }

        const changeBtn = this.element?.querySelector('.js-change-address-btn') as HTMLElement | null;
        if (changeBtn) {
            changeBtn.onclick = () => {
                this.element?.querySelector('.js-details-modal')?.classList.remove('modal-overlay_active');
                this.openMapModal();
            };
        }

        this.element?.querySelector('.js-close-details-modal')?.addEventListener('click', () => {
            this.element?.querySelector('.js-details-modal')?.classList.remove('modal-overlay_active');
        });

        document.addEventListener('click', (e) => {
            if (!this.element?.contains(e.target as Node)) {
                addressDropdown?.classList.remove('address-dropdown_active');
            }
        });
    }

    /**
     * Сохраняет выбранный адрес в локальное хранилище и вызывает коллбэк.
     * @private
     * @param {string} address - Строка адреса.
     * @param {[number, number]} coords - Координаты адреса.
     * @returns {void}
     */
    private finalizeAddress(address: string, coords: [number, number]): void {
        const input = this.element?.querySelector('.js-address-input') as HTMLInputElement;
        if (input) input.value = address;
        localStorage.setItem('delivery_address', address);
        localStorage.setItem('delivery_coords', JSON.stringify(coords));
        this.onSelectCallback(address, coords);
    }

    /**
     * Открывает модальное окно для ввода деталей адреса (квартира, этаж).
     * @private
     * @param {string} address - Базовый адрес.
     * @param {[number, number]} coords - Координаты.
     * @returns {void}
     */
    private openDetailsModal(address: string, coords: [number, number]): void {
        const modal = this.element?.querySelector<HTMLElement>('.js-details-modal');
        const displayInput = this.element?.querySelector<HTMLInputElement>('.js-display-address');
        const form = this.element?.querySelector<HTMLFormElement>('.js-details-form');

        if (!modal || !displayInput || !form) {
            console.error('Элементы модалки деталей адреса не найдены в DOM');
            return;
        }

        form.reset();
        displayInput.value = address;
        this.selectedCoords = coords;
        modal.classList.add('modal-overlay_active');
    }

    /**
     * Отрисовывает список саджестов под строкой поиска.
     * @private
     * @param {string[]} list - Список адресов для отображения.
     * @param {string} containerClass - Класс контейнера саджестов.
     * @param {boolean} isYandex - Указывает, нужно ли геокодировать адрес при клике.
     * @returns {void}
     */
    private renderSuggestions(list: string[], containerClass: string, isYandex: boolean): void {
        const container = this.element?.querySelector<HTMLElement>(`.${containerClass}`);
        if (!container) return;

        container.innerHTML = list.map(addr => 
            `<div class="address-dropdown__item" data-addr="${addr}">${addr}</div>`
        ).join('');

        container.onclick = async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const item = target.closest<HTMLElement>('.address-dropdown__item');
            
            if (item) {
                const addr = item.getAttribute('data-addr') || '';
                if (isYandex) {
                    const res = await ymaps.geocode(addr);
                    const coords = res.geoObjects.get(0).geometry.getCoordinates();
                    this.openDetailsModal(addr, coords);
                } else {
                    this.finalizeAddress(addr, this.selectedCoords);
                }
            }
        };
    }

    /**
     * Отрисовывает саджесты внутри модалки с картой.
     * @private
     * @param {string[]} list - Список адресов.
     * @returns {void}
     */
    private renderModalSuggestions(list: string[]): void {
        const container = this.element?.querySelector<HTMLElement>('.js-modal-suggestions');
        if (!container) return;

        if (list.length > 0) {
            container.classList.add('address-modal__suggestions_active');
            container.innerHTML = list.map(addr => 
                `<div class="modal-suggestion-item">${addr}</div>`
            ).join('');
            
            container.onclick = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                const item = target.closest<HTMLElement>('.modal-suggestion-item');
                
                if (item) {
                    const addr = item.innerText;
                    const modalInput = this.element?.querySelector<HTMLInputElement>('.js-modal-address-input');
                    if (modalInput) modalInput.value = addr;
                    
                    container.classList.remove('address-modal__suggestions_active');
                    
                    ymaps.geocode(addr).then((res: any) => {
                        const coords = res.geoObjects.get(0).geometry.getCoordinates();
                        this.map?.setCenter(coords, 16);
                        this.selectedCoords = coords;
                    });
                }
            };
        } else {
            container.classList.remove('address-modal__suggestions_active');
        }
    }
}