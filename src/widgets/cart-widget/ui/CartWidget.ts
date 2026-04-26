import './cartWidget.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { cartStore, fromMicros } from '@entities/cart';
import type { CartItem } from '@entities/cart';
import { ClearCartButton } from '@features/cart/clear-cart';
import { cartWidgetTemplate } from './cartWidget.tmpl.js';

interface CartItemView extends CartItem {
    priceRub: string;
}

interface CartWidgetProps {
    items: CartItemView[];
    totalRub: string;
}

const toView = (items: CartItem[]): CartItemView[] =>
    items.map((i) => ({ ...i, priceRub: fromMicros(i.price).toFixed(0) }));

const totalMicros = (items: CartItem[]): number =>
    items.reduce((sum, i) => sum + i.price * i.quantity, 0);

export class CartWidget extends Component<CartWidgetProps> {
    constructor() {
        super(cartWidgetTemplate);
    }

    protected slots = {
        clear: '.js-clear-slot',
    };

    static buildProps(items: CartItem[]): CartWidgetProps {
        return {
            items: toView(items),
            totalRub: fromMicros(totalMicros(items)).toFixed(0),
        };
    }

    protected onMount(): void {
        if (this.props.items.length > 0) {
            this.mountChild('clear', new ClearCartButton(), { label: 'Очистить' });
        }

        this.root?.querySelectorAll('.js-plus').forEach((btn) => {
            const id = Number((btn as HTMLElement).dataset.id);
            this.on(btn, 'click', () => void cartStore.changeQuantity(id, 1));
        });
        this.root?.querySelectorAll('.js-minus').forEach((btn) => {
            const id = Number((btn as HTMLElement).dataset.id);
            this.on(btn, 'click', () => void cartStore.changeQuantity(id, -1));
        });
        const checkout = this.root?.querySelector('.js-checkout-btn');
        if (checkout) this.on(checkout, 'click', () => window.router.go(ROUTES.checkout));

        this.useStore(cartStore, (s) => s.items, (items) => {
            this.update(CartWidget.buildProps(items));
        });
    }
}
