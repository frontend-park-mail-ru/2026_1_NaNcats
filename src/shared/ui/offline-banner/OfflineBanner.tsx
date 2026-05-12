/**
 * Баннер оффлайн-режима: показывается поверх UI при потере сети. Локальный
 * сигнал `online` синхронизируется с `navigator.onLine` через события
 * `online`/`offline` на window (слушатели вешаются в onMount, снимаются в
 * onCleanup). Видимость через `<Show>`: пока online() истина, баннера в DOM нет.
 */

import { onCleanup, signal } from '@shared/lib/signals';
import { onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

/** Сообщение, которое показывается пользователю при потере сети. */
const OFFLINE_MESSAGE = 'Нет интернета. Приложение работает в автономном режиме.';

/**
 * Компонент OfflineBanner: реактивный баннер сетевого статуса.
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
        // между созданием сигнала и mount статус мог смениться: пересчитываем
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
