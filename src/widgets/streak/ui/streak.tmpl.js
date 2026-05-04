export const streakTemplate = `
<div class="streak-widget" role="group" aria-label="Прогресс по неделям">
    <div class="streak-widget__top">
        <span class="streak-widget__label">Стрик</span>
        <span class="streak-widget__value">
            <span class="js-streak-value">{{!it.streak}}</span> недель
            <span class="streak-widget__fire" aria-hidden="true">🔥</span>
        </span>
    </div>
    <div class="streak-widget__track js-streak-track" role="list" aria-label="Прогресс по неделям">
        {{~it.dots :dot}}
        <span role="listitem" class="streak-dot{{?dot.filled}} streak-dot_filled{{?}}{{?dot.current}} streak-dot_current{{?}}" title="Неделя {{!dot.week}}" aria-label="Неделя {{!dot.week}}"></span>
        {{~}}
    </div>
</div>
`;
