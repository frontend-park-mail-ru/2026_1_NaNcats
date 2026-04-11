/**
 * @module AuthSetup
 * @description Вспомогательные утилиты для модулей авторизации и регистрации.
 */


import { FormErrors } from './FormErrors';
import { PromoSlider } from '../../modules/promoSlider/PromoSlider';
import { Component } from '../../core/Component';

/**
 * Набор инструментов для авторизации.
 * @interface AuthTools
 */
export interface AuthTools {
    /** * Ошибки формы.
     * @type {FormErrors} 
     */
    errors: FormErrors;
    /** * Компонент красивых картинок.
     * @type {PromoSlider} 
     */
    slider: PromoSlider;
}

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
export function setupAuthView(context: Component, onSubmit: (form: HTMLFormElement) => void): AuthTools {
    if (!context.element) {
        throw new Error('Component is not mounted');
    }

    const errors = new FormErrors(context.element);
    const slider = new PromoSlider();

    const promoContainer = context.element.querySelector('.promo-slider') as HTMLElement | null;
    if (promoContainer) {
        slider.mount(promoContainer);
    }

    const form = context.element.querySelector('#auth-form') as HTMLFormElement | null;
    if (form) {
        form.addEventListener('submit', (e: Event) => {
            e.preventDefault();
            onSubmit.call(context, form);
        });
    }

    return { errors, slider };
}
