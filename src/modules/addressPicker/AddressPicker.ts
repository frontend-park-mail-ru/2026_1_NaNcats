import { Component } from '../../core/Component';
import { addressPickerTemplate } from './addressPicker.tmpl';
import './addressPicker.css';

declare var ymaps: any;
declare var process: { env: { YANDEX_SUGGEST_KEY: string; }; };

export class AddressPicker extends Component {
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
        super.mount(container, data);
    }

    afterRender(): void {
        const addressInput = this.element?.querySelector('.js-address-input') as HTMLInputElement;
        const addressDropdown = this.element?.querySelector('.js-address-dropdown');
        const modalInput = this.element?.querySelector('.js-modal-address-input') as HTMLInputElement;
        const modalSuggestContainer = this.element?.querySelector('.js-modal-suggestions');

        if (addressInput && addressDropdown) {
            addressInput.oninput = (e: Event) => {
                const target = e.target as HTMLInputElement;
                const query = target.value.trim();
                addressDropdown.classList.add('active');

                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                
                this.debounceTimer = setTimeout(async () => {
                    const results = query ? await this.fetchYandexSuggestions(query) : this.savedAddresses;
                    this.renderSuggestions(results, 'js-address-suggestions', (addr) => this.selectAddress(addr));
                }, 400);
            };

            document.addEventListener('click', (e) => {
                if (!this.element?.contains(e.target as Node)) {
                    addressDropdown.classList.remove('active');
                }
            });
        }

        const openMapBtn = this.element?.querySelector('.js-open-map-btn');
        if (openMapBtn) {
            (openMapBtn as HTMLElement).onclick = () => this.openMapModal();
        }

        const closeMapBtn = this.element?.querySelector('.js-close-map-modal');
        if (closeMapBtn) {
            (closeMapBtn as HTMLElement).onclick = () => {
                const modal = this.element?.querySelector('.js-map-modal');
                if (modal) modal.classList.remove('active');
            };
        }

        if (modalInput && modalSuggestContainer) {
            modalInput.oninput = (e: Event) => {
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
            };
        }

        const confirmBtn = this.element?.querySelector('.js-confirm-address-btn');
        if (confirmBtn && modalInput) {
            (confirmBtn as HTMLElement).onclick = () => {
                this.selectAddress(modalInput.value);
                const modal = this.element?.querySelector('.js-map-modal');
                if (modal) modal.classList.remove('active');
            };
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
