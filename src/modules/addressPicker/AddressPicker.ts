import { Component } from '../../core/Component';
import { addressPickerTemplate } from './addressPicker.tmpl';
import { Ajax } from '../../core/Ajax';
import './addressPicker.css';

interface YandexSuggestItem {
    title: {
        text: string;
    };
}

interface YandexSuggestResponse {
    results: YandexSuggestItem[];
}

declare var ymaps: any;
declare var process: {
    env: {
        YANDEX_SUGGEST_KEY: string;
    };
};

export class AddressPicker extends Component {
    private suggestKey: string;
    private savedAddresses: string[];
    private map: any | null;
    private selectedCoords: [number, number];
    private debounceTimer: ReturnType<typeof setTimeout> | null;

    constructor() {
        super(addressPickerTemplate);
        this.suggestKey = process.env.YANDEX_SUGGEST_KEY;
        this.savedAddresses = [];
        this.map = null;
        this.selectedCoords = [55.75, 37.61];
        this.debounceTimer = null;
    }

    async fetchYandexSuggestions(query: string): Promise<string[]> {
        try {
            const response = await fetch(
                `https://suggest-maps.yandex.ru/v1/suggest?text=${encodeURIComponent(query)}&lang=ru_RU&apikey=${this.suggestKey}`
            );
            const data: YandexSuggestResponse = await response.json();
            return data.results.map(item => item.title.text);
        } catch (e) {
            console.error("Suggest error:", e);
            return [];
        }
    }

    initMap(): void {
        if (this.map) return;
        this.map = new ymaps.Map("yandex-map", {
            center: this.selectedCoords,
            zoom: 16,
            controls: []
        });

        this.map.events.add('actionend', () => {
            const center = this.map.getCenter();
            this.reverseGeocode(center);
        });
    }

    async reverseGeocode(coords: [number, number]): Promise<void> {
        try {
            const res = await ymaps.geocode(coords);
            const address = res.geoObjects.get(0).getAddressLine();
            const modalInput = document.getElementById('modal-address-input') as HTMLInputElement;
            if (modalInput) modalInput.value = address;
        } catch (e) {
            console.error("Geocode error:", e);
        }
    }

    selectAddress(address: string): void {
        const input = document.getElementById('address-input') as HTMLInputElement;
        if (input) input.value = address;   
    
        localStorage.setItem('delivery_address', address);
        localStorage.setItem('delivery_coords', JSON.stringify(this.selectedCoords));
        
        const dropdown = document.getElementById('address-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    }

    async mount(container: HTMLElement, data: any) {
        try {
            const res = await Ajax.get('/profile/addresses');
            if (res.ok) {
                const json = await res.json();
                // Мапим в строки для выпадающего списка
                this.savedAddresses = json.addresses.map((a: any) => a.location.address_text);
            }
        } catch (e) {
            const local = localStorage.getItem('delivery_address');
            this.savedAddresses = local ? [local] : ['Укажите адрес на карте'];
        }
        super.mount(container, data);
    }

    afterRender(): void {
        const addressInput = document.getElementById('address-input') as HTMLInputElement;
        const addressDropdown = document.getElementById('address-dropdown');
        const modalInput = document.getElementById('modal-address-input') as HTMLInputElement;
        const modalSuggestContainer = document.getElementById('modal-suggestions');

        if (addressInput && addressDropdown) {
            addressInput.oninput = (e: Event) => {
                const target = e.target as HTMLInputElement;
                const query = target.value.trim();
                addressDropdown.classList.add('active');

                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                
                this.debounceTimer = setTimeout(async () => {
                    const results = query ? await this.fetchYandexSuggestions(query) : this.savedAddresses;
                    this.renderSuggestions(results, 'address-suggestions', (addr) => this.selectAddress(addr));
                }, 400);
            };
        }

        const openMapBtn = document.getElementById('open-map-btn');
        if (openMapBtn) {
            openMapBtn.onclick = () => {
                const modal = document.getElementById('map-modal');
                if (modal) {
                    modal.classList.add('active');
                    ymaps.ready(() => this.initMap());
                }
            };
        }

        const closeMapBtn = document.getElementById('close-map-modal');
        if (closeMapBtn) {
            closeMapBtn.onclick = () => {
                const modal = document.getElementById('map-modal');
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

        const confirmBtn = document.getElementById('confirm-address-btn');
        if (confirmBtn && modalInput) {
            confirmBtn.onclick = () => {
                this.selectAddress(modalInput.value);
                const modal = document.getElementById('map-modal');
                if (modal) modal.classList.remove('active');
            };
        }
    }

    renderSuggestions(list: string[], containerId: string, onSelect: (addr: string) => void): void {
        const container = document.getElementById(containerId);
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

    renderModalSuggestions(list: string[]): void {
        const container = document.getElementById('modal-suggestions');
        if (!container) return;

        if (!list.length) {
            container.classList.remove('active');
            return;
        }

        container.classList.add('active');
        container.innerHTML = list.map(addr => `
            <div class="modal-suggestion-item">${addr}</div>
        `).join('');

        container.querySelectorAll('.modal-suggestion-item').forEach(el => {
            const htmlEl = el as HTMLElement;
            htmlEl.onclick = () => {
                const addr = htmlEl.innerText;
                const modalInput = document.getElementById('modal-address-input') as HTMLInputElement;
                if (modalInput) modalInput.value = addr;
                
                container.classList.remove('active');
                
                ymaps.geocode(addr).then((res: any) => {
                    const coords = res.geoObjects.get(0).geometry.getCoordinates();
                    if (this.map) this.map.setCenter(coords, 16);
                });
            };
        });
    }
}
