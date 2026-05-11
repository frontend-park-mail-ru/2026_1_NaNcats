/**
 * Страница входа в аккаунт.
 *
 * Рендерит auth-карточку с формой {@link LoginForm} и промо-блоком
 * {@link PromoSlider}. При успешной авторизации перенаправляет пользователя
 * на главную через `router.go(ROUTES.home)`. Локального состояния и loader-а
 * у страницы нет: данные форма получает напрямую через user input, а
 * PromoSlider держит локальный сигнал слайдов внутри себя.
 *
 * Layout: 'auth'. AuthLayout рендерит общий логотип со shared-element
 * view-transition-name="app-logo" и центральную область под Outlet; страница
 * заполняет только основной контент карточки.
 */

import './login.scss';
import { Link, router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { LoginForm } from '@features/auth/login';
import { PromoSlider } from '@widgets/promo-slider';
import type { VNode } from '@shared/lib/vdom';

/**
 * Функциональный компонент страницы входа.
 *
 * Структурно повторяет старый шаблон `login.tmpl.js`: двухколоночный
 * auth-container с формой слева и промо-баннером справа. Логотип
 * (view-transition-name="app-logo") живёт в AuthLayout, поэтому здесь не
 * дублируется. Ссылка на регистрацию использует компонент {@link Link}:
 * клик обрабатывается роутером без полной перезагрузки страницы.
 *
 * @returns VNode-дерево страницы входа.
 */
export function LoginPage(): VNode {
    return (
        <div class="auth-page">
            <div class="auth-container">
                <div class="auth-form-side">
                    <div class="auth-header">
                        <h1 class="auth-header__title">Вход</h1>
                        <p class="auth-header__subtitle">
                            Нет аккаунта?{' '}
                            <Link to={ROUTES.register} class="router-link secondary-link">
                                Регистрация
                            </Link>
                        </p>
                    </div>
                    <LoginForm
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
