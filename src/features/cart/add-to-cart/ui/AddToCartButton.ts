import { Component } from '@shared/lib/component';
import { Popup } from '@shared/ui/popup';
import { userStore } from '@entities/user';
import { addToCart } from '../model/addToCart';
import type { DishToAdd, CartConfirmer } from '@entities/cart';

/**
 * Параметры кнопки добавления блюда в корзину.
 */
export interface AddToCartButtonProps {
    /** Блюдо, добавляемое при клике. */
    dish: DishToAdd;
    /** Идентификатор ресторана, из которого берётся блюдо. */
    restaurantId: number;
    /** Текст подписи кнопки; по умолчанию `В корзину`. */
    label?: string;
    /** Колбэк, вызываемый при попытке добавить блюдо неавторизованным пользователем. */
    onUnauthenticated?: () => void;
    /** Кастомный коллбэк подтверждения очистки корзины при смене ресторана. */
    confirm?: CartConfirmer;
}

const TEMPLATE = `<button class="button button_primary js-add-to-cart" type="button">{{= it.label || 'В корзину' }}</button>`;

/**
 * Кнопка добавления блюда в корзину.
 *
 * Для неавторизованного пользователя вызывает {@link AddToCartButtonProps.onUnauthenticated}
 * вместо запроса. Если в корзине уже есть блюда из другого ресторана,
 * показывает подтверждение очистки через {@link Popup.confirm} (или
 * пользовательский коллбэк {@link AddToCartButtonProps.confirm}).
 */
export class AddToCartButton extends Component<AddToCartButtonProps> {
    constructor() {
        super(TEMPLATE);
    }

    /**
     * Подписывает обработчик клика.
     */
    protected onMount(): void {
        const btn = this.root?.querySelector('button');
        if (!btn) return;
        this.on(btn, 'click', () => void this.handle());
    }

    /**
     * Обрабатывает клик: проверяет авторизацию, готовит коллбэк подтверждения
     * и добавляет блюдо в корзину. Ошибки логирует и показывает пользователю.
     */
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
