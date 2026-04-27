import './addressPicker.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { yandexMaps, type MapInstance } from '@shared/api/yandex';
import { addressStore, type Coordinates } from '@entities/address';
import { userStore } from '@entities/user';
import { pickAddress } from '@features/address/pick-address';
import { addressPickerTemplate } from './addressPicker.tmpl.js';

export interface AddressPickerProps {
    currentAddress?: string;
    skipDetails?: boolean;
    hideInput?: boolean;
    onSelect?: (text: string, coords: Coordinates) => void;
}

const SUGGEST_DEBOUNCE_MS = 400;
const DEFAULT_COORDS: Coordinates = [55.75, 37.61];

export class AddressPicker extends Component<AddressPickerProps> {
    private map: MapInstance | null = null;
    private selectedCoords: Coordinates = DEFAULT_COORDS;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private editingAddressId: string | null = null;

    constructor() {
        super(addressPickerTemplate);
    }

    protected onMount(): void {
        const stored = addressStore.getState().current;
        if (stored?.coords) this.selectedCoords = stored.coords;

        this.bindInputDropdown();
        this.bindMapModal();
        this.bindDetailsModal();
        this.bindOutsideClick();
    }

    protected onDestroy(): void {
        this.map?.destroy();
        this.map = null;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    private isAuthenticated(): boolean {
        return userStore.getState().user !== null;
    }

    private savedAddressTexts(): string[] {
        return addressStore.getState().saved.map((a) => a.location.address_text);
    }

    private bindInputDropdown(): void {
        const input = this.root?.querySelector('.js-address-input') as HTMLInputElement | null;
        const dropdown = this.root?.querySelector('.js-address-dropdown') as HTMLElement | null;
        const openMapBtn = this.root?.querySelector('.js-open-map-btn') as HTMLElement | null;
        if (!input || !dropdown) return;

        const handle = () => {
            if (!this.isAuthenticated()) {
                input.blur();
                window.router.go(ROUTES.login);
                return;
            }
            const query = input.value.trim();
            dropdown.classList.add('address-dropdown_active');

            if (!query) {
                if (openMapBtn) openMapBtn.style.display = 'none';
                this.renderSuggestions(this.savedAddressTexts(), false);
                return;
            }
            if (openMapBtn) openMapBtn.style.display = 'block';
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(async () => {
                const results = await yandexMaps.fetchSuggestions(query);
                this.renderSuggestions(results, true);
            }, SUGGEST_DEBOUNCE_MS);
        };

        this.on(input, 'focus', handle);
        this.on(input, 'input', handle);

        if (openMapBtn) this.on(openMapBtn, 'click', () => this.openMapModal());
    }

    private bindMapModal(): void {
        const closeBtn = this.root?.querySelector('.js-close-map-modal');
        if (closeBtn) this.on(closeBtn, 'click', () => this.closeMapModal());

        const confirmBtn = this.root?.querySelector('.js-confirm-address-btn');
        const modalInput = this.root?.querySelector('.js-modal-address-input') as HTMLInputElement | null;

        if (modalInput) {
            this.on(modalInput, 'input', () => {
                const query = modalInput.value.trim();
                if (query.length <= 2) return;
                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(async () => {
                    const results = await yandexMaps.fetchSuggestions(query);
                    this.renderModalSuggestions(results, modalInput);
                }, SUGGEST_DEBOUNCE_MS);
            });
        }

        if (confirmBtn && modalInput) {
            this.on(confirmBtn, 'click', () => {
                const addr = modalInput.value;
                this.closeMapModal();
                if (this.props.skipDetails) {
                    void this.finalize(addr, this.selectedCoords);
                } else {
                    this.openDetailsModal(addr, this.selectedCoords);
                }
            });
        }
    }

    private bindDetailsModal(): void {
        const detailsForm = this.root?.querySelector('.js-details-form') as HTMLFormElement | null;
        if (detailsForm) {
            this.on(detailsForm, 'submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(detailsForm);
                const displayInput = this.root?.querySelector('.js-display-address') as HTMLInputElement | null;
                const text = displayInput?.value ?? '';

                const details = {
                    apartment: (formData.get('apartment') as string) || undefined,
                    entrance: (formData.get('entrance') as string) || undefined,
                    floor: (formData.get('floor') as string) || undefined,
                    door_code: (formData.get('door_code') as string) || undefined,
                    courier_comment: (formData.get('courier_comment') as string) || undefined,
                    label: 'Дом',
                };

                this.closeDetailsModal();
                await this.finalize(text, this.selectedCoords, details);
            });
        }

        const changeBtn = this.root?.querySelector('.js-change-address-btn');
        if (changeBtn) {
            this.on(changeBtn, 'click', () => {
                this.closeDetailsModal();
                this.openMapModal();
            });
        }

        const closeDetails = this.root?.querySelector('.js-close-details-modal');
        if (closeDetails) this.on(closeDetails, 'click', () => this.closeDetailsModal());
    }

