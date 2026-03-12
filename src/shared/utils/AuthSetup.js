/**
 * @module AuthHelpers
 * @description Вспомогательные утилиты для модулей авторизации и регистрации.
 */

import { FormErrors } from './FormErrors.js';
import { PromoSlider } from '../../components/PromoSlider/PromoSlider.js';

/**
 * Объект, содержащий инициализированные инструменты для страницы авторизации.
 * @typedef {Object} AuthTools
 * @property {FormErrors} errors - Экземпляр класса для управления ошибками валидации.
 * @property {PromoSlider} slider - Экземпляр компонента промо-слайдера.
 */

/**
 * Инициализирует общие визуальные элементы страниц авторизации (слайдер и хелпер ошибок).
 * Также настраивает слушатель события 'submit' для формы.
 * 
 * @function setupAuthView
 * @param {Component} context - Экземпляр компонента (this), в контексте которого настраивается вид.
 * @param {Function} onSubmit - Коллбэк-функция, вызываемая при отправке формы.
 * @returns {AuthTools} Объект с созданными инструментами.
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