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

    async mount(container: HTMLElement, data: any) {
        this.savedAddresses = data?.savedAddresses || [];
        this.isAuth = data?.isAuth !== undefined ? data.isAuth : true;
        super.mount(container, data);
    }

    afterRender(): void {
        const addressInput = this.element?.querySelector('.js-address-input') as HTMLInputElement | null;
        const addressDropdown = this.element?.querySelector('.js-address-dropdown') as HTMLElement | null;
        const openMapBtn = this.element?.querySelector('.js-open-map-btn') as HTMLElement | null;

        // 1. Главный инпут в хедере
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

        // 2. Кнопка "Указать на карте"
        if (openMapBtn) {
            openMapBtn.onclick = () => this.openMapModal();
        }

        // 3. Закрытие модалки КАРТЫ
        this.element?.querySelector('.js-close-map-modal')?.addEventListener('click', () => {
            this.element?.querySelector('.js-map-modal')?.classList.remove('active');
        });

        // 4. Кнопка ОК в модалке карты -> Открывает детали
        const confirmBtn = this.element?.querySelector('.js-confirm-address-btn') as HTMLElement | null;
        const modalInput = this.element?.querySelector('.js-modal-address-input') as HTMLInputElement | null;
        if (confirmBtn && modalInput) {
            confirmBtn.onclick = () => {
                const addr = modalInput.value;
                this.element?.querySelector('.js-map-modal')?.classList.remove('active');
                this.openDetailsModal(addr, this.selectedCoords);
            };
        }

        // 5. Поиск внутри модалки карты
        if (modalInput) {
            modalInput.oninput = () => {
                const query = modalInput.value.trim();
                if (query.length < 3) return;
                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(async () => {
                    const results = await this.fetchYandexSuggestions(query);
                    this.renderModalSuggestions(results);
                }, 300);
            };
        }

        // 6. ФОРМА ДЕТАЛЕЙ (Квартира, этаж и т.д.)
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

                this.element?.querySelector('.js-details-modal')?.classList.remove('active');
                this.finalizeAddress(addressText, this.selectedCoords);
            };
        }

        // 7. Кнопка "Карандаш" (вернуться к карте из деталей)
        const changeBtn = this.element?.querySelector('.js-change-address-btn') as HTMLElement | null;
        if (changeBtn) {
            changeBtn.onclick = () => {
                this.element?.querySelector('.js-details-modal')?.classList.remove('active');
                this.openMapModal();
            };
        }

        // 8. Кнопка закрытия модалки ДЕТАЛЕЙ
        this.element?.querySelector('.js-close-details-modal')?.addEventListener('click', () => {
            this.element?.querySelector('.js-details-modal')?.classList.remove('active');
        });

        // Клик вне выпадашки
        document.addEventListener('click', (e) => {
            if (!this.element?.contains(e.target as Node)) {
                addressDropdown?.classList.remove('active');
            }
        });
    }

    private finalizeAddress(address: string, coords: [number, number]): void {
        const input = this.element?.querySelector('.js-address-input') as HTMLInputElement;
        if (input) input.value = address;
        localStorage.setItem('delivery_address', address);
        localStorage.setItem('delivery_coords', JSON.stringify(coords));
        this.onSelectCallback(address, coords);
    }

    private openDetailsModal(address: string, coords: [number, number]): void {
        const modal = this.element?.querySelector('.js-details-modal') as HTMLElement;
        const displayInput = this.element?.querySelector('.js-display-address') as HTMLInputElement;
        const form = this.element?.querySelector('.js-details-form') as HTMLFormElement;

        if (modal && displayInput && form) {
            form.reset();
            displayInput.value = address;
            this.selectedCoords = coords;
            modal.classList.add('active');
        }
    }

    private renderSuggestions(list: string[], containerClass: string, isYandex: boolean): void {
        const container = this.element?.querySelector(`.${containerClass}`);
        if (!container) return;
        container.innerHTML = list.map(addr => `<div class="address-dropdown__item" data-addr="${addr}">${addr}</div>`).join('');
        
        container.querySelectorAll('.address-dropdown__item').forEach(el => {
            (el as HTMLElement).onclick = async () => {
                const addr = el.getAttribute('data-addr') || '';
                if (isYandex) {
                    const res = await ymaps.geocode(addr);
                    this.openDetailsModal(addr, res.geoObjects.get(0).geometry.getCoordinates());
                } else {
                    this.finalizeAddress(addr, this.selectedCoords);
                }
            };
        });
    }

    private renderModalSuggestions(list: string[]): void {
        const container = this.element?.querySelector('.js-modal-suggestions');
        if (!container) return;
        container.classList.add('active');
        container.innerHTML = list.map(addr => `<div class="modal-suggestion-item">${addr}</div>`).join('');
        container.querySelectorAll('.modal-suggestion-item').forEach(el => {
            (el as HTMLElement).onclick = () => {
                const addr = (el as HTMLElement).innerText;
                (this.element?.querySelector('.js-modal-address-input') as HTMLInputElement).value = addr;
                container.classList.remove('active');
                ymaps.geocode(addr).then((res: any) => {
                    const coords = res.geoObjects.get(0).geometry.getCoordinates();
                    this.map?.setCenter(coords, 16);
                    this.selectedCoords = coords;
                });
            };
        });
    }
}
