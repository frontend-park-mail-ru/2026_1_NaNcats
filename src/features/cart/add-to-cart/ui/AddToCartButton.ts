import { Component } from '@shared/lib/component';
import { Popup } from '@shared/ui/popup';
import { userStore } from '@entities/user';
import { addToCart } from '../model/addToCart';
import type { DishToAdd, CartConfirmer } from '@entities/cart';

export interface AddToCartButtonProps {
    dish: DishToAdd;
    restaurantId: number;
    label?: string;
    onUnauthenticated?: () => void;
    confirm?: CartConfirmer;
}

const TEMPLATE = `<button class="button button_primary js-add-to-cart" type="button">{{= it.label || 'В корзину' }}</button>`;

export class AddToCartButton extends Component<AddToCartButtonProps> {
    constructor() {
        super(TEMPLATE);
    }

    protected onMount(): void {
        const btn = this.root?.querySelector('button');
        if (!btn) return;
        this.on(btn, 'click', () => void this.handle());
    }

    private async handle(): Promise<void> {
        const { user } = userStore.getState();
        if (!user) {
            this.props.onUnauthenticated?.();
            return;
        }

        const confirmer: CartConfirmer =
            this.props.confirm ??
            (() =>
                Popup.confirm('В корзине уже есть блюда из другого ресторана. Очистить корзину и добавить это блюдо?'));

        try {
            await addToCart(this.props.dish, this.props.restaurantId, confirmer);
        } catch (e) {
            console.error('AddToCartButton.handle', e);
            await Popup.alert('Не удалось добавить товар в корзину. Попробуйте ещё раз.');
        }
    }
}
