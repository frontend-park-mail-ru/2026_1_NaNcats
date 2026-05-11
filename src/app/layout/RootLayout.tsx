/**
 * Корневой shell приложения для `'root'`-layout-а.
 *
 * Содержит постоянный Header, область `<main>` с Outlet для текущей страницы,
 * функциональный `<OfflineBanner/>` и `<div id="modal-root"/>` с приёмником
 * ModalRoot для модалок уровня приложения. RootLayout живёт ровно столько,
 * сколько Router.currentLayout остаётся равным 'root': переходы между
 * страницами `'root'`-layout-а (`/`, `/restaurant`, `/checkout`, `/profile`,
 * `/404`) не размонтируют shell, и Header не моргает.
 *
 * Узел с view-transition-name="app-logo" живёт внутри Header (логотип
 * приложения). AuthLayout держит парный логотип с тем же view-transition-name,
 * чтобы при переходе `/login -> /` морф сразу был наполовину готов.
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

/**
 * Компонент RootLayout: постоянный shell для основных страниц.
 *
 * Порядок JSX-детей внутри корневого div важен: `<div id="modal-root"/>`
 * стоит ПЕРЕД `<ModalRoot/>`, чтобы к моменту первого эффекта ModalRoot
 * див уже был в документе и createPortal находил его через
 * document.querySelector. См. JSDoc на ModalRoot для развёрнутого обоснования.
 *
 * Подписка на пользователя реализована через `useStoreSignal`: адаптер
 * проецирует срез `userStore.user` в сигнал и пробрасывает его аксессор в
 * Header как проп `user`. Когда срез меняется (логин/логаут), Header сам
 * перерисует блок авторизации без размонтирования всего shell-а.
 *
 * @returns VNode корневого shell-а с Header, Outlet, оффлайн-баннером и modal-root.
 */
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
