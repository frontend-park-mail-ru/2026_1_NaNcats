// Страница регистрации. Layout: 'auth' (логотип живёт в AuthLayout).

import './register.scss';
import { Link, router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { RegisterForm } from '@features/auth/register';
import { PromoSlider } from '@widgets/promo-slider';
import type { VNode } from '@shared/lib/vdom';

export function RegisterPage(): VNode {
    return (
        <div class="auth-page">
            <div class="auth-container">
                <div class="auth-form-side">
                    <div class="auth-header">
                        <h1 class="auth-header__title">Регистрация</h1>
                        <p class="auth-header__subtitle">
                            Есть аккаунт?{' '}
                            <Link to={ROUTES.login} class="router-link secondary-link">
                                Войти
                            </Link>
                        </p>
                    </div>
                    <RegisterForm
                        onSuccess={(): void => {
                            void router.go(ROUTES.home);
                        }}
                    />
                </div>
                <div class="auth-image-side">
                    <PromoSlider />
                </div>
            </div>
        </div>
    ) as VNode;
}
