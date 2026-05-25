// Страница входа. Layout: 'auth' (логотип живёт в AuthLayout).

import './login.scss';
import { Link, router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { LoginForm } from '@features/auth/login';
import { PromoSlider } from '@widgets/promo-slider';
import type { VNode } from '@shared/lib/vdom';

export function LoginPage(): VNode {
    return (
        <div class="auth-page">
            <div class="auth-container">
                <div class="auth-form-side">
                    <div class="auth-header">
                        <h1 class="auth-header__title">Вход</h1>
                        <p class="auth-header__subtitle">
                            Нет аккаунта?{' '}
                            <Link to={ROUTES.register} class="secondary-link">
                                Регистрация
                            </Link>
                        </p>
                    </div>
                    <LoginForm
                        onSuccess={() => {
                            void router.go(ROUTES.home);
                        }}
                    />
                </div>
                <div class="auth-image-side">
                    <PromoSlider />
                </div>
            </div>
        </div>
    );
}
