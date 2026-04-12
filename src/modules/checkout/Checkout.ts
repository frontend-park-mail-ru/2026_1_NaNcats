import './checkout.scss';
import { Component } from '../../core/Component';
import { Ajax } from '../../core/Ajax';
import { checkoutTemplate } from './checkout.tmpl.js';
import { AddressPicker } from '../addressPicker/AddressPicker';
import { Cart } from '../cart/Cart';

export class Checkout extends Component {
    private cart: any = null;
    private addresses: any[] = [];
    private cards: any[] = [];
    private user: any = null;
    
    private selectedAddress: any = null;
    private selectedCard: any = null; // null означает "Новая карта / Стандартная оплата"

    private deliveryFee: number = 699;
    private serviceFee: number = 99;

    private addressPicker!: AddressPicker;

    constructor() {
        super(checkoutTemplate);
        
        // Инстанцируем AddressPicker для добавления новых адресов в модалке
        this.addressPicker = new AddressPicker(async (addr, coords) => {
            // При выборе адреса на карте и сохранении, он летит на бэкенд (если юзер авторизован)
            // Поэтому просто перезагружаем список адресов с сервера
            await this.loadData();
            // Выбираем только что добавленный (первый в списке)
            if (this.addresses.length > 0) {
                this.selectedAddress = this.addresses[0];
            }
            this.updateUI();
        });
    }

    public async mount(container: HTMLElement): Promise<void> {
        this.element = container;
        await this.loadData();

        if (!this.user) {
            window.router.go('/login');
            return;
        }

        // Проверяем, есть ли товары в корзине
        if (!this.cart || !this.cart.items || this.cart.items.length === 0) {
            window.router.go('/'); // Если корзина пуста, отправляем на главную
            return;
        }

        // Выбираем адрес по умолчанию (первый из списка, если есть)
        if (this.addresses.length > 0) {
            this.selectedAddress = this.addresses[0];
        }

        // Выбираем дефолтную карту, если есть (is_default === true)
        const defaultCard = this.cards.find(c => c.is_default);
        if (defaultCard) {
            this.selectedCard = defaultCard;
        }

        const backBtn = this.element.querySelector('.js-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => window.router.back());
        }

        this.updateUI();
    }

    private async loadData(): Promise<void> {
        try {
            const [cartRes, addrRes, cardsRes, userRes] = await Promise.all([
                Ajax.get('/cart'),
                Ajax.get('/profile/addresses'),
                Ajax.get('/profile/cards'),
                Ajax.get('/auth/me')
            ]);

            if (cartRes.ok) {
                this.cart = await cartRes.json();
            }
            if (addrRes.ok) {
                const addrData = await addrRes.json();
                this.addresses = addrData.addresses || [];
            }
            if (cardsRes.ok) {
                this.cards = await cardsRes.json();
            }
            if (userRes.ok) this.user = await userRes.json(); 
        } catch (e) {
            console.error("Ошибка загрузки данных для Checkout", e);
        }
    }

    private updateUI(): void {
        if (!this.element) return;

        let cartItemsTotal = 0;
        if (this.cart && this.cart.items) {
            cartItemsTotal = this.cart.items.reduce((sum: number, item: any) => sum + ((item.price / 1000000) * item.quantity), 0);
        }

        let grandTotal = 0;
        if (cartItemsTotal > 0) {
            grandTotal = cartItemsTotal + this.deliveryFee + this.serviceFee;
        }

        super.mount(this.element, {
            user: this.user,
            cart: this.cart,
            addresses: this.addresses,
            cards: this.cards,
            selectedAddress: this.selectedAddress,
            selectedCard: this.selectedCard,
            cartItemsTotal,
            deliveryFee: this.deliveryFee,
            serviceFee: this.serviceFee,
            grandTotal
        });
    }

