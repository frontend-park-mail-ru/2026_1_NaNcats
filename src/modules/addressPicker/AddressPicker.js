import { Component } from '../../core/Component.js';
import { addressPickerTemplate } from './addressPicker.tmpl.js';
import './AddressPicker.css';

export class AddressPicker extends Component {
    constructor() {
        super(addressPickerTemplate);
        this.suggestKey = process.env.YANDEX_SUGGEST_KEY;
        this.savedAddresses = ['Ленинградский проспект, 39с79', 'Ленинградский проспект, 55', 'ул. Пушкина, 10'];
        this.map = null;
        this.selectedCoords = [55.75, 37.61];
        this.debounceTimer = null;
    }

    async fetchYandexSuggestions(query) {
        try {
            const response = await fetch(
                `https://suggest-maps.yandex.ru/v1/suggest?text=${encodeURIComponent(query)}&lang=ru_RU&apikey=${this.suggestKey}`
            );
            const data = await response.json();
            return data.results.map(item => item.title.text);
        } catch (e) {
            return [];
        }
    }

    initMap() {
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

    async reverseGeocode(coords) {
        const res = await ymaps.geocode(coords);
        const address = res.geoObjects.get(0).getAddressLine();
        document.getElementById('modal-address-input').value = address;
    }

    selectAddress(address) {
        const input = document.getElementById('address-input');
        if (input) input.value = address;
        localStorage.setItem('delivery_address', address);
        document.getElementById('address-dropdown').classList.remove('active');
    }

    afterRender() {
        const addressInput = document.getElementById('address-input');
        const addressDropdown = document.getElementById('address-dropdown');
        const modalInput = document.getElementById('modal-address-input');
        const modalSuggestContainer = document.getElementById('modal-suggestions');

        addressInput.oninput = (e) => {
            const query = e.target.value.trim();
            addressDropdown.classList.add('active');
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(async () => {
                const results = query ? await this.fetchYandexSuggestions(query) : this.savedAddresses;
                this.renderSuggestions(results, 'address-suggestions', (addr) => this.selectAddress(addr));
            }, 400);
        };

        document.getElementById('open-map-btn').onclick = () => {
            document.getElementById('map-modal').classList.add('active');
            ymaps.ready(() => this.initMap());
        };

        document.getElementById('close-map-modal').onclick = () => {
            document.getElementById('map-modal').classList.remove('active');
        };

        modalInput.oninput = (e) => {
            const query = e.target.value.trim();
            if (query.length < 3) {
                modalSuggestContainer.classList.remove('active');
                return;
            }
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(async () => {
                const results = await this.fetchYandexSuggestions(query);
                this.renderModalSuggestions(results);
            }, 300);
        };

        document.getElementById('confirm-address-btn').onclick = () => {
            this.selectAddress(modalInput.value);
            document.getElementById('map-modal').classList.remove('active');
        };
    }

    renderSuggestions(list, containerId, onSelect) {
        const container = document.getElementById(containerId);
        container.innerHTML = list.map(addr => `<div class="address-dropdown__item" data-addr="${addr}">${addr}</div>`).join('');
        container.querySelectorAll('.address-dropdown__item').forEach(el => {
            el.onclick = () => onSelect(el.dataset.addr);
        });
    }

    renderModalSuggestions(list) {
        const container = document.getElementById('modal-suggestions');
        if (!list.length) {
            container.classList.remove('active');
            return;
        }
        container.classList.add('active');
        container.innerHTML = list.map(addr => `<div class="modal-suggestion-item">${addr}</div>`).join('');
        container.querySelectorAll('.modal-suggestion-item').forEach(el => {
            el.onclick = () => {
                const addr = el.innerText;
                document.getElementById('modal-address-input').value = addr;
                container.classList.remove('active');
                ymaps.geocode(addr).then(res => {
                    const coords = res.geoObjects.get(0).geometry.getCoordinates();
                    this.map.setCenter(coords, 16);
                });
            };
        });
    }
}
