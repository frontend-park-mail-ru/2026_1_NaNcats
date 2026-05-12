/**
 * Основной layout-shell приложения (/, /restaurant, /checkout, /profile, /404).
 *
 * Содержит постоянный Header, область `<main>` с Outlet, OfflineBanner и
 * `<div id="modal-root"/>` с приёмником ModalRoot. Shell живёт, пока currentLayout
 * равен 'root', поэтому переходы между его страницами не размонтируют Header.
 * Логотип Header несёт view-transition-name="app-logo" (парный логотип в AuthLayout).
 * `<div id="modal-root"/>` стоит перед `<ModalRoot/>`: ModalRoot ищет контейнер через
 * querySelector в первом эффекте.
 */

import './layout.scss';
import { Header } from '@widgets/header';
import { Outlet, router } from '@app/router';
import { userStore } from '@entities/user';
import { ROUTES } from '@shared/config/routes';
import { useStoreSignal } from '@shared/lib/signals';
import { ModalRoot } from '@shared/lib/portal';
import { OfflineBanner } from '@shared/ui/offline-banner';
import type { VNode } from '@shared/lib/vdom';

export function RootLayout(): VNode {
    const user = useStoreSignal(userStore, (s) => s.user);

    return (
        <div class="root-layout">
            <Header
                user={user}
                hideSearch={(): boolean => router.currentRoute().path !== ROUTES.home}
                mode={(): 'default' | 'back' =>
                    router.currentRoute().path === ROUTES.home ? 'default' : 'back'
                }
                onLogin={(): void => {
                    void router.go(ROUTES.login);
                }}
                onRegister={(): void => {
                    void router.go(ROUTES.register);
                }}
            />
            <main class="root-main">
                <Outlet />
            </main>
            <OfflineBanner />
            <div id="modal-root" />
            <ModalRoot />
        </div>
    ) as VNode;
}
