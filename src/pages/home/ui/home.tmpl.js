export const homePageTemplate = `
<div class="page-wrapper">
    <div class="js-header-slot"></div>

    <div class="main-layout">
        <aside class="side-column side-column_left">
            <div class="card card_categories">
                <h2 class="sidebar-title">Категории</h2>
                <div class="categories-list">
                    {{
                        const categories = [
                            {n: 'Популярное', i: '🔥'}, {n: 'Пицца', i: '🍕'}, {n: 'Суши', i: '🍣'},
                            {n: 'Бургеры', i: '🍔'}, {n: 'Десерты', i: '🍰'}, {n: 'Аптеки', i: '💊'},
                            {n: 'Цветы', i: '💐'}, {n: 'Завтраки', i: '🍳'}, {n: 'Здоровье', i: '🥦'},
                            {n: 'Кофе', i: '☕'}, {n: 'Стейки', i: '🥩'}, {n: 'Паста', i: '🍝'},
                            {n: 'Азиатская кухня', i: '🥢'}, {n: 'Морепродукты', i: '🦞'},
                            {n: 'Бизнес-ланч', i: '🍱'}, {n: 'Веганское', i: '🌱'}, {n: 'Доставка 24/7', i: '⏰'},
                            {n: 'Блины', i: '🥞'}, {n: 'Вок', i: '🥡'}, {n: 'Китайская кухня', i: '🥠'},
                            {n: 'Грузинская кухня', i: '🥙'}, {n: 'Украинская кухня', i: '🍲'}, {n: 'Домашняя кухня', i: '🏠'},
                            {n: 'Фастфуд', i: '🍟'}, {n: 'Хлеб и выпечка', i: '🥖'}, {n: 'Торты на заказ', i: '🎂'},
                            {n: 'Мороженое', i: '🍦'}, {n: 'Полезные перекусы', i: '🥜'}, {n: 'Смузи', i: '🥤'},
                            {n: 'Чай', i: '🍵'}, {n: 'Детское меню', i: '🧸'}, {n: 'Вечеринка', i: '🎉'},
                            {n: 'Кейтеринг', i: '🍽️'}, {n: 'Алкоголь', i: '🍷'}, {n: 'Пиво', i: '🍺'},
                            {n: 'Коктейли', i: '🍹'}, {n: 'Супы', i: '🥣'}, {n: 'Салаты', i: '🥗'}
                        ];
                    }}
                    {{~categories :cat}}
                        <div class="category-item">
                            <span class="category-item__icon">{{!cat.i}}</span>
                            <span class="category-item__name">{{!cat.n}}</span>
                        </div>
                    {{~}}
                </div>
            </div>
        </aside>

        <main class="center-column">
            <div class="sheet">
                <div class="sheet__header">
                    <h1 class="sheet__title">Рестораны</h1>
                </div>
                <div class="res-grid js-res-grid">
                    {{~it.restaurants :res}}
                        <div class="res-card" data-id="{{!res.id}}">
                            <img class="res-card__rect" src="{{!res.logo_url}}" alt="{{!res.name}}"
                            onerror="this.src='https://placehold.co/400x225/png?text={{!res.name}}'">
                            <div class="res-card__info">
                                <span class="res-card__name">{{!res.name}}</span>
                                <span class="res-card__desc">Пицца, суши, роллы</span>
                            </div>
                        </div>
                    {{~}}
                </div>
            </div>
        </main>

        <aside class="side-column side-column_right">
            <div class="card card_streak_points js-streak-slot"></div>
            <div class="card card_cart js-cart-slot"></div>
        </aside>
    </div>
</div>
`;
