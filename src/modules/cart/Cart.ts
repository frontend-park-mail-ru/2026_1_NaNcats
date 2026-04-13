import './cart.scss';
import { Component } from '../../core/Component';
import { cartTemplate } from './cart.tmpl';
import { Ajax } from '../../core/Ajax';

/**
 * Интерфейс, описывающий элемент корзины (блюдо).
 * @interface CartItem
 */
export interface CartItem {
    /** @type {number} ID блюда */
    dish_id: number;
    /** @type {string} Название блюда */
    name: string;
    /** @type {number} Цена в копейках */
    price: number;
    /** @type {number} Количество товара */
    quantity: number;
    /** @type {string} Ссылка на изображение */
    image_url: string;
}

export interface DishToAdd {
    id: number;
    name: string;
    price: number;
    image_url: string;
}

interface CartResponse {
    items?: CartItem[];
    restaurant_id?: number;
}

/**
 * Компонент корзины покупок.
 * Управляет состоянием корзины, синхронизирует её с сервером.
 * 
 * @class Cart
 * @extends Component
 */
export class Cart extends Component {
    /** @type {CartItem[]} Массив товаров в корзине */
    private items: CartItem[] = [];
    
    /** @type {number} Идентификатор ресторана, к которому привязана корзина */
    private restaurantId: number = 0;

    /**
     * Создает экземпляр корзины.
     */
    constructor() {
        super(cartTemplate);
    }

    /**
     * Загружает данные корзины с сервера.
     * @returns {Promise<void>}
     */
    public async loadCart(): Promise<void> {
        try {
            const res = await Ajax.get('/cart');
            if (res.ok) {
                const data = await res.json();
                this.items = data.items || [];
                this.restaurantId = data.restaurant_id || 0;
                this.updateCartUI();
            }
        } catch (e) {
            console.error("Ошибка загрузки корзины:", e);
        }
    }

    /**
     * Синхронизирует локальное состояние корзины с базой данных сервера.
     * @private
     * @returns {Promise<void>}
     */
    private async syncWithServer(): Promise<void> {
        try {
            const payload = {
                restaurant_id: this.restaurantId,
                items: this.items.map(i => ({ dish_id: i.dish_id, quantity: i.quantity }))
            };
            await Ajax.put('/cart', payload);
            await this.loadCart(); 
        } catch (e) {
            console.error("Ошибка синхронизации корзины:", e);
        }
    }

    /**
     * Добавляет блюдо в корзину. Проверяет совместимость ресторанов.
     * @param {DishToAdd} dish - Объект добавляемого блюда.
     * @param {number} restId - ID ресторана, из которого добавляется блюдо.
     * @returns {Promise<void>}
     */
    public async addDish(dish: DishToAdd, restId: number): Promise<void> {
        if (this.items.length > 0 && this.restaurantId !== restId) {
            const confirmClear = confirm("В корзине уже есть блюда из другого ресторана. Очистить корзину и добавить это блюдо?");
            if (confirmClear) {
                this.items = []; 
            } else {
                return; 
            }
        }

        this.restaurantId = restId;
        const existing = this.items.find(i => i.dish_id === dish.id);
        
        if (existing) {
            existing.quantity += 1;
        } else {
            this.items.push({
                dish_id: dish.id,
                name: dish.name,
                price: dish.price,
                quantity: 1,
                image_url: dish.image_url
            });
        }

        this.updateCartUI();
        await this.syncWithServer();
    }

    /**
     * Изменяет количество конкретного товара в корзине.
     * @param {number} dishId - ID блюда.
     * @param {number} delta - Изменение количества (например, 1 или -1).
     * @returns {Promise<void>}
     */
    public async changeQuantity(dishId: number, delta: number): Promise<void> {
        const item = this.items.find(i => i.dish_id === dishId);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                this.items = this.items.filter(i => i.dish_id !== dishId);
            }
            this.updateCartUI();
            await this.syncWithServer();
        }
    }

    /**
     * Очищает корзину локально и на сервере.
     * @returns {Promise<void>}
     */
    public async clearCart(): Promise<void> {
        this.items = [];
        this.restaurantId = 0;
        this.updateCartUI();
        await this.syncWithServer();
    }

    /**
     * Вычисляет общую стоимость корзины.
     * @private
     * @returns {number} Сумма заказа.
     */
    private getTotalCost(): number {
        return this.items.reduce((total, item) => total + ((item.price / 1000000) * item.quantity), 0);
    }

    /**
     * Перерисовывает UI корзины на основе текущих данных.
     * @private
     * @returns {void}
     */
    private updateCartUI(): void {
        if (!this.element) return;
        super.mount(this.element, {
            items: this.items.map(item => ({...item, price: item.price / 1000000})),
            totalCost: this.getTotalCost()
        });
    }

    /**
     * Навешивает обработчики событий (плюс/минус, очистка, оформление заказа).
     * @override
     * @returns {void}
     */
    public afterRender(): void {
        if (!this.element) return;

        this.element.querySelectorAll('.plus').forEach(btn => {
            (btn as HTMLElement).onclick = (e) => {
                const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                if (id) this.changeQuantity(parseInt(id, 10), 1);
            };
        });

        this.element.querySelectorAll('.minus').forEach(btn => {
            (btn as HTMLElement).onclick = (e) => {
                const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                if (id) this.changeQuantity(parseInt(id, 10), -1);
            };
        });

        const clearBtn = this.element.querySelector('#clear-cart-btn') as HTMLElement;
        if (clearBtn) clearBtn.onclick = () => this.clearCart();

        const checkoutBtn = this.element.querySelector('#checkout-btn') as HTMLElement;
        if (checkoutBtn) {
            checkoutBtn.onclick = () => {
                window.router.go('/checkout');
            };
        }

        const tabs = this.element.querySelectorAll('.cart-tab');
        tabs.forEach(tab => {
            (tab as HTMLElement).onclick = (e: MouseEvent) => {
                tabs.forEach(t => t.classList.remove('active'));
                (e.currentTarget as HTMLElement).classList.add('active');
            };
        });
    }

    /**
     * Монтирует компонент корзины и загружает данные.
     * @override
     * @param {HTMLElement} container - Контейнер для отрисовки.
     * @returns {void}
     */
    public mount(container: HTMLElement): void {
        this.element = container;
        this.updateCartUI();
        this.loadCart();
    }
}
