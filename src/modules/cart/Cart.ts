import './cart.scss';
import { Component } from '../../core/Component';
import { cartTemplate } from './cart.tmpl';
import { Ajax } from '../../core/Ajax';

export interface CartItem {
    dish_id: number;
    name: string;
    price: number;
    quantity: number;
    image_url: string;
}

export class Cart extends Component {
    private items: CartItem[] = [];
    private restaurantId: number = 0;

    constructor() {
        super(cartTemplate);
    }

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

    // Синхронизация локальной корзины с БД
    private async syncWithServer(): Promise<void> {
        try {
            const payload = {
                restaurant_id: this.restaurantId,
                items: this.items.map(i => ({ dish_id: i.dish_id, quantity: i.quantity }))
            };
            await Ajax.put('/cart', payload);
            // После успешного PUT можно еще раз сделать GET, чтобы получить правильные total_cost от сервера
            await this.loadCart(); 
        } catch (e) {
            console.error("Ошибка синхронизации корзины:", e);
        }
    }

    // Метод добавления блюда из меню
    public async addDish(dish: any, restId: number): Promise<void> {
        if (this.items.length > 0 && this.restaurantId !== restId) {
            const confirmClear = confirm("В корзине уже есть блюда из другого ресторана. Очистить корзину и добавить это блюдо?");
            if (confirmClear) {
                this.items = []; // Очищаем корзину
            } else {
                return; // Пользователь отменил добавление
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

    public async clearCart(): Promise<void> {
        this.items = [];
        this.restaurantId = 0;
        this.updateCartUI();
        await this.syncWithServer();
    }

    private getTotalCost(): number {
        return this.items.reduce((total, item) => total + ((item.price / 1000000) * item.quantity), 0);
    }

    private updateCartUI(): void {
        if (!this.element) return;
        super.mount(this.element, {
            items: this.items.map(item => ({...item, price: item.price / 1000000})),
            totalCost: this.getTotalCost()
        });
    }

    afterRender(): void {
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
    }

    mount(container: HTMLElement): void {
        this.element = container;
        this.updateCartUI();
        this.loadCart();
    }
}
