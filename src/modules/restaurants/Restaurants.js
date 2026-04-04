import './restaurants.css';
import { Component } from '../../core/Component.js';
import { Ajax } from '../../core/Ajax.js';
import { restaurantsTemplate } from "./restaurants.tmpl.js"

/**
 * Компонент главной страницы, отображающий список ресторанов.
 * Реализует бесконечную подгрузку данных при скролле и отображение профиля пользователя.
 * 
 * @class Restaurants
 * @extends Component
 */
export class Restaurants extends Component {
    constructor() {
        super(restaurantsTemplate);

        /** 
         * Количество ресторанов, запрашиваемых за один раз.
         * @type {number} 
         */
        this.limit = 20;

        /** 
         * Смещение для пагинации данных.
         * @type {number} 
         */
        this.offset = 0;

        /** 
         * Статус выполнения асинхронного запроса в данный момент.
         * @type {boolean} 
         */
        this.isFetching = false;

        /** 
         * Флаг наличия доступных данных для дальнейшей подгрузки.
         * @type {boolean} 
         */
        this.hasMore = true;

        /**
         * Адреса пользователя
         * @type {Array}
         */
        this.savedAddresses = ['Ленинградский проспект, 39с79', 'Ленинградский проспект, 55', 'ул. Пушкина, 10'];

        /**
         * Ключ для апи геосаджеста яндекса
         * @type {string}
         */
        this.suggestKey = process.env.YANDEX_SUGGEST_KEY;

        this.map = null;
        this.selectedCoords = [55.75, 37.61]; // Москва
        
        /** @private */
        this.handleScroll = this.handleScroll.bind(this);
    }

    /**
     * Выполняет первичную загрузку данных пользователя и списка ресторанов.
     * @param {HTMLElement} container - Элемент, в который будет вставлен список.
     * @override
     * @returns {Promise<void>}
     */
    async mount(container) {
        this.offset = 0;
        this.hasMore = true;
        let restaurants = [];
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

        const savedAddr = localStorage.getItem('delivery_address');

        super.mount(container, { restaurants, user, currentAddress: savedAddr});
        if (savedAddr) {
            const input = document.getElementById('address-input');
            if (input) input.value = savedAddr;
        }
    }

    /**
     * Выполняет выход пользователя из системы и перенаправляет на главную.
     * @returns {Promise<void>}
     */
    async handleLogout() {
        const res = await Ajax.post('/auth/logout');
        if (res.ok) {
            window.router.go('/');
        }
    }

    /**
     * Переход на страницу авторизации.
     * @returns {void}
     */
    handleLoginRedirect() {
        window.router.go('/login');
    }

    /**
     * Переход на страницу регистрации.
     * @returns {void}
     */
    handleRegisterRedirect() {
        window.router.go('/register');
    }

