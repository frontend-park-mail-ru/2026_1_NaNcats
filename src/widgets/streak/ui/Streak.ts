import './streak.scss';
import { Component } from '@shared/lib/component';
import { streakTemplate } from './streak.tmpl.js';

interface StreakDot {
    week: number;
    filled: boolean;
    current: boolean;
}

interface StreakProps {
    streak: number;
    dots: StreakDot[];
}

const DEFAULT_DOTS = 6;

export class Streak extends Component<StreakProps> {
    constructor() {
        super(streakTemplate);
    }

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
