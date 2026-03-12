import { FormErrors } from './FormErrors.js';
import { PromoSlider } from '../../components/PromoSlider/PromoSlider.js';

/**
 * Инициализирует общие элементы и возвращает инструменты.
 */
export function setupAuthView(context, onSubmit) {
    const errors = new FormErrors(context.element);
    const slider = new PromoSlider();

    const promoContainer = context.element.querySelector('.promo-slider');
    if (promoContainer) {
        slider.mount(promoContainer);
    }

    const form = context.element.querySelector('#auth-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            onSubmit.call(context, form);
        });
    }

    return { errors, slider };
}