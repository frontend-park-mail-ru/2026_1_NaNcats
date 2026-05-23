import './achievementsModal.scss';

import type { Achievement } from '@entities/achievement';
import { computed, signal } from '@shared/lib/signals';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { onMount } from '@shared/lib/vdom';
import { achievementsAccessor, ensureLoaded } from '../model/achievementsStore';

export interface AchievementsModalProps {
    onClose: () => void;
}

const RU_MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatAwardedAt(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `Получено ${d.getDate().toString().padStart(2, '0')} ${RU_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function AchievementsModal(props: AchievementsModalProps): VNode {
    const loading = signal<boolean>(true);

    onMount(() => {
        void (async () => {
            await ensureLoaded();
            loading.set(false);
        })();
    });

    const items = computed<Achievement[]>(() => achievementsAccessor());
    const earnedCount = computed<number>(() => items().filter((a) => a.earned).length);

    return (
        <div class="achievements-modal">
            <div class="achievements-modal__header">
                <div class="achievements-modal__title">Ачивки</div>
                <div class="achievements-modal__header-right">
                    <span class="achievements-modal__count">{() => `${earnedCount()} из ${items().length}`}</span>
                    <button
                        type="button"
                        class="achievements-modal__close"
                        aria-label="Закрыть"
                        onClick={props.onClose}
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div class="achievements-modal__list">
                <Show when={() => !loading() && items().length > 0}>
                    <For each={items} key={(a) => a.code}>
                        {(a) => (
                            <div
                                class={() =>
                                    a.earned
                                        ? 'achievements-modal__row achievements-modal__row_earned'
                                        : 'achievements-modal__row'
                                }
                            >
                                <span
                                    class={() =>
                                        a.earned
                                            ? 'achievements-modal__icon achievements-modal__icon_earned'
                                            : 'achievements-modal__icon'
                                    }
                                    aria-hidden="true"
                                >
                                    {a.icon}
                                </span>
                                <span class="achievements-modal__body">
                                    <span class="achievements-modal__head">
                                        <span class="achievements-modal__name">{a.title}</span>
                                        <Show when={() => a.earned}>
                                            <span class="achievements-modal__tag">Получено</span>
                                        </Show>
                                    </span>
                                    <span class="achievements-modal__desc">{a.description}</span>
                                    <Show when={() => a.earned}>
                                        <span class="achievements-modal__when">{formatAwardedAt(a.awarded_at)}</span>
                                    </Show>
                                </span>
                            </div>
                        )}
                    </For>
                </Show>
            </div>
        </div>
    );
}
