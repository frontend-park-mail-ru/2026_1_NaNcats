import './register.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { RegisterForm } from '@features/auth/register';
import { PromoSlider } from '@widgets/promo-slider';
import { registerPageTemplate } from './register.tmpl.js';

/**
 * Страница регистрации.
 *
 * Монтирует форму регистрации в слот form и промо-слайдер в слот promo. При
 * успешной регистрации перенаправляет пользователя на главную страницу.
 */
export class RegisterPage extends Component<object> {
    constructor() {
        super(registerPageTemplate);
    }

    protected slots = {
        form: '.js-form-slot',
        promo: '.js-promo-slot',
    };

    /**
     * Монтирует форму регистрации и промо-слайдер в соответствующие слоты.
     */
    protected onMount(): void {
        this.mountChild('form', new RegisterForm(), {
            onSuccess: () => window.router.go(ROUTES.home),
        });
        this.mountChild('promo', new PromoSlider(), PromoSlider.initialProps());
    }
}
