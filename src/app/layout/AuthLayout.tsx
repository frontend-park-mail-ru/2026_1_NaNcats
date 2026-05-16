/**
 * Layout-shell страниц авторизации (/login, /register).
 *
 * Логотип несёт view-transition-name="app-logo" (тот же атрибут на логотипе Header
 * в RootLayout), за счёт чего при переходе между shell-ами логотип морфится через
 * View Transitions API. `<div id="modal-root"/>` лежит внутри shell-а и стоит перед
 * `<ModalRoot/>`: ModalRoot ищет контейнер через querySelector в первом эффекте.
 */

import './layout.scss';
import { Outlet } from '@app/router';
import { ModalRoot } from '@shared/lib/portal';
import { OfflineBanner } from '@shared/ui/offline-banner';
import { Logo } from '@shared/ui/logo';
import type { VNode } from '@shared/lib/vdom';

export function AuthLayout(): VNode {
    return (
        <div class="auth-layout">
            <div class="auth-logo" view-transition-name="app-logo">
                <Logo width={150} height={78} />
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
