import './cartWidget.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { cartStore, fromMicros, type CartItem } from '@entities/cart';
import { ClearCartButton } from '@features/cart/clear-cart';
import { cartWidgetTemplate } from './cartWidget.tmpl.js';

/**
 * Позиция корзины, расширенная заранее посчитанным значением цены в рублях.
 */
interface CartItemView extends CartItem {
    /** Цена позиции в рублях, отформатированная для шаблона. */
    priceRub: string;
}

/**
 * Входные данные виджета {@link CartWidget}.
 */
interface CartWidgetProps {
    /** Позиции корзины, подготовленные для отрисовки. */
    items: CartItemView[];
    /** Итоговая сумма заказа в рублях. */
    totalRub: string;
}

/**
 * Преобразует позиции корзины в форму с дополнительным полем цены в рублях.
 *
 * @param items Позиции корзины.
 * @returns Те же позиции с предварительно посчитанным priceRub.
 */
const toView = (items: CartItem[]): CartItemView[] =>
    items.map((i) => ({ ...i, priceRub: fromMicros(i.price).toFixed(0) }));

/**
 * Считает итог корзины в микрорублях.
 *
 * @param items Позиции корзины.
 * @returns Сумма цена * количество по всем позициям в микрорублях.
 */
const totalMicros = (items: CartItem[]): number => items.reduce((sum, i) => sum + i.price * i.quantity, 0);

/**
 * Виджет корзины: список позиций, кнопки изменения количества, очистка и
 * переход к оформлению. Подписывается на cartStore и перестраивает пропсы при
 * изменении позиций.
 */
export class CartWidget extends Component<CartWidgetProps> {
    constructor() {
        super(cartWidgetTemplate);
    }

    protected slots = {
        clear: '.js-clear-slot',
    };

    /**
     * Строит пропсы виджета по позициям корзины.
     *
     * @param items Позиции корзины.
     * @returns Готовые пропсы со списком позиций и итоговой суммой.
     */
    static buildProps(items: CartItem[]): CartWidgetProps {
        return {
            items: toView(items),
            totalRub: fromMicros(totalMicros(items)).toFixed(0),
        };
    }

    /**
     * Монтирует кнопку очистки (если есть позиции), вешает обработчики на
     * кнопки изменения количества и перехода к оформлению, подписывается на
     * cartStore для перерисовки.
     */
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

        this.useStore(
            cartStore,
            (s) => s.items,
            (items) => {
                this.update(CartWidget.buildProps(items));
            },
        );
    }
}
