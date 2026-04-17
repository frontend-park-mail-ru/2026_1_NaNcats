import './restaurants.scss';
import { Component } from '../../core/Component';
import { Ajax } from '../../core/Ajax';
import { restaurantsTemplate } from "./restaurants.tmpl.js";
import { AddressPicker } from '../addressPicker/AddressPicker';
import { Cart } from '../cart/Cart';

interface RestaurantItem {
    id: string | number;
    name: string;
    logo_url: string;
}

interface UserInfo {
    avatar_url?: string;
}

/**
 * Интерфейс для элемента адреса из API профиля.
 * @interface AddressListItem
 */
interface AddressListItem {
    location: {
        address_text: string;
    };
}

/**
 * Компонент главной страницы, отображающий список ресторанов.
 * Реализует бесконечную подгрузку данных при скролле и отображение профиля пользователя.
 * 
 * @class Restaurants
 * @extends Component
 */
export class Restaurants extends Component {
    /** 
     * Количество ресторанов, запрашиваемых за один раз.
     * @type {number} 
     */
    private limit: number;

    /** 
     * Смещение для пагинации данных.
     * @type {number} 
     */
    private offset: number;

    /** 
     * Статус выполнения асинхронного запроса в данный момент.
     * @type {boolean} 
     */
    private isFetching: boolean;

    /** 
     * Флаг наличия доступных данных для дальнейшей подгрузки.
     * @type {boolean} 
     */
    private hasMore: boolean;

    /**
     * Пользователь 
     * @type {UserInfo | null}
     */
    private user: UserInfo | null;

    constructor() {
        super(restaurantsTemplate);

        this.limit = 20;
        this.offset = 0;
        this.isFetching = false;
        this.hasMore = true;
        this.user = null;
        
        this.handleScroll = this.handleScroll.bind(this);
    }

    /**
     * Выполняет первичную загрузку данных пользователя и списка ресторанов.
     * @param {HTMLElement} container - Элемент, в который будет вставлен список.
     * @override
     * @returns {Promise<void>}
     */
    public async mount(container: HTMLElement): Promise<void> {
        this.offset = 0;
        this.hasMore = true;
        let restaurants: RestaurantItem[] = [];
        let user = null;

        try {
            const userResponse = await Ajax.get('/auth/me');
            if (userResponse.ok) {
                user = await userResponse.json();
            }

            restaurants = await this.fetchRestaurants();
        } catch (e) {
            console.warn("Ошибка при получении данных:", e);
        }

        this.user = user;
        const savedAddr = localStorage.getItem('delivery_address');

        super.mount(container, { restaurants, user, currentAddress: savedAddr });
        
        if (savedAddr) {
            const input = document.getElementById('address-input') as HTMLInputElement | null;
            if (input) input.value = savedAddr;
        }
    }

    /**
     * Выполняет выход пользователя из системы и перенаправляет на главную.
     * @returns {Promise<void>}
     */
    private async handleLogout(): Promise<void> {
        const res = await Ajax.post('/auth/logout');
        if (res.ok) {
            Ajax.clearCsrfToken();
            window.router.go('/');
        }
    }

    /**
     * Переход на страницу авторизации.
     * @returns {void}
     */
    private handleLoginRedirect(): void {
        window.router.go('/login');
    }

    /**
     * Переход на страницу регистрации.
     * @returns {void}
     */
    private handleRegisterRedirect(): void {
        window.router.go('/register');
    }

    /**
     * Запрашивает порцию данных о ресторанах с сервера.
     * @async
     * @returns {Promise<Array<Object>>} Массив объектов ресторанов.
     */
    private async fetchRestaurants(): Promise<RestaurantItem[]> {
        if (this.isFetching || !this.hasMore) return [];
        
        this.isFetching = true;
        try {
            const resResponse = await Ajax.get(`/restaurants/brands?limit=${this.limit}&offset=${this.offset}`);
            if (resResponse.ok) {
                const data = await resResponse.json();
                const newRestaurants = data.restaurants || [];
                
                if (newRestaurants.length < this.limit) {
                    this.hasMore = false;
                }
                
                this.offset += this.limit;
                return newRestaurants;
            }
        } catch (e) {
            console.error("Ошибка при подгрузке ресторанов:", e);
        } finally {
            this.isFetching = false;
        }
        return [];
    }

    /**
     * Обработчик события прокрутки. Инициирует подгрузку при достижении порога в 200px до конца.
     * @returns {Promise<void>}
     */
    private async handleScroll(): Promise<void> {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight;

        if (scrollHeight - scrollTop - clientHeight < 200) {
            const newRestaurants = await this.fetchRestaurants();
            if (newRestaurants.length > 0) {
                this.appendRestaurants(newRestaurants);
            }
        }
    }

