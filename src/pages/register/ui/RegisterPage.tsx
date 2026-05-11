/**
 * Страница регистрации нового пользователя.
 *
 * Рендерит auth-карточку с формой {@link RegisterForm} и промо-блоком
 * {@link PromoSlider}. При успешной регистрации перенаправляет пользователя
 * на главную через `router.go(ROUTES.home)`. Loader-а у страницы нет:
 * данные собирает сама форма, состояние слайдов живёт внутри PromoSlider.
 *
 * Layout: 'auth'. Общий логотип view-transition-name="app-logo" рендерит
 * AuthLayout; страница заполняет основную область карточки.
 */

import './register.scss';
import { Link, router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { RegisterForm } from '@features/auth/register';
import { PromoSlider } from '@widgets/promo-slider';
import type { VNode } from '@shared/lib/vdom';

/**
 * Функциональный компонент страницы регистрации.
 *
 * Структура аналогична странице входа: двухколоночный auth-container, форма
 * слева, промо-блок справа. Ссылка на страницу входа использует компонент
 * {@link Link}: клик обрабатывается роутером без полной перезагрузки страницы.
 *
 * @returns VNode-дерево страницы регистрации.
 */
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
