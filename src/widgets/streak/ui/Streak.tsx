/**
 * Виджет визуализации недельной серии активности пользователя в виде
 * функционального компонента VDOM/JSX.
 *
 * Поведение перенесено из старого `Streak.ts` 1:1, но реализовано через
 * сигналы и реактивную JSX-разметку без `.tmpl.js`-шаблона и без подписки в
 * стиле `useStore` от старого {@link Component}. Виджет подписывается на
 * `userStore.user` через {@link useStoreSignal} и рендерит ряд точек,
 * представляющих последние недели; закрашенные точки соответствуют неделям,
 * входящим в текущую серию.
 *
 * Если в сторе нет пользователя (гость), компонент возвращает null:
 * фрагмент DOM не появляется, и место под виджет не занимается. При логине
 * сигнал переключается, `<Show>` подмонтирует поддерево самостоятельно.
 *
 * Дисциплина реактивных выражений (см. JSDoc в `vdom/show.tsx` и `vdom/for.tsx`).
 * Все JSX-выражения, которые должны реактивно меняться, передаются как
 * функции-аксессоры: значение `streak` это inline-фабрика `() => streakValue()`,
 * массив точек считается через `computed` и передаётся в `<For each>`.
 */

import './streak.scss';

import { userStore, type User } from '@entities/user';
import { computed, useStoreSignal } from '@shared/lib/signals';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

/**
 * Одна точка в визуализации серии: соответствует одной неделе.
 *
 * Хранит только номер недели; флаги `filled` и `current` не материализуются
 * в объект, потому что вычисляются реактивно по живому значению `streak`
 * в `dotClass`. Если бы мы зашили их в объект, keyed-`<For>` не обновлял бы
 * модификаторы при приросте серии (children-callback не перезапускается
 * для сохранившегося ключа).
 */
interface StreakDot {
    /** Номер недели, к которой относится точка. */
    week: number;
}

/**
 * Входные пропсы виджета {@link Streak}.
 */
export interface StreakProps {
    /**
     * Сколько точек отрисовать в визуализации. По умолчанию шесть.
     *
     * Окно недель сдвигается так, чтобы текущая неделя оказывалась в правой
     * части ряда, при этом первая точка не уходит в номер меньше единицы.
     */
    dotsCount?: number;
}

/** Число точек по умолчанию, если проп `dotsCount` не передан. */
const DEFAULT_DOTS = 6;

/**
 * Нормализует число недель серии: отбрасывает дробную часть и приводит
 * отрицательные/NaN-значения к нулю.
 *
 * @param raw Сырое значение `streak_weeks` из профиля пользователя.
 * @returns Неотрицательное целое число недель серии.
 */
function normalizeStreak(raw: number | undefined): number {
    return Math.max(0, Math.floor(raw ?? 0) || 0);
}

/**
 * Считает набор точек визуализации по длине серии и желаемому числу точек.
 *
 * Окно недель сдвигается так, чтобы текущая неделя оказывалась в правой
 * части ряда, но первая точка остаётся не меньше первой недели.
 *
 * @param streak Длина серии в неделях (уже нормализованная).
 * @param dotsCount Сколько точек отрисовать.
 * @returns Массив точек слева направо.
 */
function buildDots(streak: number, dotsCount: number): StreakDot[] {
    const startWeek = Math.max(1, streak - (dotsCount - 2));
    const dots: StreakDot[] = [];
    for (let i = 0; i < dotsCount; i += 1) {
        dots.push({ week: startWeek + i });
    }
    return dots;
}

/**
 * Считает класс одной точки по номеру её недели и текущей длине серии.
 * Передаётся живое значение `streak`, потому что keyed-реконсиляция в `<For>`
 * не перевызывает children-callback при изменении полей объекта точки: класс
 * обязан читаться через live-аксессор, иначе модификаторы `_filled` и
 * `_current` останутся стейлом после прироста серии.
 *
 * @param week Номер недели, к которой относится точка.
 * @param streak Текущая длина серии (живое значение из сигнала).
 * @returns Готовая строка class.
 */
function dotClass(week: number, streak: number): string {
    const parts = ['streak-dot'];
    if (week <= streak) parts.push('streak-dot_filled');
    if (week === streak) parts.push('streak-dot_current');
    return parts.join(' ');
}

/**
 * Функциональный компонент Streak: рисует прогресс по неделям для текущего
 * пользователя. Подписывается на `userStore.user`; если пользователя нет,
 * ничего не рендерит.
 *
 * @param props Пропсы виджета (число точек).
 * @returns VNode-дерево виджета.
 */
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
