import { Component } from '@shared/lib/component';
import { userStore, type User } from '@entities/user';
import { LogoutButton } from '@features/auth/logout';
import { headerTemplate } from './header.tmpl.js';

export type HeaderMode = 'default' | 'back';

export interface HeaderProps {
    user: User | null;
    mode?: HeaderMode;
    onLogin?: () => void;
    onRegister?: () => void;
    onLoggedOut?: () => void;
    onBack?: () => void;
    onMountAddressSlot?: (slot: HTMLElement) => void;
}

export class Header extends Component<HeaderProps> {
    constructor() {
        super(headerTemplate);
    }

    protected slots = {
        userDropdown: '.js-user-dropdown',
    };

    protected onMount(): void {
        if (this.props.mode === 'back') {
            const backBtn = this.root?.querySelector('.js-back-btn');
            if (backBtn) {
                this.on(backBtn, 'click', () => {
                    if (this.props.onBack) this.props.onBack();
                    else window.history.back();
                });
            }
        } else {
            const addressSlot = this.root?.querySelector('.js-address-slot');
            if (addressSlot instanceof HTMLElement) {
                this.props.onMountAddressSlot?.(addressSlot);
            }
        }

        if (this.props.user) {
            this.mountChild('userDropdown', new LogoutButton(), {
                label: 'Выйти',
                onLoggedOut: this.props.onLoggedOut,
            });
        } else {
            const loginBtn = this.root?.querySelector('.js-login-btn');
            const registerBtn = this.root?.querySelector('.js-register-btn');
            if (loginBtn) this.on(loginBtn, 'click', () => this.props.onLogin?.());
            if (registerBtn) this.on(registerBtn, 'click', () => this.props.onRegister?.());
        }

        this.useStore(userStore, (s) => s.user, (next) => {
            if (next !== this.props.user) this.update({ user: next });
        });
    }
}
