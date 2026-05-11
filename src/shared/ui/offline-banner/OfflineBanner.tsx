/**
 * Баннер оффлайн-режима: показывается поверх UI при потере сети.
 *
 * Реализация Unit 13. Функциональный VDOM-компонент с локальным сигналом
 * `online`, который синхронизируется с `navigator.onLine` через события
 * `online`/`offline` на window. Сами слушатели регистрируются в onMount и
 * снимаются в onCleanup, поэтому компонент безопасно монтировать и
 * размонтировать вместе со своим layout-shell-ом.
 *
 * Видимость управляется через `<Show>`: пока online() истина, баннер не
 * присутствует в DOM. Это отличается от прежней реализации (где банер
 * висел в DOM постоянно и переключался классом offline-banner_active с
 * transition), но соответствует фреймворковой дисциплине: в VDOM условный
 * показ это `<Show>`, а не вечно живущий узел с toggle класса.
 */

import { onCleanup, signal } from '@shared/lib/signals';
import { onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

/**
 * Сообщение, которое показывается пользователю при потере сети.
 *
 * Вынесено в константу, чтобы текст не терялся в JSX и легко правился без
 * захода в разметку.
 */
const OFFLINE_MESSAGE = 'Нет интернета. Приложение работает в автономном режиме.';

/**
 * Компонент OfflineBanner: реактивный баннер сетевого статуса.
 *
 * Внутри держит сигнал online со стартовым значением `navigator.onLine`.
 * При размонтировании компонента сигналы и подписки на window очищаются
 * через `onCleanup`, привязанный к owner-у функции.
 *
 * @returns VNode с `<Show>`, который рендерит баннер только в офлайне.
 */
export function OfflineBanner(): VNode {
    const online = signal<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);

    const handleOnline = (): void => {
        online.set(true);
    };
    const handleOffline = (): void => {
        online.set(false);
    };

    onMount(() => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        // Подстраховка: между созданием сигнала и моментом mount статус мог
        // успеть смениться, поэтому пересчитываем перед первым рендером в DOM.
        online.set(navigator.onLine);
    });

    onCleanup(() => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    });

    return (
        <Show when={(): boolean => !online()}>
            <div class="offline-banner offline-banner_active">
                <div class="offline-banner-text">{OFFLINE_MESSAGE}</div>
            </div>
        </Show>
    ) as VNode;
}
