import { Component } from '@shared/lib/component';
import { userStore, type User } from '@entities/user';
import { restaurantApi, type SearchAllResult } from '@entities/restaurant';
import { ROUTES } from '@shared/config/routes';
import { LogoutButton } from '@features/auth/logout';
import { headerTemplate } from './header.tmpl.js';

export type HeaderMode = 'default' | 'back';

export interface HeaderProps {
    user: User | null;
    mode?: HeaderMode;
    searchQuery?: string;
    hideSearch?: boolean;
    onLogin?: () => void;
    onRegister?: () => void;
    onLoggedOut?: () => void;
    onBack?: () => void;
    onMountAddressSlot?: (slot: HTMLElement) => void;
    onSearchSubmit?: (query: string) => void;
}

const SEARCH_DEBOUNCE_MS = 350;

export class Header extends Component<HeaderProps> {
    private searchTimer: ReturnType<typeof setTimeout> | null = null;

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

        this.setupHeaderSearch();

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
        }

        this.useStore(userStore, (s) => s.user, (next) => {
            if (next !== this.props.user) this.update({ user: next });
        });
    }

    private setupHeaderSearch(): void {
        const input = this.root?.querySelector('.js-header-search-input') as HTMLInputElement | null;
        const clear = this.root?.querySelector('.js-header-search-clear') as HTMLElement | null;
        const suggest = this.root?.querySelector('.js-header-search-suggest') as HTMLElement | null;
        if (!input) return;

        const submit = (q: string) => {
            if (this.props.onSearchSubmit) {
                this.props.onSearchSubmit(q);
            } else {
                const url = q ? `${ROUTES.home}?q=${encodeURIComponent(q)}` : ROUTES.home;
                window.router.go(url);
            }
        };

        this.on(input, 'input', () => {
            const q = input.value.trim();
            if (clear) clear.style.display = q ? 'flex' : 'none';

            if (this.searchTimer !== null) clearTimeout(this.searchTimer);

            if (!q) {
                if (suggest) suggest.style.display = 'none';
                return;
            }

            this.searchTimer = setTimeout(async () => {
                this.searchTimer = null;
                try {
                    const results = await restaurantApi.searchAll(q, 5);
                    this.renderSuggest(results, suggest);
                } catch {
                    // ignore
                }
            }, SEARCH_DEBOUNCE_MS);
        });

        this.on(input, 'keydown', (e) => {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Enter') {
                if (this.searchTimer !== null) {
                    clearTimeout(this.searchTimer);
                    this.searchTimer = null;
                }
                if (suggest) suggest.style.display = 'none';
                submit(input.value.trim());
            } else if (ke.key === 'Escape') {
                if (suggest) suggest.style.display = 'none';
            }
        });

        if (clear) {
            this.on(clear, 'click', () => {
                input.value = '';
                clear.style.display = 'none';
                if (suggest) suggest.style.display = 'none';
                submit('');
            });
        }

        this.on(document, 'click', (e) => {
            if (!suggest) return;
            const target = e.target as Node;
            if (!input.contains(target) && !suggest.contains(target)) {
                suggest.style.display = 'none';
            }
        });
    }

    private renderSuggest(results: SearchAllResult, suggest: HTMLElement | null): void {
        if (!suggest) return;

        const totalCount = results.restaurants.length + results.dishes.length;
        if (totalCount === 0) {
            suggest.style.display = 'none';
            return;
        }

        const restaurantItems = results.restaurants
            .map(
                (r) => `
                <div class="search-suggest__item" data-kind="restaurant" data-id="${r.id}">
                    <span class="search-suggest__icon">🏠</span>
                    <span class="search-suggest__name">${r.name}</span>
                </div>`,
            )
            .join('');

        const dishItems = results.dishes
            .map(
                (d) => `
                <div class="search-suggest__item" data-kind="dish" data-restaurant-id="${d.restaurant_brand_id}" data-dish-id="${d.id}">
                    <span class="search-suggest__icon">🍽</span>
                    <span class="search-suggest__name">${d.name}</span>
                </div>`,
            )
            .join('');

        suggest.innerHTML = restaurantItems + dishItems;
        suggest.style.display = 'block';

        suggest.querySelectorAll('.search-suggest__item').forEach((el) => {
            el.addEventListener('click', () => {
                const kind = (el as HTMLElement).dataset.kind;
                if (kind === 'dish') {
                    const restaurantId = (el as HTMLElement).dataset.restaurantId;
                    const dishId = (el as HTMLElement).dataset.dishId;
                    if (restaurantId) {
                        const url = `${ROUTES.restaurant}?id=${encodeURIComponent(restaurantId)}`
                            + (dishId ? `&dish=${encodeURIComponent(dishId)}` : '');
                        window.router.go(url);
                    }
                    return;
                }
                const id = (el as HTMLElement).dataset.id;
                if (id) window.router.go(`${ROUTES.restaurant}?id=${encodeURIComponent(id)}`);
            });
        });
    }

    private closeMobileGuestMenu(): void {
        const mobileControls = this.root?.querySelector('.js-mobile-guest-controls');
        mobileControls?.classList.remove('mobile-auth-guest-controls_open');
    }
}
