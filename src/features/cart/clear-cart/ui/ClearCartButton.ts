import { Component } from '@shared/lib/component';
import { Popup } from '@shared/ui/popup';
import { cartStore } from '@entities/cart';
import { clearCart } from '../model/clearCart';

/**
 * Параметры кнопки очистки корзины.
 */
export interface ClearCartButtonProps {
    /** Текст подписи кнопки; по умолчанию `Очистить`. */
    label?: string;
}

const TEMPLATE = `<button id="clear-cart-btn" class="button button_secondary">{{= it.label || 'Очистить' }}</button>`;

/**
 * Кнопка очистки корзины: при клике вызывает {@link clearCart} и блокирует
 * себя на время синхронизации корзины с сервером.
 */
export class ClearCartButton extends Component<ClearCartButtonProps> {
    constructor() {
        super(TEMPLATE);
    }

    /**
     * Подписывает обработчик клика и связывает доступность кнопки со статусом
     * хранилища корзины.
     */
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