    /**
     * Добавляет новые карточки ресторанов в DOM без полной перерисовки страницы.
     * @param {Array<Object>} restaurants - Массив новых объектов ресторанов.
     */
    private appendRestaurants(restaurants: RestaurantItem[]): void {
        const grid = document.querySelector('.res-grid');
        if (!grid) return;

        restaurants.forEach(res => {
            const cardHtml = `
            <div class="res-card" data-id="${res.id}">
                <img class="res-card__rect" src="${res.logo_url}" alt="${res.name}"
                onerror="this.src='https://placehold.co/400x225/png?text=${res.name}'">
                <div class="res-card__info">
                    <span class="res-card__name">${res.name}</span>
                    <span class="res-card__desc">Пицца, суши, роллы</span>
                </div>
            </div>
            `;
            grid.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    /**
     * Рисует стрик.
     */
    private renderStreakWidget(streakWeeks = 6, dotsCount = 6): void {
        const widget = document.getElementById('streak-widget') as HTMLElement | null;
        if (!widget) return;

        const raw = widget.dataset.streak;
        const streak = Math.max(0, parseInt(raw || String(streakWeeks), 10) || 0);

        const valueEl = widget.querySelector('.js-streak-value') as HTMLElement | null;
        if (valueEl) valueEl.textContent = String(streak);

        const track = widget.querySelector('.js-streak-track') as HTMLElement | null;
        if (!track) return;

        // окно недель: последняя точка = "следующая неделя"
        const startWeek = Math.max(1, streak - (dotsCount - 2));

        track.innerHTML = '';

        for (let i = 0; i < dotsCount; i++) {
            const w = startWeek + i;

            const dot = document.createElement('span');
            dot.setAttribute('role', 'listitem');

            let className = 'streak-dot';
            if (w <= streak) className += ' streak-dot_filled';
            if (w === streak) className += ' streak-dot_current';

            dot.className = className;
            dot.title = `Неделя ${w}`;
            dot.setAttribute('aria-label', `Неделя ${w}`);

            track.appendChild(dot);
        }
    }

    /**
     * Устанавливает обработчики событий для кнопок навигации и контейнера прокрутки.
     * @override
     * @returns {void}
     */
    public afterRender(): void {
        const logoutBtn = document.getElementById('logout-btn') as HTMLElement | null;
        if (logoutBtn) logoutBtn.onclick = () => this.handleLogout();

        const loginBtn = document.getElementById('login-btn') as HTMLElement | null;
        if (loginBtn) loginBtn.onclick = () => this.handleLoginRedirect();

        const registerBtn = document.getElementById('register-btn') as HTMLElement | null;
        if (registerBtn) registerBtn.onclick = () => this.handleRegisterRedirect();

        const scrollContainer = document.querySelector('.center-column');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', this.handleScroll);
        }

        const grid = document.querySelector('.res-grid');
        if (grid) {
            grid.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const card = target.closest('.res-card') as HTMLElement | null;
            if (!card) return;

            const id = card.dataset.id;
            if (!id) return;

            window.router.go(`/restaurant?id=${encodeURIComponent(id)}`);
            });
        }

        const addressSlot = document.getElementById('address-picker-placeholder');
        if (addressSlot) {
            const addressPicker = new AddressPicker((addr: string, coords: [number, number]) => {
                localStorage.setItem('delivery_address', addr);
                localStorage.setItem('delivery_coords', JSON.stringify(coords));
            });

            const savedAddr = localStorage.getItem('delivery_address') || '';
            const isAuth = !!this.user;
            
            if (isAuth) {
                Ajax.get('/profile/addresses').then(res => res.json()).then(data => {
                    const userAddresses = data.addresses ? data.addresses.map((a: AddressListItem) => a.location.address_text) : [];
                    addressPicker.mount(addressSlot, { 
                        currentAddress: savedAddr, 
                        savedAddresses: userAddresses,
                        isAuth: true
                    });
                }).catch(() => {
                    addressPicker.mount(addressSlot, { 
                        currentAddress: savedAddr, 
                        savedAddresses: [],
                        isAuth: true
                    });
                });
            } else {
                addressPicker.mount(addressSlot, { 
                    currentAddress: savedAddr, 
                    savedAddresses: [],
                    isAuth: false
                });
            }
        }

        const cartContainer = document.getElementById('cart-widget-container');
        if (cartContainer) {
            const cartWidget = new Cart();
            cartWidget.mount(cartContainer);
        } else {
            console.error("Не найден контейнер #cart-widget-container");
        }

        this.renderStreakWidget(6, 6);
    }
}
