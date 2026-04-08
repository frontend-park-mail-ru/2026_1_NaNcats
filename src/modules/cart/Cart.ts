import { Component } from '../../core/Component';
import { cartTemplate } from './cart.tmpl';
import './cart.css';

// Интерфейс для одного элемента корзины
export interface CartItem {
    dish_id: number;
    name: string;
    price: number;
    quantity: number;
    image_url: string;
}

// Интерфейс данных, которые передаются в шаблонизатор
interface CartTemplateData {
    items: CartItem[];
    totalCost: number;
}

export class Cart extends Component {
    private items: CartItem[];

    constructor() {
        super(cartTemplate);
        
        // ВРЕМЕННЫЕ МОК-ДАННЫЕ
        // Позже здесь будет пустой массив [], а данные будут загружаться через Ajax
        this.items = [
            { dish_id: 1, name: 'Чизбургер', price: 115, quantity: 1, image_url: 'https://placehold.co/40x40' },
            { dish_id: 2, name: 'Сырные палочки', price: 150, quantity: 2, image_url: 'https://placehold.co/40x40' },
            { dish_id: 3, name: 'Кола 0.5', price: 90, quantity: 1, image_url: 'https://placehold.co/40x40' }
        ];
    }

    /**
     * Вычисляет общую стоимость всех товаров в корзине
     */
    private getTotalCost(): number {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    /**
     * Перерисовывает компонент корзины с новыми данными
     */
    private updateCartUI(): void {
        if (!this.element) return;

        const data: CartTemplateData = {
            items: this.items,
            totalCost: this.getTotalCost()
        };

        // super.mount принимает элемент и данные для doT.js
        super.mount(this.element, data);
    }

    /**
     * Изменяет количество товара в корзине
     * @param dishId ID блюда
     * @param delta Изменение (+1 или -1)
     */
    public changeQuantity(dishId: number, delta: number): void {
        const item = this.items.find(i => i.dish_id === dishId);
        
        if (item) {
            item.quantity += delta;
            
            // Если количество стало 0 или меньше, удаляем товар
            if (item.quantity <= 0) {
                this.items = this.items.filter(i => i.dish_id !== dishId);
            }
            
            this.updateCartUI();
            
            // TODO: Отправка "бакета" на бэкенд (PUT /api/cart)
            // this.syncWithServer();
        }
    }

    /**
     * Полностью очищает корзину
     */
    public clearCart(): void {
        this.items = [];
        this.updateCartUI();
        // TODO: Отправка пустого бакета на бэкенд
    }

    /**
     * Метод жизненного цикла, вызывается после вставки HTML в DOM
     */
    afterRender(): void {
        if (!this.element) return;

        // Обработчики для кнопок "+"
        const plusButtons = this.element.querySelectorAll('.plus');
        plusButtons.forEach(btn => {
            (btn as HTMLElement).onclick = (e: MouseEvent) => {
                const target = e.currentTarget as HTMLElement;
                const idStr = target.getAttribute('data-id');
                if (idStr) {
                    this.changeQuantity(parseInt(idStr, 10), 1);
                }
            };
        });

        // Обработчики для кнопок "-"
        const minusButtons = this.element.querySelectorAll('.minus');
        minusButtons.forEach(btn => {
            (btn as HTMLElement).onclick = (e: MouseEvent) => {
                const target = e.currentTarget as HTMLElement;
                const idStr = target.getAttribute('data-id');
                if (idStr) {
                    this.changeQuantity(parseInt(idStr, 10), -1);
                }
            };
        });

        // Обработчик кнопки "Очистить"
        const clearBtn = this.element.querySelector('#clear-cart-btn') as HTMLElement;
        if (clearBtn) {
            clearBtn.onclick = () => this.clearCart();
        }
        
        // Визуальное переключение табов (Доставка / Самовывоз)
        const tabs = this.element.querySelectorAll('.cart-tab');
        tabs.forEach(tab => {
            (tab as HTMLElement).onclick = (e: MouseEvent) => {
                tabs.forEach(t => t.classList.remove('active'));
                (e.currentTarget as HTMLElement).classList.add('active');
            };
        });
    }

    /**
     * Первичная инициализация компонента
     * @param container DOM-элемент, куда вставляется корзина
     */
    mount(container: HTMLElement): void {
        this.element = container;
        this.updateCartUI();
    }
}