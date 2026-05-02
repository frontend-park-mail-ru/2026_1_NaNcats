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
            const loginBtns = this.root?.querySelectorAll('.js-login-btn') ?? [];
            const registerBtns = this.root?.querySelectorAll('.js-register-btn') ?? [];

            loginBtns.forEach((btn) => {
                this.on(btn, 'click', () => {
                    this.closeMobileGuestMenu();
                    this.props.onLogin?.();
                });
            });

            registerBtns.forEach((btn) => {
                this.on(btn, 'click', () => {
                    this.closeMobileGuestMenu();
                    this.props.onRegister?.();
                });
            });

            const mobileControls = this.root?.querySelector('.js-mobile-guest-controls');
            const mobileToggle = this.root?.querySelector('.js-mobile-guest-toggle');

            if (mobileControls && mobileToggle) {
                this.on(mobileToggle, 'click', (event: Event) => {
                    event.stopPropagation();
                    mobileControls.classList.toggle('mobile-auth-guest-controls_open');
                });

                this.on(document, 'click', (event: Event) => {
                    const target = event.target as Node | null;
                    if (target && !mobileControls.contains(target)) {
                        mobileControls.classList.remove('mobile-auth-guest-controls_open');
                    }
                });
            }

            // if (loginBtn) this.on(loginBtn, 'click', () => this.props.onLogin?.());
            // if (registerBtn) this.on(registerBtn, 'click', () => this.props.onRegister?.());
        }

        this.useStore(userStore, (s) => s.user, (next) => {
            if (next !== this.props.user) this.update({ user: next });
        });
    }

    private closeMobileGuestMenu(): void {
        const mobileControls = this.root?.querySelector('.js-mobile-guest-controls');
        mobileControls?.classList.remove('mobile-auth-guest-controls_open');
    }
}
