import { Component } from '@shared/lib/component';
import { Popup } from '@shared/ui/popup';
import { cartStore } from '@entities/cart';
import { clearCart } from '../model/clearCart';

export interface ClearCartButtonProps {
    label?: string;
}

const TEMPLATE = `<button id="clear-cart-btn" class="button button_secondary">{{= it.label || 'Очистить' }}</button>`;

export class ClearCartButton extends Component<ClearCartButtonProps> {
    constructor() {
        super(TEMPLATE);
    }

    protected onMount(): void {
        const btn = this.root?.querySelector('button') as HTMLButtonElement | null;
        if (!btn) return;

        this.on(btn, 'click', async () => {
            try {
                await clearCart();
            } catch (e) {
                console.error('ClearCartButton.click', e);
                await Popup.alert('Не удалось очистить корзину. Попробуйте ещё раз.');
            }
        });

        this.useStore(
            cartStore,
            (s) => s.status,
            (status) => {
                btn.disabled = status === 'syncing';
            },
        );
    }
}