    /**
     * Запрашивает порцию данных о ресторанах с сервера.
     * @async
     * @returns {Promise<Array<Object>>} Массив объектов ресторанов.
     */
    async fetchRestaurants() {
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
    async handleScroll() {
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
    appendRestaurants(restaurants) {
        const grid = document.querySelector('.res-grid');
        if (!grid) return;

        restaurants.forEach(res => {
            const cardHtml = `
                <div class="res-card">
                    <img class="res-rect" src="${res.logo_url}" alt="${res.name}"
                    onerror="this.src='https://placehold.co/400x225/png?text=${res.name}'">
                    <div class="res-info">
                        <span class="res-name">${res.name}</span>
                    </div>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    /**
     * Метод для поиска через геосаджест яндекса
     * @override
     * @returns {Array}
     */
    async fetchYandexSuggestions(query) {
        try {
            const response = await fetch(
                `https://suggest-maps.yandex.ru/v1/suggest?text=${encodeURIComponent(query)}&lang=ru_RU&apikey=${this.suggestKey}`
            );
            const data = await response.json();
            return data.results.map(item => item.title.text);
        } catch (e) {
            console.error("Yandex Suggest Error:", e);
            return [];
        }
    }

    renderSuggestions(addresses) {
        const container = document.getElementById('address-suggestions');
        if (!container) return;

        if (addresses.length === 0) {
            container.innerHTML = '<div class="address-dropdown__item">Ничего не найдено</div>';
            return;
        }

        container.innerHTML = addresses.map(addr => `
            <div class="address-dropdown__item" data-address="${addr}">${addr}</div>
        `).join('');

        container.querySelectorAll('.address-dropdown__item').forEach(item => {
            item.onclick = (e) => {
                const selected = e.target.getAttribute('data-address');
                this.selectAddress(selected);
            };
        });
    }

    selectAddress(address) {
        const input = document.getElementById('address-input');
        input.value = address;
        localStorage.setItem('delivery_address', address);
        document.getElementById('address-dropdown').classList.remove('active');
    }

    initMap() {
        if (this.map) return;

        this.map = new ymaps.Map("yandex-map", {
            center: this.selectedCoords,
            zoom: 16,
            controls: []
        });

        this.map.events.add('actionend', () => {
            const center = this.map.getCenter();
            this.reverseGeocode(center);
        });
    }

    async reverseGeocode(coords) {
        try {
            const res = await ymaps.geocode(coords);
            const firstGeoObject = res.geoObjects.get(0);
            const address = firstGeoObject.getAddressLine();
            
            document.getElementById('modal-address-input').value = address;
        } catch (e) {
            console.error("Geocode error", e);
        }
    }

    async forwardGeocode(address) {
        try {
            const res = await ymaps.geocode(address);
            const coords = res.geoObjects.get(0).geometry.getCoordinates();
            this.map.setCenter(coords, 16);
        } catch (e) {
            console.error("Forward geocode error", e);
        }
    }

    /**
     * Устанавливает обработчики событий для кнопок навигации и контейнера прокрутки.
     * @override
     * @returns {void}
     */
    afterRender() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => this.handleLogout();
        }

        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.onclick = () => this.handleLoginRedirect();
        }

        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) {
            registerBtn.onclick = () => this.handleRegisterRedirect();
        }

        const scrollContainer = document.querySelector('.center-column');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', this.handleScroll);
        }

        const addressInput = document.getElementById('address-input');
        const addressDropdown = document.getElementById('address-dropdown');

        if (addressInput) {
            addressInput.onfocus = () => {
                addressDropdown.classList.add('active');
                if (addressInput.value.trim() === '') {
                    this.renderSuggestions(this.savedAddresses);
                }
            };

            addressInput.oninput = (e) => {
                const query = e.target.value.trim();
                addressDropdown.classList.add('active');

                clearTimeout(this.debounceTimer);

                if (query.length === 0) {
                    this.renderSuggestions(this.savedAddresses);
                    return;
                }

                this.debounceTimer = setTimeout(async () => {
                    const results = await this.fetchYandexSuggestions(query);
                    this.renderSuggestions(results);
                }, 400);
            };
        }

        document.addEventListener('click', (e) => {
            if (!document.getElementById('address-container').contains(e.target)) {
                addressDropdown.classList.remove('active');
            }
        });

        const openMapBtn = document.getElementById('open-map-btn');
        const mapModal = document.getElementById('map-modal');
        const modalInput = document.getElementById('modal-address-input');

        openMapBtn.onclick = () => {
            mapModal.classList.add('active');
            ymaps.ready(() => this.initMap());
        };

        document.getElementById('close-map-modal').onclick = () => {
            mapModal.classList.remove('active');
        };

        modalInput.oninput = async (e) => {
            const query = e.target.value;
            if (query.length > 2) {
                const suggestions = await this.fetchYandexSuggestions(query);
                this.renderModalSuggestions(suggestions);
            }
        };

        document.getElementById('confirm-address-btn').onclick = () => {
            const finalAddress = modalInput.value;
            this.selectAddress(finalAddress);
            mapModal.classList.remove('active');
        };
    }

    renderModalSuggestions(list) {
        const container = document.getElementById('modal-suggestions');
        container.innerHTML = list.map(addr => `
            <div class="modal-suggestion-item">${addr}</div>
        `).join('');

        container.querySelectorAll('.modal-suggestion-item').forEach(item => {
            item.onclick = () => {
                const addr = item.innerText;
                document.getElementById('modal-address-input').value = addr;
                this.forwardGeocode(addr);
                container.innerHTML = '';
            };
        });
    }
}
