// Виджет недельной серии активности: ряд точек, закрашенные входят в текущую серию.
// Для гостя (нет пользователя в сторе) ничего не рендерит.

import './streak.scss';

import { userStore, type User } from '@entities/user';
import { computed, useStoreSignal } from '@shared/lib/signals';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

/**
 * Точка визуализации (одна неделя). Флаги filled/current не храним в объекте:
 * они вычисляются реактивно в dotClass, иначе keyed-For не обновит модификаторы.
 */
interface StreakDot {
    week: number;
}

export interface StreakProps {
    /** Сколько точек отрисовать (по умолчанию 6). Текущая неделя в правой части ряда. */
    dotsCount?: number;
}

const DEFAULT_DOTS = 6;

/** Число недель серии: отбрасывает дробную часть, NaN/отрицательные к нулю. */
function normalizeStreak(raw: number | undefined): number {
    return Math.max(0, Math.floor(raw ?? 0) || 0);
}

// Набор точек: окно недель сдвигается так, чтобы текущая неделя была справа,
// но первая точка не уходит ниже первой недели.
function buildDots(streak: number, dotsCount: number): StreakDot[] {
    const startWeek = Math.max(1, streak - (dotsCount - 2));
    const dots: StreakDot[] = [];
    for (let i = 0; i < dotsCount; i += 1) {
        dots.push({ week: startWeek + i });
    }
    return dots;
}

// Класс точки по её неделе и длине серии; streak передаём живым значением,
// потому что keyed-For не перевызывает children при изменении полей точки.
function dotClass(week: number, streak: number): string {
    const parts = ['streak-dot'];
    if (week <= streak) parts.push('streak-dot_filled');
    if (week === streak) parts.push('streak-dot_current');
    return parts.join(' ');
}

/** Виджет недельной серии активности; для гостя ничего не рендерит. */
export function Streak(props: StreakProps = {}): VNode {
    const dotsCount = props.dotsCount ?? DEFAULT_DOTS;

    const user = useStoreSignal(userStore, (s) => s.user);

    const streakValue = computed<number>(() => normalizeStreak(user()?.streak_weeks));
    const dots = computed<StreakDot[]>(() => buildDots(streakValue(), dotsCount));

    return (
        <Show when={(): User | null => user()}>
            <div class="streak-widget" role="group" aria-label="Прогресс по неделям">
                <div class="streak-widget__top">
                    <span class="streak-widget__label">Стрик</span>
                    <span class="streak-widget__value">
                        <span class="js-streak-value">{streakValue}</span> недель
                        <span class="streak-widget__fire" aria-hidden="true">
                            🔥
                        </span>
                    </span>
                </div>
                <div
                    class="streak-widget__track js-streak-track"
                    role="list"
                    aria-label="Прогресс по неделям"
                >
                    <For each={dots} key={(dot): number => dot.week}>
                        {(dot): VNode => (
                            <span
                                role="listitem"
                                class={(): string => dotClass(dot.week, streakValue())}
                                title={`Неделя ${String(dot.week)}`}
                                aria-label={`Неделя ${String(dot.week)}`}
                            />
                        )}
                    </For>
                </div>
            </div>
        </Show>
    ) as VNode;
}
