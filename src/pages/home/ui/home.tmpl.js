export const homePageTemplate = `
<div class="page-wrapper home-page js-home-page">
    <div class="js-header-slot"></div>

    <div class="mobile-toolbar">
        <button type="button" class="mobile-toolbar__btn js-open-categories">Категории</button>
    </div>

    <button
        type="button" class="category-fab js-open-categories" aria-label="Открыть категории">
        <svg class="category-fab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.2 3.5C5.55 3.5 4.2 4.85 4.2 6.5C4.2 8.15 5.55 9.5 7.2 9.5C8.85 9.5 10.2 8.15 10.2 6.5C10.2 4.85 8.85 3.5 7.2 3.5Z" stroke="#FFC1C1" stroke-width="1.8"/>
            <path d="M6.1 9.2L5.7 19.2C5.67 20.06 6.35 20.8 7.21 20.8C8.07 20.8 8.75 20.08 8.72 19.22L8.3 9.2" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M16.9 3.7V9.2M14.4 3.7V9.2M19.4 3.7V9.2" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M14.2 9.2H19.6" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M16.9 9.2L16.5 19.2C16.47 20.06 17.15 20.8 18.01 20.8C18.87 20.8 19.55 20.08 19.52 19.22L19.1 9.2" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
    </button>

    <button type="button" class="cart-fab js-open-cart-sheet" aria-label="Открыть корзину">
        <svg class="cart-fab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 5H5.4C6.1 5 6.42 5.27 6.58 5.86L6.94 7.2M6.94 7.2H18.6C19.58 7.2 20.18 8.02 19.92 8.96L18.84 12.86C18.64 13.58 17.98 14.08 17.24 14.08H9.18C8.38 14.08 7.69 13.54 7.5 12.76L6.94 7.2Z" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9.6 18.2C10.2627 18.2 10.8 17.6627 10.8 17C10.8 16.3373 10.2627 15.8 9.6 15.8C8.93726 15.8 8.4 16.3373 8.4 17C8.4 17.6627 8.93726 18.2 9.6 18.2Z" fill="#FFC1C1"/>
            <path d="M17.1 18.2C17.7627 18.2 18.3 17.6627 18.3 17C18.3 16.3373 17.7627 15.8 17.1 15.8C16.4373 15.8 15.9 16.3373 15.9 17C15.9 17.6627 16.4373 18.2 17.1 18.2Z" fill="#FFC1C1"/>
        </svg>
    </button>

    <div class="mobile-overlay js-mobile-overlay"></div>

    <div class="main-layout">
        <aside class="side-column side-column_left js-categories-drawer">
            <div class="card card_categories">
                <div class="mobile-panel-header">
                    <h2 class="sidebar-title">Категории</h2>
                    <button type="button" class="mobile-panel-close js-close-panels" aria-label="Закрыть категории">×</button>
                </div>

                <h2 class="sidebar-title sidebar-title_desktop">Категории</h2>

                <div class="categories-list js-categories-list">
                    <div class="category-item {{!it.activeCategory ? '' : 'category-item_active'}}" data-category-id="" tabindex="0" role="button">
                        <span class="category-item__icon">🍽️</span>
                        <span class="category-item__name">Все рестораны</span>
                    </div>
                    {{~it.categories :cat}}
                        <div class="category-item" data-category-id="{{!cat.id}}" tabindex="0" role="button">
                            <span class="category-item__icon">{{!cat.emoji}}</span>
                            <span class="category-item__name">{{!cat.name}}</span>
                        </div>
                    {{~}}
                </div>
            </div>
        </aside>

        <main class="center-column">
            <div class="sheet">
                <div class="sheet__header">
                    <h1 class="sheet__title js-page-title">{{!it.activeCategory || (it.searchQuery ? 'Поиск' : 'Рестораны')}}</h1>
                </div>

                <div class="search-results-label js-search-label" style="display:{{!it.searchQuery ? 'block' : 'none'}}">
                    Найдено по запросу «{{!it.searchQuery}}»
                </div>

                <div class="res-grid js-res-grid">
                    {{~it.restaurants :res}}
                        <div class="res-card" data-id="{{!res.id}}">
                            <img
                                class="res-card__rect"
                                src="{{!res.logo_url}}"
                                alt="{{!res.name}}"
                                onerror="this.src='https://placehold.co/400x225/png?text={{!res.name}}'"
                            >
                            <div class="res-card__info">
                                <span class="res-card__name">{{!res.name}}</span>
                                <span class="res-card__desc">{{!res.description || 'Вкусная еда'}}</span>
                            </div>
                        </div>
                    {{~}}
                </div>

                <div class="res-empty js-res-empty" style="display:{{!it.restaurants && it.restaurants.length === 0 ? 'flex' : 'none'}}">
                    <p class="res-empty__text">Ничего не найдено 😔</p>
                    <p class="res-empty__hint">Попробуйте изменить запрос или выбрать другую категорию</p>
                </div>
            </div>
        </main>

        <aside class="side-column side-column_right js-cart-sheet">
            <div class="card card_streak_points js-streak-slot"></div>

            <div class="card card_cart">
                <div class="cart-slot js-cart-slot"></div>
            </div>
        </aside>
    </div>
</div>
`;
