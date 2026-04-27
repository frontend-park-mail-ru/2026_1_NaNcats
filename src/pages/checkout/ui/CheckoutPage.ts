import './checkout.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { ApiError } from '@shared/api/http';
import { userStore } from '@entities/user';
import { addressStore, type Address } from '@entities/address';
import { cardStore, type Card } from '@entities/card';
import { cartStore, fromMicros, toMicros, type CartItem } from '@entities/cart';
import { orderApi } from '@entities/order';
import { AddressPicker } from '@widgets/address-picker';
import { checkoutPageTemplate } from './checkout.tmpl.js';

const DELIVERY_FEE_RUB = 699;
const SERVICE_FEE_RUB = 99;

interface CheckoutPageProps {
    items: CartItem[];
    restaurantId: number;
    addresses: Address[];
    cards: Card[];
    selectedAddress: Address | null;
    selectedCard: Card | null;
    cartItemsTotal: string;
    deliveryFee: string;
    serviceFee: string;
    grandTotal: string;
}

const itemsTotalRub = (items: CartItem[]): number =>
    items.reduce((sum, i) => sum + fromMicros(i.price) * i.quantity, 0);

const buildProps = (
    items: CartItem[],
    restaurantId: number,
    addresses: Address[],
    cards: Card[],
    selectedAddress: Address | null,
    selectedCard: Card | null,
): CheckoutPageProps => {
    const cartTotal = itemsTotalRub(items);
    const grand = cartTotal > 0 ? cartTotal + DELIVERY_FEE_RUB + SERVICE_FEE_RUB : 0;
    return {
        items,
        restaurantId,
        addresses,
        cards,
        selectedAddress,
        selectedCard,
        cartItemsTotal: cartTotal.toFixed(2),
        deliveryFee: DELIVERY_FEE_RUB.toFixed(2),
        serviceFee: SERVICE_FEE_RUB.toFixed(2),
        grandTotal: grand.toFixed(2),
    };
};

export class CheckoutPage extends Component<CheckoutPageProps> {
    private picker: AddressPicker | null = null;

    constructor() {
        super(checkoutPageTemplate);
    }

    protected slots = {
        picker: '.js-picker-slot',
    };

    static async load(): Promise<CheckoutPageProps> {
        try {
            await userStore.loadCurrent();
        } catch (e) {
            console.warn('checkout: loadCurrent failed', e);
        }
        if (!userStore.getState().user) {
            window.router.go(ROUTES.login);
            return Promise.reject(new Error('not authenticated'));
        }
        await Promise.allSettled([
            addressStore.loadSaved(),
            cardStore.load(),
            cartStore.load(),
        ]);
        const cart = cartStore.getState();
        if (!cart.items.length) {
            window.router.go(ROUTES.home);
            return Promise.reject(new Error('cart empty'));
        }
        const addresses = addressStore.getState().saved;
        const cards = cardStore.getState().cards;
        const selectedAddress = addresses[0] ?? null;
        const selectedCard = cards.find((c) => c.is_default) ?? null;
        return buildProps(cart.items, cart.restaurantId, addresses, cards, selectedAddress, selectedCard);
    }

    protected onMount(): void {
        this.picker = new AddressPicker();
        this.mountChild('picker', this.picker, {
            hideInput: true,
            skipDetails: false,
            onSelect: () => {
                const fresh = addressStore.getState().saved;
                this.update(
                    buildProps(
                        this.props.items,
                        this.props.restaurantId,
                        fresh,
                        this.props.cards,
                        fresh[0] ?? this.props.selectedAddress,
                        this.props.selectedCard,
                    ),
                );
            },
        });

        this.bindModals();
        this.bindSelections();
        this.bindPay();
    }

