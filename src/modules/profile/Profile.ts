import './profile.scss';
import { Component } from '../../core/Component';
import { Ajax } from '../../core/Ajax';
import { profileTemplate } from './profile.tmpl';
import { validateEmail, validateName } from '../../shared/utils/Validator';
import { AddressPicker } from '../addressPicker/AddressPicker';

/**
 * Интерфейс, описывающий данные пользователя профиля.
 * @interface UserProfile
 */
interface UserProfile {
    /** @type {string} Имя пользователя */
    name: string;
    /** @type {string} Почта пользователя */
    email: string;
    /** @type {string} URL аватара */
    avatar_url: string;
}

interface ProfileAddress {
    id: string;
    location: { address_text: string; latitude: number; longitude: number; };
    apartment?: string;
    entrance?: string;
    floor?: string;
    door_code?: string;
    courier_comment?: string;
}

interface ProfileCard {
    id: string;
    last4: string;
    issuer_name?: string;
    is_default: boolean;
}

/**
 * Компонент страницы профиля пользователя.
 * Отвечает за редактирование личных данных, управление адресами, картами и отображение истории заказов.
 * 
 * @class Profile
 * @extends Component
 */
export class Profile extends Component {
    /** @type {UserProfile | null} Данные пользователя */
    private user: UserProfile | null = null;
    /** @type {ProfileAddress}[]} Массив адресов пользователя */
    private addresses: ProfileAddress[] = [];
    /** @type {ProfileCard[]} Массив привязанных карт */
    private cards: ProfileCard[] = [];
    /** @type {boolean} Флаг режима редактирования профиля */
    private isEditing: boolean = false;

    /** @type {string | null} ID адреса, который редактируется в данный момент */
    private editingAddressId: string | null = null;
    /** @type {{ text: string, coords: [number, number] } | null} Временные данные выбранной локации */
    private selectedLocation: { text: string, coords: [number, number] } | null = null;
    /** @type {AddressPicker} Экземпляр компонента AddressPicker для добавления/изменения адресов */
    private addressPickerInstance!: AddressPicker;

    /**
     * Создает экземпляр страницы профиля.
     */
    constructor() {
        super(profileTemplate);
        
        this.addressPickerInstance = new AddressPicker((addr, coords) => {
            this.selectedLocation = { text: addr, coords: coords };
            this.openDetailsModal(); 
        });
    }

    /**
     * Монтирует компонент и загружает данные с сервера.
     * @override
     * @param {HTMLElement} container - DOM-контейнер.
     * @returns {Promise<void>}
     */
    async mount(container: HTMLElement): Promise<void> {
        this.isEditing = false;
        try {
            const [userRes, addrRes, cardsRes, ordersRes] = await Promise.all([
                Ajax.get('/profile'),
                Ajax.get('/profile/addresses'),
                Ajax.get('/profile/cards'),
                Ajax.get('/profile/orders')
            ]);

            if (userRes.ok) {
                this.user = await userRes.json();
                const addrData = addrRes.ok ? await addrRes.json() : { addresses: [] };
                const orders = ordersRes.ok ? await ordersRes.json() : [];
                this.addresses = addrData.addresses || [];

                this.cards = cardsRes.ok ? await cardsRes.json() : [];
                
                super.mount(container, { user: this.user, addresses: this.addresses, cards: this.cards, orders: orders });
            } else {
                window.router.go('/login');
            }
        } catch (e) {
            window.router.go('/login');
        }
    }

