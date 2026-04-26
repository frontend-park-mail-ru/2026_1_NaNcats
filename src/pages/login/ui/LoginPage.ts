import './login.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { LoginForm } from '@features/auth/login';
import { PromoSlider } from '@widgets/promo-slider';
import { loginPageTemplate } from './login.tmpl.js';

export class LoginPage extends Component<object> {
    constructor() {
        super(loginPageTemplate);
    }

    protected slots = {
        form: '.js-form-slot',
        promo: '.js-promo-slot',
    };

    protected onMount(): void {
        this.mountChild('form', new LoginForm(), {
            onSuccess: () => window.router.go(ROUTES.home),
        });
        this.mountChild('promo', new PromoSlider(), PromoSlider.initialProps());
    }
}
