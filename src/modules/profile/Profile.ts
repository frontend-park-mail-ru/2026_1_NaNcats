import { Component } from '../../core/Component';
import { Ajax } from '../../core/Ajax';
import { profileTemplate } from './profile.tmpl';
import { validateEmail, validateName } from '../../shared/utils/Validator';
import { AddressPicker } from '../addressPicker/AddressPicker';
import './profile.css';

interface UserProfile {
    name: string;
    email: string;
    avatar_url: string;
}

export class Profile extends Component {
    private user: UserProfile | null = null;
    private addresses: any[] = [];
    private cards: any[] = [];
    private isEditing: boolean = false;

    private editingAddressId: number | null = null;
    private selectedLocation: { text: string, coords: [number, number] } | null = null;
    private addressPickerInstance: AddressPicker;

    constructor() {
        super(profileTemplate);

        this.addressPickerInstance = new AddressPicker(() => {
            if (this.element) {
                this.mount(this.element); 
            }
        });
    }

    async mount(container: HTMLElement) {
        this.isEditing = false;
        try {
            const [userRes, addrRes, cardsRes] = await Promise.all([
                Ajax.get('/profile'),
                Ajax.get('/profile/addresses'),
                Ajax.get('/profile/cards')
            ]);

            if (userRes.ok) {
                this.user = await userRes.json();
                const addrData = addrRes.ok ? await addrRes.json() : { addresses: [] };
                this.addresses = addrData.addresses || [];

                this.cards = cardsRes.ok ? await cardsRes.json() : [];
                
                super.mount(container, { user: this.user, addresses: this.addresses, cards: this.cards });
            } else {
                window.router.go('/login');
            }
        } catch (e) {
            window.router.go('/login');
        }
    }

    afterRender() {
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
                        saveBtn.classList.remove('hidden');
                    } else {
                        saveBtn.classList.add('hidden');
                        if (this.user) {
                            nameInput.value = this.user.name;
                            emailInput.value = this.user.email;
                        }
                    }
                };
            });
        }
        saveBtn.onclick = () => this.saveProfile(nameInput.value, emailInput.value);

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
            closeDetailsBtn.onclick = () => document.getElementById('address-details-modal')?.classList.remove('active');
        }

        const finalForm = document.getElementById('address-full-form') as HTMLFormElement;
        if (finalForm) {
            finalForm.onsubmit = (e) => this.submitFinalAddress(e);
        }

        const pickerPlaceholder = document.getElementById('profile-address-picker-container');
        if (pickerPlaceholder) {
            this.addressPickerInstance.mount(pickerPlaceholder, { hideInput: true });
        }

        const addressList = document.getElementById('profile-address-list');
        if (addressList) {
            addressList.onclick = (e) => {
                const target = e.target as HTMLElement;
                const addrId = target.getAttribute('data-id');
                if (!addrId) return;

                if (target.classList.contains('delete-addr-btn')) {
                    this.deleteAddress(addrId);
                } else if (target.classList.contains('edit-addr-btn')) {
                    this.openEditForm(Number(addrId));
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
                hiddenAddresses.forEach(el => el.classList.remove('hidden'));
                showMoreBtn.style.display = 'none';
            };
        }
    }

    private async bindNewCard() {
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

    private async deleteCard(id: string) {
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

    private async setDefaultCard(id: string) {
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

    private openEditForm(id: number) {
        const addr = this.addresses.find(a => a.id === id);
        if (!addr) return;

        this.editingAddressId = id;
        this.selectedLocation = {
            text: addr.location.address_text,
            coords: [addr.location.lat, addr.location.lon]
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
            modal.classList.add('active');
        }
    }

    private async deleteAddress(id: string) {
        if (!confirm('Удалить этот адрес?')) return;
        try {
            const res = await fetch(`/api/profile/addresses/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) this.mount(this.element!);
        } catch (e) {
            console.error(e);
        }
    }

    private async uploadAvatar(file: File) {
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

    private async deleteAvatar() {
        try {
            const response = await Ajax.get('/profile/avatar');
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

    private async saveProfile(newName: string, newEmail: string) {
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
            const response = await Ajax.post('/profile', { name, email });
            
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

    private showError(msg: string) {
        const errBlock = document.getElementById('profile-error');
        if (errBlock) errBlock.innerText = msg;
    }

    private openDetailsModal() {
        const modal = document.getElementById('address-details-modal');
        const displayInput = document.getElementById('display-address-text') as HTMLInputElement;
        
        if (modal && displayInput) {
            if (!this.editingAddressId) {
                (document.getElementById('address-full-form') as HTMLFormElement).reset();
            }
            
            displayInput.value = this.selectedLocation?.text || "";
            modal.classList.add('active');
        }
    }


    private async submitFinalAddress(e: Event) {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        if (!this.selectedLocation) return;

        const payload = {
            address_text: this.selectedLocation.text,
            lat: this.selectedLocation.coords[0],
            lon: this.selectedLocation.coords[1],
            apartment: formData.get('apartment'),
            entrance: formData.get('entrance'),
            floor: formData.get('floor'),
            door_code: formData.get('door_code'),
            courier_comment: formData.get('courier_comment'),
            label: "Дом"
        };

        try {
            let res;
            if (this.editingAddressId) {
                res = await fetch(`/api/profile/addresses/${this.editingAddressId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    credentials: 'include'
                });
            } else {
                res = await Ajax.post('/profile/addresses', payload);
            }

            if (res.ok) {
                document.getElementById('address-details-modal')?.classList.remove('active');
                this.mount(this.element!); 
            }
        } catch (err) { console.error(err); }
    }
}
