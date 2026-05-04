import './addressPicker.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { yandexMaps, type MapInstance } from '@shared/api/yandex';
import { addressStore, type Coordinates } from '@entities/address';
import { userStore } from '@entities/user';
import { pickAddress } from '@features/address/pick-address';
import { addressPickerTemplate } from './addressPicker.tmpl.js';

/**
 * Входные данные виджета {@link AddressPicker}.
 */
export interface AddressPickerProps {
    /** Текст текущего адреса для предзаполнения инпута. */
    currentAddress?: string;
    /** Пропускать модалку с деталями адреса (квартира, подъезд и т.п.). */
    skipDetails?: boolean;
    /** Скрыть инлайн-инпут адреса (например, в режиме иконки). */
    hideInput?: boolean;
    /** Колбэк выбора адреса: получает текст и координаты выбранной точки. */
    onSelect?: (text: string, coords: Coordinates) => void;
}

const SUGGEST_DEBOUNCE_MS = 400;
const DEFAULT_COORDS: Coordinates = [55.75, 37.61];

/**
 * Виджет выбора адреса доставки.
 *
 * Объединяет инлайн-инпут с подсказками, модалку с картой Yandex для уточнения
 * точки и модалку с дополнительными деталями (квартира, подъезд, комментарий).
 * Поддерживает редактирование сохранённого адреса по идентификатору и
 * сохранение результата через сценарий pickAddress.
 */
export class AddressPicker extends Component<AddressPickerProps> {
    private map: MapInstance | null = null;
    private selectedCoords: Coordinates = DEFAULT_COORDS;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private editingAddressId: string | null = null;
    private pendingAddressText = '';
    private suppressNextActionEnd = false;

    constructor() {
        super(addressPickerTemplate);
    }

    /**
     * Восстанавливает координаты текущего адреса из стора и привязывает все
     * обработчики: инлайн-инпут с подсказками, модалку карты, модалку деталей,
     * закрытие подсказок по клику вне виджета.
     */
    protected onMount(): void {
        const stored = addressStore.getState().current;
        if (stored?.coords) this.selectedCoords = stored.coords;

        this.bindInputDropdown();
        this.bindMapModal();
        this.bindDetailsModal();
        this.bindOutsideClick();
    }

    /**
     * Освобождает ресурсы карты Yandex и отменяет отложенный запрос подсказок
     * при размонтировании.
     */
    protected onDestroy(): void {
        this.map?.destroy();
        this.map = null;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    /**
     * Проверяет, авторизован ли пользователь.
     *
     * @returns true, если в userStore есть текущий пользователь.
     */
    private isAuthenticated(): boolean {
        return userStore.getState().user !== null;
    }

    /**
     * Возвращает тексты всех сохранённых адресов из стора.
     *
     * @returns Массив строк с адресами.
     */
    private savedAddressTexts(): string[] {
        return addressStore.getState().saved.map((a) => a.location.address_text);
    }

    /**
     * Привязывает поведение инлайн-инпута с подсказками: при фокусе и вводе
     * показываются либо сохранённые адреса (для пустого ввода), либо
     * результаты Yandex с дебаунсом. Для неавторизованных перенаправляет на
     * страницу логина. Также вешает клик по контейнеру, открывающий модалку
     * карты, когда инпут скрыт.
     */
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

        const container = this.root?.querySelector('.js-address-container') as HTMLElement | null;
        if (container) {
            this.on(container, 'click', (e) => {
                const inputHidden = window.getComputedStyle(input).display === 'none';
                if (!inputHidden) return;
                if (!this.isAuthenticated()) {
                    window.router.go(ROUTES.login);
                    return;
                }
                const t = e.target as HTMLElement;
                if (t.closest('.js-open-map-btn')) return;
                void this.openMapModal();
            });
        }
    }

