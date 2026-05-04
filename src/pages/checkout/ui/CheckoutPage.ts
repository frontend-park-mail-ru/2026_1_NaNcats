import './checkout.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { ApiError } from '@shared/api/http';
import { userStore } from '@entities/user';
import { addressStore, type Address } from '@entities/address';
import { cardStore, type Card } from '@entities/card';
import { cartApi, cartStore, fromMicros, toMicros, type CartItem } from '@entities/cart';
import { orderApi, type Order, type OrderCreatePayload } from '@entities/order';
import { restaurantApi } from '@entities/restaurant';
import { AddressPicker } from '@widgets/address-picker';
import { OrderStatusModal } from '@widgets/order-status';
import { checkoutPageTemplate } from './checkout.tmpl.js';

const DELIVERY_FEE_RUB = 699;
const SERVICE_FEE_RUB = 99;

interface CheckoutPageProps {
    items: CartItem[];
    restaurantId: number;
    restaurantName: string;
    restaurantLogoUrl: string;
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
    restaurantName: string,
    restaurantLogoUrl: string,
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
        restaurantName,
        restaurantLogoUrl,
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
    private orderStatusModal: OrderStatusModal | null = null;

    constructor() {
        super(checkoutPageTemplate);
    }

    protected slots = {
        picker: '.js-picker-slot',
        orderStatus: '.js-order-status-slot',
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

        let restaurantName = 'Заказ';
        let restaurantLogoUrl = '';
        try {
            const brand = await restaurantApi.getBrand(cart.restaurantId);
            restaurantName = brand.name || restaurantName;
            restaurantLogoUrl = brand.logo_url || '';
        } catch (e) {
            console.warn('checkout: getBrand failed', e);
        }

        return buildProps(
            cart.items,
            cart.restaurantId,
            restaurantName,
            restaurantLogoUrl,
            addresses,
            cards,
            selectedAddress,
            selectedCard,
        );
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
                        this.props.restaurantName,
                        this.props.restaurantLogoUrl,
                        fresh,
                        this.props.cards,
                        fresh[0] ?? this.props.selectedAddress,
                        this.props.selectedCard,
                    ),
                );
            },
        });

        this.orderStatusModal = new OrderStatusModal();
        this.mountChild('orderStatus', this.orderStatusModal, OrderStatusModal.initialProps());

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
                        this.props.restaurantName,
                        this.props.restaurantLogoUrl,
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
                        this.props.restaurantName,
                        this.props.restaurantLogoUrl,
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

        const assignedItems = await this.ensureAssignedItems(errEl);
        if (!assignedItems) {
            return;
        }

        const currentCart = cartStore.getState();
        const cartTotal = itemsTotalRub(assignedItems);
        if (cartTotal <= 0) return;

        const grand = cartTotal + DELIVERY_FEE_RUB + SERVICE_FEE_RUB;

        btn.disabled = true;
        btn.innerText = 'Оформляем...';

        const idempotencyKey = crypto.randomUUID();

        try {
            const result = await orderApi.create({
                address_id: this.props.selectedAddress.id,
                branch_id: currentCart.restaurantId,
                brand_id: currentCart.restaurantId,
                payment_method_id: this.props.selectedCard?.id ?? '',
                delivery_cost: toMicros(DELIVERY_FEE_RUB),
                service_fee: toMicros(SERVICE_FEE_RUB),
                total_cost: toMicros(grand),
                pay_for_all: true
            }, idempotencyKey);

            const orderSnapshot: Order = {
                order_id: result.order_id,
                status: 'created',
                total_cost: toMicros(grand),
                created_at: new Date().toLocaleDateString('ru-RU'),
                restaurant_id: currentCart.restaurantId,
                restaurant_name: this.props.restaurantName,
                restaurant_image_url: this.props.restaurantLogoUrl,
                items: assignedItems.map((i) => ({
                    dish_id: i.dish_id,
                    name: i.name,
                    quantity: i.quantity,
                    price: i.price,
                    image_url: i.image_url,
                })),
                service_fee: toMicros(SERVICE_FEE_RUB),
                delivery_cost: toMicros(DELIVERY_FEE_RUB),
                payment_url: result.confirmation_url,
            };

            await cartStore.clear();

            if (result.confirmation_url) {
                window.location.href = result.confirmation_url;
                return;
            }

            if (this.orderStatusModal) {
                this.orderStatusModal.open(orderSnapshot, {
                    subscribe: true,
                    onClose: () => window.router.go(ROUTES.home),
                });
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

    private async ensureAssignedItems(errEl: HTMLElement | null): Promise<CartItem[] | null> {
        const cart = cartStore.getState();
        const unassignedItems = cart.items.filter((item) => item.owner_user_id == null);

        if (!unassignedItems.length) {
            return cart.items;
        }

        if (cart.mode === 'solo' && cart.cartId && cart.adminId !== null) {
            try {
                await Promise.all(
                    unassignedItems.map((item) =>
                        cartApi.reassignOwner(cart.cartId as string, item.dish_id, cart.adminId as number),
                    ),
                );

                await cartStore.load();

                const freshCart = cartStore.getState();
                this.update(
                    buildProps(
                        freshCart.items,
                        freshCart.restaurantId,
                        this.props.restaurantName,
                        this.props.restaurantLogoUrl,
                        this.props.addresses,
                        this.props.cards,
                        this.props.selectedAddress,
                        this.props.selectedCard,
                    ),
                );

                if (freshCart.items.some((item) => item.owner_user_id == null)) {
                    if (errEl) {
                        errEl.innerText = 'В корзине остались позиции без владельца. Проверьте корзину.';
                    }
                    return null;
                }

                return freshCart.items;
            } catch (e) {
                console.error('checkout: auto-assign failed', e);
                if (errEl) {
                    errEl.innerText = 'Не удалось подготовить корзину к оплате. Попробуйте ещё раз.';
                }
                return null;
            }
        }

        if (errEl) {
            errEl.innerText =
                'В корзине есть позиции без плательщика. Назначьте владельца товарам перед оплатой.';
        }

        return null;
    }
}
