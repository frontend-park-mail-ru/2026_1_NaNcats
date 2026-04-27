import './profile.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { Popup } from '@shared/ui/popup';
import { userStore, type User } from '@entities/user';
import { addressStore } from '@entities/address';
import { cardStore } from '@entities/card';
import { orderApi, type Order } from '@entities/order';
import { uploadAvatar, deleteAvatar } from '@features/profile/upload-avatar';
import { EditProfileForm } from '@features/profile/edit-profile';
import { AddressList } from '@features/profile/manage-addresses';
import { CardList, bindNewCard } from '@features/profile/manage-cards';
import { AddressPicker } from '@widgets/address-picker';
import { Wordle } from '@widgets/wordle';
import { profilePageTemplate } from './profile.tmpl.js';

interface ProfilePageProps {
    user: User;
    orders: Order[];
}

export class ProfilePage extends Component<ProfilePageProps> {
    private picker: AddressPicker | null = null;

    constructor() {
        super(profilePageTemplate);
    }

    protected slots = {
        editForm: '.js-edit-form-slot',
        addressList: '.js-address-list-slot',
        cardList: '.js-card-list-slot',
        wordle: '.js-wordle-slot',
        picker: '.js-picker-slot',
    };

    static async load(): Promise<ProfilePageProps> {
        try {
            await userStore.loadCurrent();
        } catch (e) {
            console.warn('profile: loadCurrent failed', e);
        }
        const user = userStore.getState().user;
        if (!user) {
            window.router.go(ROUTES.login);
            return Promise.reject(new Error('not authenticated'));
        }
        const [, , ordersRes] = await Promise.allSettled([
            addressStore.loadSaved(),
            cardStore.load(),
            orderApi.list(),
        ]);
        const orders = ordersRes.status === 'fulfilled' ? ordersRes.value : [];
        return { user, orders };
    }

    protected onMount(): void {
        this.mountChild('editForm', new EditProfileForm(), {
            name: this.props.user.name,
            email: this.props.user.email,
        });

        this.mountChild('addressList', new AddressList(), {
            onEdit: (id) => void this.handleEditAddress(id),
        });

        this.mountChild('cardList', new CardList(), {});

        const wordle = new Wordle();
        this.mountChild('wordle', wordle, {
            onWin: () => {
                localStorage.setItem('wordle_solved', 'true');
                this.refreshWordleHint();
            },
        });

        this.picker = new AddressPicker();
        this.mountChild('picker', this.picker, { hideInput: true, skipDetails: false });

        this.bindAvatar();

        const addBtn = this.root?.querySelector('.js-add-address');
        if (addBtn) {
            this.on(addBtn, 'click', () => void this.picker?.openMapModal());
        }

        const addCardBtn = this.root?.querySelector('.js-add-card');
        if (addCardBtn) {
            this.on(addCardBtn, 'click', () => {
                void bindNewCard().catch(() => Popup.alert('Не удалось начать привязку карты. Попробуйте позже.'));
            });
        }

        const openWordle = this.root?.querySelector('.js-open-wordle');
        if (openWordle) {
            this.on(openWordle, 'click', () => void wordle.open());
        }

        this.refreshWordleHint();

        this.useStore(
            userStore,
            (s) => s.user,
            (next) => {
                if (next && next.avatar_url !== this.props.user.avatar_url) {
                    this.update({ user: next, orders: this.props.orders });
                }
            },
        );
    }

    private refreshWordleHint(): void {
        if (localStorage.getItem('wordle_solved') !== 'true') return;
        const info = this.root?.querySelector('.js-wordle-info');
        if (info) info.innerHTML = '<b>Поздравляем!</b> Вы отгадали слово дня 🎉';
    }

    private bindAvatar(): void {
        const uploadBtn = this.root?.querySelector('.js-upload-avatar');
        const fileInput = this.root?.querySelector('.js-avatar-input') as HTMLInputElement | null;
        const deleteBtn = this.root?.querySelector('.js-delete-avatar');

        if (uploadBtn && fileInput) {
            this.on(uploadBtn, 'click', () => fileInput.click());
            this.on(fileInput, 'change', async () => {
                const file = fileInput.files?.[0];
                if (!file) return;
                try {
                    await uploadAvatar(file);
                } catch (e) {
                    console.error('profile: uploadAvatar failed', e);
                    await Popup.alert('Не удалось загрузить аватар');
                }
            });
        }

        if (deleteBtn) {
            this.on(deleteBtn, 'click', async () => {
                try {
                    await deleteAvatar();
                } catch (e) {
                    console.error('profile: deleteAvatar failed', e);
                    await Popup.alert('Не удалось удалить аватар');
                }
            });
        }
    }

    private async handleEditAddress(id: string): Promise<void> {
        await this.picker?.openMapModal(id);
    }
}
