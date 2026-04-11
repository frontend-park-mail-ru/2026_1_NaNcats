import { Component } from '../../core/Component';
import { addressPickerTemplate } from './addressPicker.tmpl';
import './addressPicker.css';

declare var ymaps: any;
declare var process: { env: { YANDEX_SUGGEST_KEY: string; }; };

export class AddressPicker extends Component {
    private isAuth: boolean = true;
    private suggestKey: string;
    private savedAddresses: string[];
    private map: any | null;
    private selectedCoords: [number, number];
    private debounceTimer: ReturnType<typeof setTimeout> | null;
    private onSelectCallback: (address: string, coords: [number, number]) => void;

    constructor(onSelect?: (address: string, coords: [number, number]) => void) {
        super(addressPickerTemplate);
        this.suggestKey = process.env.YANDEX_SUGGEST_KEY;
        this.savedAddresses = [];
        this.map = null;
        this.selectedCoords = [55.75, 37.61];
        this.debounceTimer = null;
        this.onSelectCallback = onSelect || (() => {});
    }

    async fetchYandexSuggestions(query: string): Promise<string[]> {
        try {
            const response = await fetch(
                `https://suggest-maps.yandex.ru/v1/suggest?text=${encodeURIComponent(query)}&lang=ru_RU&apikey=${this.suggestKey}`
            );
            const data = await response.json();
            return data.results.map((item: any) => item.title.text);
        } catch (e) {
            return [];
        }
    }

    public openMapModal(): void {
        const modal = this.element?.querySelector('.js-map-modal');
        if (modal) {
            modal.classList.add('active');
            ymaps.ready(() => {
                if (this.map) return;
                const mapContainer = this.element?.querySelector('.js-yandex-map') as HTMLElement;
                this.map = new ymaps.Map(mapContainer, {
                    center: this.selectedCoords,
                    zoom: 16,
                    controls: []
                });

                this.map.events.add('actionend', () => {
                    const center = this.map.getCenter();
                    this.selectedCoords = center;
                    this.reverseGeocode(center);
                });
            });
        }
    }

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

    private selectAddress(address: string): void {
        const input = this.element?.querySelector('.js-address-input') as HTMLInputElement;
        if (input) input.value = address;   
        
        const dropdown = this.element?.querySelector('.js-address-dropdown');
        if (dropdown) dropdown.classList.remove('active');

        this.onSelectCallback(address, this.selectedCoords);
    }

    async mount(container: HTMLElement, data: any) {
        this.savedAddresses = data?.savedAddresses || [];
        this.isAuth = data?.isAuth !== undefined ? data.isAuth : true;
        super.mount(container, data);
    }

