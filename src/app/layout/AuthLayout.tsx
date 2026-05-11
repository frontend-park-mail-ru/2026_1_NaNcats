/**
 * Peer-shell приложения для `'auth'`-layout-а.
 *
 * Активируется, когда Router.currentLayout равен 'auth' (страницы /login и
 * /register). Содержит общий логотип с view-transition-name="app-logo"
 * (тот же атрибут будет на логотипе Header в RootLayout: переход между
 * shell-ами морфит логотип через View Transitions API), центральную область
 * `<main>` с Outlet под форму, плюс `<div id="modal-root"/>` с приёмником
 * ModalRoot.
 *
 * Симметрия с RootLayout. Оба layout-а кладут собственный `<div id="modal-root"/>`,
 * потому что в каждый момент времени смонтирован ровно один shell, и приёмник
 * ModalRoot должен находить контейнер именно в своём поддереве. Если бы
 * modal-root жил снаружи (например, прямо в `#root`), при смене layout-а
 * порталы пришлось бы переподписывать.
 */

import './layout.scss';
import { Outlet } from '@app/router';
import { ModalRoot } from '@shared/lib/portal';
import { OfflineBanner } from '@shared/ui/offline-banner';
import type { VNode } from '@shared/lib/vdom';

/**
 * Компонент AuthLayout: peer-shell страниц авторизации.
 *
 * Логотип. Используем минимальный inline-SVG-плейсхолдер, чтобы атрибут
 * view-transition-name="app-logo" уже работал при переходе. Unit 9 заменит
 * SVG на реальный логотип, оставив тот же атрибут: морф продолжит работать
 * без правок на этой стороне.
 *
 * Порядок JSX-детей. `<div id="modal-root"/>` стоит ПЕРЕД `<ModalRoot/>` по
 * той же причине, что и в RootLayout: ModalRoot ищет контейнер через
 * document.querySelector в момент первого эффекта.
 *
 * @returns VNode peer-shell-а со shared-element-логотипом, центральной формой и modal-root.
 */
export function AuthLayout(): VNode {
    return (
        <div class="auth-layout">
            <div class="auth-logo" view-transition-name="app-logo">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                </svg>
            </div>
            <main class="auth-main">
                <Outlet />
            </main>
            <OfflineBanner />
            <div id="modal-root" />
            <ModalRoot />
        </div>
    ) as VNode;
}