    /**
     * Привязывает обработчики модалки с картой: ввод и Enter в поле адреса
     * запускают подсказки и геокодинг с перемещением карты, кнопка
     * подтверждения завершает выбор (через модалку деталей или сразу,
     * если skipDetails).
     */
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
                    const [results, coords] = await Promise.all([
                        yandexMaps.fetchSuggestions(query),
                        yandexMaps.geocode(query),
                    ]);
                    this.renderModalSuggestions(results, modalInput);
                    if (coords) {
                        this.moveMapProgrammatically(coords);
                    }
                }, SUGGEST_DEBOUNCE_MS);
            });

            this.on(modalInput, 'keydown', (e) => {
                if ((e as KeyboardEvent).key !== 'Enter') return;
                e.preventDefault();
                void (async () => {
                    const query = modalInput.value.trim();
                    if (!query) return;
                    const coords = await yandexMaps.geocode(query);
                    if (coords) {
                        this.moveMapProgrammatically(coords);
                    }
                })();
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

    /**
     * Привязывает обработчики модалки деталей адреса: отправка формы вызывает
     * финализацию выбора, кнопка смены адреса возвращает на карту, кнопка
     * закрытия скрывает модалку.
     */
    private bindDetailsModal(): void {
        const detailsForm = this.root?.querySelector('.js-details-form') as HTMLFormElement | null;
        if (detailsForm) {
            this.on(detailsForm, 'submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(detailsForm);
                const displayInput = this.root?.querySelector('.js-display-address') as HTMLInputElement | null;
                const text = this.pendingAddressText || displayInput?.value || '';

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

    /**
     * Закрывает выпадающие подсказки адреса при клике вне корня виджета.
     */
    private bindOutsideClick(): void {
        this.on(document, 'click', (e) => {
            if (!this.root?.contains(e.target as Node)) {
                this.root?.querySelector('.js-address-dropdown')?.classList.remove('address-dropdown_active');
            }
        });
    }

    /**
     * Открывает модалку с картой Yandex. Если передан идентификатор
     * сохранённого адреса, центрирует карту по его координатам и подставляет
     * текст в инпут модалки. При первом открытии создаёт карту, иначе
     * перемещает существующую.
     *
     * @param addressId Идентификатор сохранённого адреса для редактирования.
     * @returns Промис, разрешающийся после готовности карты.
     */
    async openMapModal(addressId?: string): Promise<void> {
        this.editingAddressId = addressId ?? null;
        const modal = this.root?.querySelector('.js-map-modal') as HTMLElement | null;
        if (!modal) return;
        modal.classList.add('modal-overlay_active');

        const modalInput = this.root?.querySelector('.js-modal-address-input') as HTMLInputElement | null;
        if (addressId) {
            const target = addressStore.getState().saved.find((a) => a.id === addressId);
            if (target?.location) {
                this.selectedCoords = [target.location.latitude, target.location.longitude];
                if (modalInput) modalInput.value = target.location.address_text ?? '';
            }
        }

        await yandexMaps.ready();

        const container = this.root?.querySelector('.js-yandex-map') as HTMLElement | null;
        if (!container) return;

        if (this.map) {
            this.moveMapProgrammatically(this.selectedCoords);
            this.map.fitToViewport();
        } else {
            this.suppressNextActionEnd = true;
            this.map = yandexMaps.createMap(container, this.selectedCoords, 16);
            this.map.onActionEnd(async (center) => {
                this.selectedCoords = center;
                if (this.suppressNextActionEnd) {
                    this.suppressNextActionEnd = false;
                    return;
                }
                const address = await yandexMaps.reverseGeocode(center);
                if (address && modalInput) modalInput.value = address;
            });
            requestAnimationFrame(() => this.map?.fitToViewport());
        }
    }

    /**
     * Программно центрирует карту по заданным координатам и помечает следующее
     * событие завершения действия как не требующее обратного геокодинга.
     *
     * @param coords Новые координаты центра карты.
     */
    private moveMapProgrammatically(coords: Coordinates): void {
        this.selectedCoords = coords;
        if (!this.map) return;
        this.suppressNextActionEnd = true;
        this.map.setCenter(coords, 16);
    }

    /**
     * Скрывает модалку с картой.
     */
    private closeMapModal(): void {
        this.root?.querySelector('.js-map-modal')?.classList.remove('modal-overlay_active');
    }

    /**
     * Открывает модалку с дополнительными деталями адреса, заполняя поле
     * отображаемого адреса и сохраняя координаты для последующей финализации.
     *
     * @param text Текст выбранного адреса.
     * @param coords Координаты выбранной точки.
     */
    private openDetailsModal(text: string, coords: Coordinates): void {
        const modal = this.root?.querySelector('.js-details-modal') as HTMLElement | null;
        const display = this.root?.querySelector('.js-display-address') as HTMLInputElement | null;
        const form = this.root?.querySelector('.js-details-form') as HTMLFormElement | null;
        if (!modal || !display || !form) return;

        form.reset();
        display.value = text;
        this.pendingAddressText = text;
        this.selectedCoords = coords;
        modal.classList.add('modal-overlay_active');
    }

    /**
     * Скрывает модалку деталей адреса.
     */
    private closeDetailsModal(): void {
        this.root?.querySelector('.js-details-modal')?.classList.remove('modal-overlay_active');
    }

    /**
     * Завершает выбор адреса: обновляет инлайн-инпут, вызывает сценарий
     * сохранения через pickAddress и пробрасывает результат во внешний колбэк
     * onSelect. Сбрасывает состояние редактирования.
     *
     * @param text Текст выбранного адреса.
     * @param coords Координаты выбранной точки.
     * @param details Дополнительные детали адреса (квартира, подъезд и т.п.).
     * @returns Промис, разрешающийся после завершения сценария.
     */
    private async finalize(
        text: string,
        coords: Coordinates,
        details?: Record<string, string | undefined>,
    ): Promise<void> {
        const inlineInput = this.root?.querySelector('.js-address-input') as HTMLInputElement | null;
        if (inlineInput) inlineInput.value = text;
        try {
            await pickAddress({ text, coords, details, addressId: this.editingAddressId });
        } catch (e) {
            console.error('AddressPicker finalize failed', e);
        }
        this.editingAddressId = null;
        this.pendingAddressText = '';
        this.props.onSelect?.(text, coords);
    }

    /**
     * Рендерит подсказки в выпадающем блоке инлайн-инпута. Клик по подсказке
     * либо сразу финализирует выбор по уже известным координатам, либо
     * предварительно делает геокодинг и открывает модалку деталей.
     *
     * @param list Тексты адресов-подсказок.
     * @param geocodeOnClick Делать ли геокодинг при клике (true для свежих подсказок Yandex, false для сохранённых).
     */
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

    /**
     * Рендерит подсказки в модалке карты. Клик по подсказке заполняет инпут
     * модалки и центрирует карту по геокодированным координатам. Обработчик
     * привязывается единожды на контейнер.
     *
     * @param list Тексты адресов-подсказок.
     * @param modalInput Инпут модалки, в который подставится выбранный адрес.
     */
    private renderModalSuggestions(list: string[], modalInput: HTMLInputElement): void {
        const container = this.root?.querySelector('.js-modal-suggestions') as HTMLElement | null;
        if (!container) return;

        if (list.length === 0) {
            container.classList.remove('address-modal__suggestions_active');
            return;
        }

        container.classList.add('address-modal__suggestions_active');
        container.innerHTML = list.map((addr) => `<div class="modal-suggestion-item">${addr}</div>`).join('');

        if (!container.dataset.tapBound) {
            container.dataset.tapBound = '1';
            const pickHandler = (e: Event) => {
                const item = (e.target as HTMLElement).closest<HTMLElement>('.modal-suggestion-item');
                if (!item) return;
                e.preventDefault();
                const addr = item.innerText;
                modalInput.value = addr;
                container.classList.remove('address-modal__suggestions_active');
                void (async () => {
                    const coords = await yandexMaps.geocode(addr);
                    if (coords) {
                        this.moveMapProgrammatically(coords);
                    }
                })();
            };
            container.addEventListener('pointerdown', pickHandler);
            container.addEventListener('click', pickHandler);
        }
    }
}