    public afterRender(): void {
        if (!this.element) return;

        // Модалка корзины
        const cartModal = this.element.querySelector('.js-cart-modal');
        this.element.querySelector('.js-open-cart-modal')?.addEventListener('click', () => cartModal?.classList.add('modal-overlay_active'));
        this.element.querySelector('.js-close-cart-modal')?.addEventListener('click', () => cartModal?.classList.remove('modal-overlay_active'));

        // Модалка адресов
        const addressModal = this.element.querySelector('.js-address-modal');
        this.element.querySelectorAll('.js-open-address-modal').forEach(btn => {
            btn.addEventListener('click', () => addressModal?.classList.add('modal-overlay_active'));
        });
        this.element.querySelector('.js-close-address-modal')?.addEventListener('click', () => addressModal?.classList.remove('modal-overlay_active'));

        // Выбор адреса
        this.element.querySelectorAll('.js-select-address').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = (e.currentTarget as HTMLElement).dataset.id;
                this.selectedAddress = this.addresses.find(a => a.id === id);
                this.updateUI();
            });
        });

        // Кнопка "Добавить новый адрес" внутри модалки адресов
        const pickerContainer = this.element.querySelector('#checkout-address-picker-container') as HTMLElement;
        const addNewAddrBtn = this.element.querySelector('.js-add-new-address-btn');
        if (pickerContainer && addNewAddrBtn) {
            this.addressPicker.mount(pickerContainer, { hideInput: true });
            
            addNewAddrBtn.addEventListener('click', () => {
                addressModal?.classList.remove('modal-overlay_active');
                setTimeout(() => {
                    this.addressPicker.openMapModal();
                }, 100);
            });
        }

        // Модалка оплаты
        const paymentModal = this.element.querySelector('.js-payment-modal');
        this.element.querySelector('.js-open-payment-modal')?.addEventListener('click', () => paymentModal?.classList.add('modal-overlay_active'));
        this.element.querySelector('.js-close-payment-modal')?.addEventListener('click', () => paymentModal?.classList.remove('modal-overlay_active'));

        // Выбор карты
        this.element.querySelectorAll('.js-select-card').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = (e.currentTarget as HTMLElement).dataset.id;
                if (!id) {
                    this.selectedCard = null; // Выбрана стандартная новая оплата
                } else {
                    this.selectedCard = this.cards.find(c => c.id === id);
                }
                this.updateUI();
            });
        });

        // Кнопка Оплатить (Оформить заказ)
        const payBtn = this.element.querySelector('.js-pay-btn') as HTMLButtonElement;
        if (payBtn) {
            payBtn.addEventListener('click', async () => {
                await this.processCheckout();
            });
        }
    }

    private async processCheckout(): Promise<void> {
        const errContainer = this.element?.querySelector('#checkout-error') as HTMLElement;
        if (errContainer) errContainer.innerText = '';

        if (!this.selectedAddress) {
            if (errContainer) errContainer.innerText = 'Пожалуйста, выберите адрес доставки';
            return;
        }

        if (!this.cart || !this.cart.restaurant_id) {
            if (errContainer) errContainer.innerText = 'Ошибка корзины. Попробуйте перезагрузить страницу.';
            return;
        }

        const payload = {
            address_id: this.selectedAddress.id, // public_id адреса
            branch_id: this.cart.restaurant_id, // Бэкенд пока принимает restaurant_brand_id как branch_id для корзины (по логике order.go и handler'a)
            payment_method_id: this.selectedCard ? this.selectedCard.id : "" // Если пусто, бэк сгенерит ссылку на YooKassa
        };

        const btn = this.element?.querySelector('.js-pay-btn') as HTMLButtonElement;
        if (btn) {
            btn.disabled = true;
            btn.innerText = 'Оформляем...';
        }

        try {
            const res = await Ajax.post('/orders', payload);
            
            if (res.ok) {
                const data = await res.json();

                const cartInstance = new Cart();
                await cartInstance.clearCart(); 
                
                if (data.confirmation_url) {
                    window.location.href = data.confirmation_url;
                } else {
                    window.router.go('/profile');
                }
            } else {
                const errData = await res.json();
                if (errContainer) errContainer.innerText = errData.message || 'Произошла ошибка при оформлении заказа';
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Оплатить';
                }
            }
        } catch (e) {
            console.error(e);
            if (errContainer) errContainer.innerText = 'Ошибка соединения с сервером';
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Оплатить';
            }
        }
    }
}
