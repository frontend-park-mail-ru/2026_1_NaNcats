import './register.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { RegisterForm } from '@features/auth/register';
import { PromoSlider } from '@widgets/promo-slider';
import { registerPageTemplate } from './register.tmpl.js';

export class RegisterPage extends Component<object> {
    constructor() {
        super(registerPageTemplate);
    }

    protected slots = {
        form: '.js-form-slot',
        promo: '.js-promo-slot',
    };

    protected onMount(): void {
        this.mountChild('form', new RegisterForm(), {
            onSuccess: () => window.router.go(ROUTES.home),
        });
        this.mountChild('promo', new PromoSlider(), PromoSlider.initialProps());
    }
}
