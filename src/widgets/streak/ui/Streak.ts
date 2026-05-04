import './streak.scss';
import { Component } from '@shared/lib/component';
import { streakTemplate } from './streak.tmpl.js';

/**
 * Отдельная точка в визуализации серии: соответствует одной неделе.
 */
interface StreakDot {
    /** Номер недели, к которой относится точка. */
    week: number;
    /** Закрашена ли точка (неделя входит в текущую серию). */
    filled: boolean;
    /** Является ли точка последней в серии (текущая неделя). */
    current: boolean;
}

/**
 * Входные данные виджета {@link Streak}.
 */
interface StreakProps {
    /** Текущая длина серии в неделях. */
    streak: number;
    /** Точки, отображаемые в визуализации. */
    dots: StreakDot[];
}

const DEFAULT_DOTS = 6;

/**
 * Виджет визуализации недельной серии активности пользователя.
 *
 * Рисует ряд точек, представляющих последние недели; закрашенные точки
 * соответствуют неделям, входящим в текущую серию.
 */
export class Streak extends Component<StreakProps> {
    constructor() {
        super(streakTemplate);
    }

    /**
     * Строит пропсы виджета по длине серии и желаемому числу точек.
     *
     * Окно недель сдвигается так, чтобы текущая неделя оказывалась в правой
     * части визуализации, при этом первая точка не уходит в номер меньше 1.
     *
     * @param streakWeeks Длина серии в неделях (отрицательные и нечисловые значения нормализуются).
     * @param dotsCount Сколько точек отрисовать.
     * @returns Пропсы для отрисовки шаблона виджета.
     */
    static buildProps(streakWeeks: number, dotsCount: number = DEFAULT_DOTS): StreakProps {
        const streak = Math.max(0, Math.floor(streakWeeks) || 0);
        const startWeek = Math.max(1, streak - (dotsCount - 2));
        const dots: StreakDot[] = [];
        for (let i = 0; i < dotsCount; i++) {
            const w = startWeek + i;
            dots.push({ week: w, filled: w <= streak, current: w === streak });
        }
        return { streak, dots };
    }
}