    private bindModals(): void {
        const r = this.root;
        if (!r) return;
        const cartModal = r.querySelector('.js-cart-modal');
        const addressModal = r.querySelector('.js-address-modal');
        const paymentModal = r.querySelector('.js-payment-modal');

        const open = (el: Element | null) => el?.classList.add('modal-overlay_active');
        const close = (el: Element | null) => el?.classList.remove('modal-overlay_active');

        r.querySelectorAll('.js-open-cart-modal').forEach((b) => this.on(b, 'click', () => open(cartModal)));
        const closeCart = r.querySelector('.js-close-cart-modal');
        if (closeCart) this.on(closeCart, 'click', () => close(cartModal));

        r.querySelectorAll('.js-open-address-modal').forEach((b) => this.on(b, 'click', () => open(addressModal)));
        const closeAddr = r.querySelector('.js-close-address-modal');
        if (closeAddr) this.on(closeAddr, 'click', () => close(addressModal));

        const openPay = r.querySelector('.js-open-payment-modal');
        if (openPay) this.on(openPay, 'click', () => open(paymentModal));
        const closePay = r.querySelector('.js-close-payment-modal');
        if (closePay) this.on(closePay, 'click', () => close(paymentModal));

        const addNew = r.querySelector('.js-add-new-address-btn');
        if (addNew) {
            this.on(addNew, 'click', () => {
                close(addressModal);
                setTimeout(() => void this.picker?.openMapModal(), 100);
            });
        }
    }

    private bindSelections(): void {
        const r = this.root;
        if (!r) return;
        r.querySelectorAll('.js-select-address').forEach((el) => {
            this.on(el, 'click', () => {
                const id = (el as HTMLElement).dataset.id;
                const next = this.props.addresses.find((a) => a.id === id) ?? null;
                this.update(
                    buildProps(
                        this.props.items,
                        this.props.restaurantId,
                        this.props.addresses,
                        this.props.cards,
                        next,
                        this.props.selectedCard,
                    ),
                );
            });
        });

        r.querySelectorAll('.js-select-card').forEach((el) => {
            this.on(el, 'click', () => {
                const id = (el as HTMLElement).dataset.id;
                const next = id ? this.props.cards.find((c) => c.id === id) ?? null : null;
                this.update(
                    buildProps(
                        this.props.items,
                        this.props.restaurantId,
                        this.props.addresses,
                        this.props.cards,
                        this.props.selectedAddress,
                        next,
                    ),
                );
            });
        });
    }

    private bindPay(): void {
        const btn = this.root?.querySelector('.js-pay-btn') as HTMLButtonElement | null;
        if (!btn) return;
        this.on(btn, 'click', () => void this.processCheckout(btn));
    }

    private async processCheckout(btn: HTMLButtonElement): Promise<void> {
        const errEl = this.root?.querySelector('.js-checkout-error') as HTMLElement | null;
        if (errEl) errEl.innerText = '';

        if (!this.props.selectedAddress) {
            if (errEl) errEl.innerText = 'Пожалуйста, выберите адрес доставки';
            return;
        }
        if (!this.props.restaurantId) {
            if (errEl) errEl.innerText = 'Ошибка корзины. Попробуйте перезагрузить страницу.';
            return;
        }

        const cartTotal = itemsTotalRub(this.props.items);
        if (cartTotal <= 0) return;
        const grand = cartTotal + DELIVERY_FEE_RUB + SERVICE_FEE_RUB;

        btn.disabled = true;
        btn.innerText = 'Оформляем...';

        try {
            const result = await orderApi.create({
                address_id: this.props.selectedAddress.id,
                branch_id: this.props.restaurantId,
                payment_method_id: this.props.selectedCard?.id ?? '',
                delivery_cost: toMicros(DELIVERY_FEE_RUB),
                service_fee: toMicros(SERVICE_FEE_RUB),
                total_cost: toMicros(grand),
            });
            await cartStore.clear();
            if (result.confirmation_url) {
                window.location.href = result.confirmation_url;
            } else {
                window.router.go(ROUTES.profile);
            }
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Ошибка соединения с сервером';
            if (errEl) errEl.innerText = msg || 'Произошла ошибка при оформлении заказа';
            btn.disabled = false;
            btn.innerText = 'Оплатить';
        }
    }
}