    /**
     * Навешивает обработчики событий после отрисовки.
     * @override
     * @returns {void}
     */
    afterRender(): void {
        const uploadBtn = document.getElementById('upload-avatar-btn');
        const fileInput = document.getElementById('avatar-input') as HTMLInputElement;
        
        if (uploadBtn && fileInput) {
            uploadBtn.onclick = () => fileInput.click();
            fileInput.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) await this.uploadAvatar(file);
            };
        }

        const deleteBtn = document.getElementById('delete-avatar-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => this.deleteAvatar();
        }

        const editTriggers = document.querySelectorAll('.js-edit-trigger');
        const saveBtn = document.getElementById('save-profile-btn') as HTMLElement;
        const nameInput = document.getElementById('profile-name') as HTMLInputElement;
        const emailInput = document.getElementById('profile-email') as HTMLInputElement;

        if (editTriggers.length && saveBtn && nameInput && emailInput) {
            editTriggers.forEach(trigger => {
                (trigger as HTMLElement).onclick = () => {
                    this.isEditing = !this.isEditing;
                    nameInput.disabled = !this.isEditing;
                    emailInput.disabled = !this.isEditing;
                    
                    if (this.isEditing) {
                        nameInput.focus();
                        saveBtn.classList.remove('button_hidden');
                    } else {
                        saveBtn.classList.add('button_hidden');
                        if (this.user) {
                            nameInput.value = this.user.name;
                            emailInput.value = this.user.email;
                        }
                    }
                };
            });
        }
        
        if (saveBtn) saveBtn.onclick = () => this.saveProfile(nameInput.value, emailInput.value);

        const addBtn = document.getElementById('add-address-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                this.editingAddressId = null;
                this.addressPickerInstance.openMapModal();
            };
        }

        const confirmLocBtn = document.getElementById('confirm-location-btn');
        if (confirmLocBtn) {
            confirmLocBtn.onclick = () => this.openDetailsModal();
        }

        const closeMapBtn = document.getElementById('close-profile-map');
        if (closeMapBtn) {
            closeMapBtn.onclick = () => document.getElementById('profile-map-modal')?.classList.remove('active');
        }

        const closeDetailsBtn = document.getElementById('close-details-modal');
        if (closeDetailsBtn) {
            closeDetailsBtn.onclick = () => document.getElementById('address-details-modal')?.classList.remove('modal-overlay_active');
        }

        const finalForm = document.getElementById('address-full-form') as HTMLFormElement;
        if (finalForm) {
            finalForm.onsubmit = (e) => this.submitFinalAddress(e);
        }

        const pickerPlaceholder = document.getElementById('profile-address-picker-container');
        if (pickerPlaceholder) {            
            this.addressPickerInstance.mount(pickerPlaceholder, { hideInput: true, skipDetails: true });
        }


        const addressList = document.getElementById('profile-address-list');
        if (addressList) {
            addressList.onclick = (e) => {
                const target = e.target as HTMLElement;
                const btn = target.closest('[data-id]');
                const addrId = btn?.getAttribute('data-id');

                if (!addrId) return;

                if (target.classList.contains('delete-addr-btn')) {
                    this.deleteAddress(addrId);
                } else if (target.classList.contains('edit-addr-btn')) {
                    this.openEditForm(addrId);
                }
            };
        }

        const addCardBtn = document.getElementById('add-card-btn');
        if (addCardBtn) {
            addCardBtn.onclick = () => this.bindNewCard();
        }

        const cardsList = document.getElementById('profile-cards-list');
        if (cardsList) {
            cardsList.onclick = (e) => {
                const target = e.target as HTMLElement;
                const cardId = target.getAttribute('data-id');
                if (!cardId) return;

                if (target.classList.contains('delete-card-btn')) {
                    this.deleteCard(cardId);
                } else if (target.classList.contains('set-default-card-btn')) {
                    this.setDefaultCard(cardId);
                }
            };
        }

        const showMoreBtn = document.getElementById('show-more-addresses-btn');
        if (showMoreBtn) {
            showMoreBtn.onclick = () => {
                const hiddenAddresses = document.querySelectorAll('.js-hidden-address');
                hiddenAddresses.forEach(el => el.classList.remove('address-row_hidden'));
                showMoreBtn.style.display = 'none';
            };
        }
    }

    /**
     * Инициирует процесс привязки новой карты через платежный шлюз.
     * @private
     * @returns {Promise<void>}
     */
    private async bindNewCard(): Promise<void> {
        try {
            const res = await Ajax.post('/profile/cards/bind', {});
            if (res.ok) {
                const data = await res.json();
                if (data.confirmation_url) {
                    window.location.href = data.confirmation_url; 
                }
            } else {
                alert('Не удалось начать привязку карты. Попробуйте позже.');
            }
        } catch (e) {
            console.error('Ошибка инициализации привязки:', e);
        }
    }

    /**
     * Удаляет привязанную карту.
     * @private
     * @param {string} id - ID карты.
     * @returns {Promise<void>}
     */
    private async deleteCard(id: string): Promise<void> {
        if (!confirm('Вы уверены, что хотите отвязать эту карту?')) return;
        try {
            const res = await Ajax.delete(`/profile/cards/${id}`);
            if (res.ok) {
                this.mount(this.element!);
            } else {
                alert('Не удалось удалить карту');
            }
        } catch (e) {
            console.error('Ошибка удаления карты:', e);
        }
    }

    /**
     * Устанавливает карту как основную (по умолчанию).
     * @private
     * @param {string} id - ID карты.
     * @returns {Promise<void>}
     */
    private async setDefaultCard(id: string): Promise<void> {
        try {
            const res = await Ajax.put(`/profile/cards/${id}`);
            if (res.ok) {
                this.mount(this.element!);
            } else {
                alert('Не удалось изменить основную карту');
            }
        } catch (e) {
            console.error('Ошибка установки карты по умолчанию:', e);
        }
    }

    /**
     * Загружает и перерисовывает список адресов пользователя.
     * @private
     * @returns {Promise<void>}
     */
    private async loadAndRenderAddresses(): Promise<void> {
        try {
            const res = await Ajax.get('/profile/addresses');
            if (res.ok) {
                const data = await res.json();
                this.addresses = data.addresses || [];
                this.renderAddressesDOM();
            }
        } catch (e) {
            console.error("Ошибка обновления адресов", e);
        }
    }

    /**
     * Отрисовывает список адресов в DOM.
     * @private
     * @returns {void}
     */
    private renderAddressesDOM(): void {
        const list = document.getElementById('profile-address-list');
        const showMoreBtn = document.getElementById('show-more-addresses-btn');
        if (!list) return;

        if (this.addresses.length === 0) {
            list.innerHTML = '<div class="empty-text">У вас пока нет сохраненных адресов</div>';
            if (showMoreBtn) showMoreBtn.style.display = 'none';
            return;
        }

        list.innerHTML = this.addresses.map((addr, index) => {
            const addrText = addr.location.address_text;
            const ap = addr.apartment ? `, кв. ${addr.apartment}` : '';
            const ent = addr.entrance ? `, под. ${addr.entrance}` : '';
            const fl = addr.floor ? `, эт. ${addr.floor}` : '';
            const isHidden = index >= 2 ? 'js-hidden-address address-row_hidden' : '';
            
            return `
            <div class="address-row ${isHidden}" data-id="${addr.id}">
                <span class="address-row__text">${addrText}${ap}${ent}${fl}</span>
                <div class="address-row__actions">
                    <div class="edit-icon-orange edit-addr-btn" data-id="${addr.id}"></div>
                    <div class="delete-icon-orange delete-addr-btn" data-id="${addr.id}"></div>
                </div>
            </div>`;
        }).join('');

        if (showMoreBtn) {
            showMoreBtn.style.display = this.addresses.length > 2 ? 'block' : 'none';
        }
    }

    /**
     * Открывает форму для редактирования существующего адреса.
     * @private
     * @param {string} id - ID редактируемого адреса.
     * @returns {void}
     */
    private openEditForm(id: string): void {
        const addr = this.addresses.find(a => a.id === id);
        if (!addr) return;

        this.editingAddressId = id;
        this.selectedLocation = {
            text: addr.location.address_text,
            coords: [addr.location.latitude, addr.location.longitude]
        };

        const modal = document.getElementById('address-details-modal');
        const form = document.getElementById('address-full-form') as HTMLFormElement;
        const displayInput = document.getElementById('display-address-text') as HTMLInputElement;

        if (modal && form && displayInput) {
            displayInput.value = addr.location.address_text;
            (form.elements.namedItem('apartment') as HTMLInputElement).value = addr.apartment || '';
            (form.elements.namedItem('entrance') as HTMLInputElement).value = addr.entrance || '';
            (form.elements.namedItem('floor') as HTMLInputElement).value = addr.floor || '';
            (form.elements.namedItem('door_code') as HTMLInputElement).value = addr.door_code || '';
            (form.elements.namedItem('courier_comment') as HTMLInputElement).value = addr.courier_comment || '';
            modal.classList.add('modal-overlay_active');
        }
    }

    /**
     * Удаляет адрес по его ID.
     * @private
     * @param {string} id - ID адреса.
     * @returns {Promise<void>}
     */
    private async deleteAddress(id: string): Promise<void> {
        if (!confirm('Удалить этот адрес?')) return;
        try {
            const res = await Ajax.delete(`/profile/addresses/${id}`);
            if (res.ok) {
                await this.loadAndRenderAddresses();
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Загружает новую картинку аватара на сервер.
     * @private
     * @param {File} file - Файл изображения.
     * @returns {Promise<void>}
     */
    private async uploadAvatar(file: File): Promise<void> {
        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await fetch('/api/profile/avatar', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (this.user) this.user.avatar_url = data.avatar_url;
                
                const avatarImg = document.getElementById('profile-avatar-img') as HTMLImageElement;
                const headerImg = document.querySelector('.logo-avatar') as HTMLImageElement;
                if (avatarImg) avatarImg.src = data.avatar_url;
                if (headerImg) headerImg.src = data.avatar_url;
                
                this.mount(this.element!);
            } else {
                const err = await response.json();
                this.showError(err.message || 'Ошибка загрузки аватара');
            }
        } catch (e) {
            this.showError('Проблема с сетью при загрузке картинки');
        }
    }

    /**
     * Удаляет текущий аватар пользователя.
     * @private
     * @returns {Promise<void>}
     */
    private async deleteAvatar(): Promise<void> {
        try {
            const res = await fetch('/api/profile/avatar', { method: 'DELETE', credentials: 'include' });
            
            if (res.ok) {
                const data = await res.json();
                if (this.user) this.user.avatar_url = data.avatar_url;
                this.mount(this.element!);
            }
        } catch (e) {
            this.showError('Не удалось удалить аватар');
        }
    }

    /**
     * Сохраняет отредактированные имя и почту.
     * @private
     * @param {string} newName - Новое имя пользователя.
     * @param {string} newEmail - Новая почта пользователя.
     * @returns {Promise<void>}
     */
    private async saveProfile(newName: string, newEmail: string): Promise<void> {
        this.showError('');
        const name = newName.trim();
        const email = newEmail.trim();

        if (!validateName(name)) {
            return this.showError('Имя должно быть от 4 до 30 символов');
        }
        if (!validateEmail(email)) {
            return this.showError('Неверный формат почты');
        }

        try {
            const patchRes = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, email })
            });

            if (patchRes.ok) {
                if (this.user) {
                    this.user.name = name;
                    this.user.email = email;
                }
                this.mount(this.element!);

                const err = await patchRes.json();
                if (patchRes.status === 409) {
                    this.showError('Этот email уже используется');
                } else {
                    this.showError(err.message || 'Ошибка обновления');
                }
            }
        } catch (e) {
            this.showError('Ошибка соединения');
        }
    }

    /**
     * Выводит сообщение об ошибке профиля в UI.
     * @private
     * @param {string} msg - Текст ошибки.
     * @returns {void}
     */
    private showError(msg: string): void {
        const errBlock = document.getElementById('profile-error');
        if (errBlock) errBlock.innerText = msg;
    }

    /**
     * Открывает модалку для заполнения деталей адреса (квартира, код двери).
     * @private
     * @returns {void}
     */
    private openDetailsModal(): void {
        const modal = document.getElementById('address-details-modal');
        const displayInput = document.getElementById('display-address-text') as HTMLInputElement;
        
        if (modal && displayInput) {
            if (!this.editingAddressId) {
                (document.getElementById('address-full-form') as HTMLFormElement).reset();
            }

            displayInput.value = this.selectedLocation?.text || "";
            modal.classList.add('modal-overlay_active');
        }
    }


    /**
     * Обрабатывает отправку формы сохранения деталей адреса.
     * @private
     * @param {Event} e - Событие сабмита формы.
     * @returns {Promise<void>}
     */
    private async submitFinalAddress(e: Event): Promise<void> {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        if (!this.selectedLocation) return;

        const payload = {
            address_text: this.selectedLocation.text,
            lat: this.selectedLocation.coords[0],
            lon: this.selectedLocation.coords[1],
            apartment: formData.get('apartment')?.toString() || "",
            entrance: formData.get('entrance')?.toString() || "",
            floor: formData.get('floor')?.toString() || "",
            door_code: formData.get('door_code')?.toString() || "",
            courier_comment: formData.get('courier_comment')?.toString() || "",
            label: "Дом"
        };

        try {
            let res;
            if (this.editingAddressId) {
                res = await Ajax.patch(`/profile/addresses/${this.editingAddressId}`, payload);
            } else {
                res = await Ajax.post('/profile/addresses', payload);
            }

            if (res.ok) {
                const modal = document.getElementById('address-details-modal');
                modal?.classList.remove('modal-overlay_active');

                this.editingAddressId = null;
                this.selectedLocation = null;

                await this.loadAndRenderAddresses(); 
            } else {
                const errData = await res.json();
                this.showError(errData.message || "Ошибка сохранения");
            }
        } catch (err) {
            console.error("Ошибка при сохранении:", err);
        }
    }
}