    afterRender(): void {
        // 1. Ищем основные элементы
        const addressInput = this.element?.querySelector('.js-address-input') as HTMLInputElement | null;
        const addressDropdown = this.element?.querySelector('.js-address-dropdown') as HTMLElement | null;
        const openMapBtn = this.element?.querySelector('.js-open-map-btn') as HTMLElement | null;

        // 2. Логика для главного инпута (будет работать только там, где он есть — например, в хедере)
        if (addressInput && addressDropdown) {
            const handleInput = (e: Event) => {
                if (!this.isAuth) {
                    addressInput.blur();
                    window.router.go('/login');
                    return;
                }

                const target = e.target as HTMLInputElement;
                const query = target.value.trim();
                addressDropdown.classList.add('active');

                if (!query) {
                    if (openMapBtn) openMapBtn.style.display = 'none';
                    if (this.debounceTimer) clearTimeout(this.debounceTimer);
                    this.renderSuggestions(this.savedAddresses, 'js-address-suggestions', (addr) => this.selectAddress(addr));
                } else {
                    if (openMapBtn) openMapBtn.style.display = 'block';
                    if (e.type === 'input') {
                        if (this.debounceTimer) clearTimeout(this.debounceTimer);
                        this.debounceTimer = setTimeout(async () => {
                            const results = await this.fetchYandexSuggestions(query);
                            this.renderSuggestions(results, 'js-address-suggestions', (addr) => this.selectAddress(addr));
                        }, 400);
                    }
                }
            };

            addressInput.addEventListener('focus', handleInput);
            addressInput.addEventListener('click', handleInput);
            addressInput.addEventListener('input', handleInput);

            document.addEventListener('click', (e) => {
                if (!this.element?.contains(e.target as Node)) {
                    addressDropdown.classList.remove('active');
                }
            });
        }

        // 3. Кнопка открытия карты (может быть в выпадашке хедера)
        if (openMapBtn) {
            openMapBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openMapModal();
            });
        }

        // 4. Кнопка закрытия модалки карты (есть всегда в шаблоне модалки)
        const closeMapBtn = this.element?.querySelector('.js-close-map-modal') as HTMLElement | null;
        if (closeMapBtn) {
            closeMapBtn.addEventListener('click', () => {
                const modal = this.element?.querySelector('.js-map-modal');
                if (modal) modal.classList.remove('active');
            });
        }

        // 5. Поиск и саджесты ВНУТРИ модалки карты
        const modalInput = this.element?.querySelector('.js-modal-address-input') as HTMLInputElement | null;
        const modalSuggestContainer = this.element?.querySelector('.js-modal-suggestions') as HTMLElement | null;

        if (modalInput && modalSuggestContainer) {
            modalInput.addEventListener('input', (e: Event) => {
                const target = e.target as HTMLInputElement;
                const query = target.value.trim();
                
                if (query.length < 3) {
                    modalSuggestContainer.classList.remove('active');
                    return;
                }

                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(async () => {
                    const results = await this.fetchYandexSuggestions(query);
                    this.renderModalSuggestions(results);
                }, 300);
            });
        }

        // 6. Кнопка ОК в модалке
        const confirmBtn = this.element?.querySelector('.js-confirm-address-btn') as HTMLElement | null;
        if (confirmBtn && modalInput) {
            confirmBtn.addEventListener('click', () => {
                this.selectAddress(modalInput.value);
                const modal = this.element?.querySelector('.js-map-modal');
                if (modal) modal.classList.remove('active');
            });
        }
    }

    private renderSuggestions(list: string[], containerClass: string, onSelect: (addr: string) => void): void {
        const container = this.element?.querySelector(`.${containerClass}`);
        if (!container) return;

        container.innerHTML = list.map(addr => `
            <div class="address-dropdown__item" data-addr="${addr}">${addr}</div>
        `).join('');

        container.querySelectorAll('.address-dropdown__item').forEach(el => {
            const htmlEl = el as HTMLElement;
            htmlEl.onclick = () => {
                const addr = htmlEl.getAttribute('data-addr');
                if (addr) onSelect(addr);
            };
        });
    }

    private renderModalSuggestions(list: string[]): void {
        const container = this.element?.querySelector('.js-modal-suggestions');
        if (!container) return;

        if (!list.length) {
            container.classList.remove('active');
            return;
        }

        container.classList.add('active');
        container.innerHTML = list.map(addr => `<div class="modal-suggestion-item">${addr}</div>`).join('');

        container.querySelectorAll('.modal-suggestion-item').forEach(el => {
            const htmlEl = el as HTMLElement;
            htmlEl.onclick = () => {
                const addr = htmlEl.innerText;
                const modalInput = this.element?.querySelector('.js-modal-address-input') as HTMLInputElement;
                if (modalInput) modalInput.value = addr;
                
                container.classList.remove('active');
                
                ymaps.geocode(addr).then((res: any) => {
                    const coords = res.geoObjects.get(0).geometry.getCoordinates();
                    if (this.map) {
                        this.map.setCenter(coords, 16);
                        this.selectedCoords = coords;
                    }
                });
            };
        });
    }
}
