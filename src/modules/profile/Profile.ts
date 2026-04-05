import { Component } from '../../core/Component';
import { Ajax } from '../../core/Ajax';
import { profileTemplate } from './profile.tmpl';
import { validateEmail, validateName } from '../../shared/utils/Validator';
import './profile.css';

interface UserProfile {
    name: string;
    email: string;
    avatar_url: string;
}

declare var ymaps: any;

export class Profile extends Component {
    private user: UserProfile | null = null;
    private addresses: any[] = [];
    private isEditing: boolean = false;
    private map: any = null;
    private selectedLocation: { text: string, coords: [number, number] } | null = null;

    constructor() {
        super(profileTemplate);
    }

    async mount(container: HTMLElement) {
        try {
            const [userRes, addrRes] = await Promise.all([
                Ajax.get('/profile'),
                Ajax.get('/profile/addresses')
            ]);

            if (userRes.ok) {
                this.user = await userRes.json();
                const addrData = addrRes.ok ? await addrRes.json() : { addresses: [] };
                this.addresses = addrData.addresses || [];
                
                super.mount(container, { user: this.user, addresses: this.addresses });
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

        const editBtn = document.getElementById('edit-profile-btn');
        const saveBtn = document.getElementById('save-profile-btn');
        const nameInput = document.getElementById('profile-name') as HTMLInputElement;
        const emailInput = document.getElementById('profile-email') as HTMLInputElement;

        if (editBtn && saveBtn && nameInput && emailInput) {
            editBtn.onclick = () => {
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

            saveBtn.onclick = () => this.saveProfile(nameInput.value, emailInput.value);
        }

        const addBtn = document.getElementById('add-address-btn');
        if (addBtn) {
            addBtn.onclick = () => this.handleAddAddressClick();
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
    }

    private openAddressModal(address?: any) {
        const modal = document.getElementById('address-form-modal')!;
        const form = document.getElementById('address-details-form') as HTMLFormElement;
        const title = document.getElementById('address-modal-title')!;
        
        form.reset();
        (document.getElementById('form-address-id') as HTMLInputElement).value = address ? address.id : '';
        
        if (address) {
            title.innerText = 'Редактировать адрес';
            (form.elements.namedItem('address_text') as HTMLInputElement).value = address.location.address_text;
            (form.elements.namedItem('apartment') as HTMLInputElement).value = address.apartment || '';
            (form.elements.namedItem('entrance') as HTMLInputElement).value = address.entrance || '';
            (form.elements.namedItem('floor') as HTMLInputElement).value = address.floor || '';
            (form.elements.namedItem('door_code') as HTMLInputElement).value = address.door_code || '';
            (form.elements.namedItem('label') as HTMLInputElement).value = address.label || '';
        } else {
            title.innerText = 'Новый адрес';
        }
        
        modal.classList.add('active');
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

    private handleAddAddressClick() {
        const savedText = localStorage.getItem('delivery_address');
        const savedCoords = localStorage.getItem('delivery_coords');

        if (savedText && savedCoords) {
            this.selectedLocation = {
                text: savedText,
                coords: JSON.parse(savedCoords)
            };
            this.openDetailsModal();
        } else {
            this.openMapModal();
        }
    }

    private openMapModal() {
        const modal = document.getElementById('profile-map-modal');
        if (!modal) return;
        modal.classList.add('active');
        
        ymaps.ready(() => {
            if (!this.map) {
                this.map = new ymaps.Map("profile-yandex-map", {
                    center: [55.75, 37.61],
                    zoom: 15,
                    controls: []
                });

                this.map.events.add('actionend', async () => {
                    const center = this.map.getCenter();
                    const res = await ymaps.geocode(center);
                    const addressText = res.geoObjects.get(0).getAddressLine();
                    
                    this.selectedLocation = { text: addressText, coords: center };
                    const mapInput = document.getElementById('profile-map-search') as HTMLInputElement;
                    if (mapInput) mapInput.value = addressText;
                });
            }
        });
    }

    private openDetailsModal() {
        document.getElementById('profile-map-modal')?.classList.remove('active');
        
        const detailsModal = document.getElementById('address-details-modal');
        if (detailsModal) detailsModal.classList.add('active');
        
        const displayInput = document.getElementById('display-address-text') as HTMLInputElement;
        if (displayInput) displayInput.value = this.selectedLocation?.text || "";
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
            label: formData.get('label') || "Дом"
        };

        try {
            const response = await Ajax.post('/profile/addresses', payload);
            if (response.ok) {
                localStorage.removeItem('delivery_address');
                localStorage.removeItem('delivery_coords');
                document.getElementById('address-details-modal')?.classList.remove('active');
                this.mount(this.element!); 
            }
        } catch (err) {
            console.error("Ошибка сохранения:", err);
        }
    }
}
