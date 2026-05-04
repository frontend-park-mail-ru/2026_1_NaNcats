import './login.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { LoginForm } from '@features/auth/login';
import { PromoSlider } from '@widgets/promo-slider';
import { loginPageTemplate } from './login.tmpl.js';

/**
 * Страница входа.
 *
 * Монтирует форму авторизации в слот form и промо-слайдер в слот promo. При
 * успешном входе перенаправляет пользователя на главную страницу.
 */
export class LoginPage extends Component<object> {
    constructor() {
        super(loginPageTemplate);
    }

    protected slots = {
        form: '.js-form-slot',
        promo: '.js-promo-slot',
    };

    /**
     * Монтирует форму входа и промо-слайдер в соответствующие слоты.
     */
    protected onMount(): void {
        this.mountChild('form', new LoginForm(), {
            onSuccess: () => window.router.go(ROUTES.home),
        });
        this.mountChild('promo', new PromoSlider(), PromoSlider.initialProps());
    }
}