    private bindOutsideClick(): void {
        this.on(document, 'click', (e) => {
            if (!this.root?.contains(e.target as Node)) {
                this.root?.querySelector('.js-address-dropdown')?.classList.remove('address-dropdown_active');
            }
        });
    }

    async openMapModal(addressId?: string): Promise<void> {
        this.editingAddressId = addressId ?? null;
        const modal = this.root?.querySelector('.js-map-modal');
        if (!modal) return;
        modal.classList.add('modal-overlay_active');

        await yandexMaps.ready();
        if (this.map) return;

        const container = this.root?.querySelector('.js-yandex-map') as HTMLElement | null;
        if (!container) return;
        this.map = yandexMaps.createMap(container, this.selectedCoords, 16);
        this.map.onActionEnd(async (center) => {
            this.selectedCoords = center;
            const address = await yandexMaps.reverseGeocode(center);
            if (address) {
                const modalInput = this.root?.querySelector('.js-modal-address-input') as HTMLInputElement | null;
                if (modalInput) modalInput.value = address;
            }
        });
    }

    private closeMapModal(): void {
        this.root?.querySelector('.js-map-modal')?.classList.remove('modal-overlay_active');
    }

    private openDetailsModal(text: string, coords: Coordinates): void {
        const modal = this.root?.querySelector('.js-details-modal');
        const display = this.root?.querySelector('.js-display-address') as HTMLInputElement | null;
        const form = this.root?.querySelector('.js-details-form') as HTMLFormElement | null;
        if (!modal || !display || !form) return;

        form.reset();
        display.value = text;
        this.selectedCoords = coords;
        modal.classList.add('modal-overlay_active');
    }

    private closeDetailsModal(): void {
        this.root?.querySelector('.js-details-modal')?.classList.remove('modal-overlay_active');
    }

    private async finalize(text: string, coords: Coordinates, details?: Record<string, string | undefined>): Promise<void> {
        const inlineInput = this.root?.querySelector('.js-address-input') as HTMLInputElement | null;
        if (inlineInput) inlineInput.value = text;
        try {
            await pickAddress({ text, coords, details, addressId: this.editingAddressId });
        } catch (e) {
            console.error('AddressPicker finalize failed', e);
        }
        this.editingAddressId = null;
        this.props.onSelect?.(text, coords);
    }

    private renderSuggestions(list: string[], geocodeOnClick: boolean): void {
        const container = this.root?.querySelector('.js-address-suggestions') as HTMLElement | null;
        if (!container) return;

        container.innerHTML = list
            .map((addr) => `<div class="address-dropdown__item" data-addr="${addr}">${addr}</div>`)
            .join('');

        const onPick = async (e: Event) => {
            const item = (e.target as HTMLElement).closest<HTMLElement>('.address-dropdown__item');
            if (!item) return;
            const addr = item.dataset.addr || '';
            if (geocodeOnClick) {
                const coords = await yandexMaps.geocode(addr);
                if (coords) this.openDetailsModal(addr, coords);
            } else {
                await this.finalize(addr, this.selectedCoords);
            }
        };
        container.onclick = onPick as EventListener;
    }

    private renderModalSuggestions(list: string[], modalInput: HTMLInputElement): void {
        const container = this.root?.querySelector('.js-modal-suggestions') as HTMLElement | null;
        if (!container) return;

        if (list.length === 0) {
            container.classList.remove('address-modal__suggestions_active');
            return;
        }

        container.classList.add('address-modal__suggestions_active');
        container.innerHTML = list.map((addr) => `<div class="modal-suggestion-item">${addr}</div>`).join('');

        container.onclick = async (e: MouseEvent) => {
            const item = (e.target as HTMLElement).closest<HTMLElement>('.modal-suggestion-item');
            if (!item) return;
            const addr = item.innerText;
            modalInput.value = addr;
            container.classList.remove('address-modal__suggestions_active');

            const coords = await yandexMaps.geocode(addr);
            if (coords) {
                this.map?.setCenter(coords, 16);
                this.selectedCoords = coords;
            }
        };
    }
}
