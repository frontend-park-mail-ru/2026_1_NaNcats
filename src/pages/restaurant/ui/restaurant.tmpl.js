export const restaurantPageTemplate = `
<div class="page-wrapper restaurant-details-page js-restaurant-page">
    <div class="js-header-slot"></div>

    <button
        type="button"
        class="menu-fab js-open-menu-drawer"
        aria-label="Открыть меню ресторана"
    >
        <svg class="menu-fab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.2 3.5C5.55 3.5 4.2 4.85 4.2 6.5C4.2 8.15 5.55 9.5 7.2 9.5C8.85 9.5 10.2 8.15 10.2 6.5C10.2 4.85 8.85 3.5 7.2 3.5Z" stroke="#FFC1C1" stroke-width="1.8"/>
            <path d="M6.1 9.2L5.7 19.2C5.67 20.06 6.35 20.8 7.21 20.8C8.07 20.8 8.75 20.08 8.72 19.22L8.3 9.2" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M16.9 3.7V9.2M14.4 3.7V9.2M19.4 3.7V9.2" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M14.2 9.2H19.6" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M16.9 9.2L16.5 19.2C16.47 20.06 17.15 20.8 18.01 20.8C18.87 20.8 19.55 20.08 19.52 19.22L19.1 9.2" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
    </button>

    <button
        type="button"
        class="cart-fab js-open-cart-sheet"
        aria-label="Открыть корзину"
    >
        <svg class="cart-fab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 5H5.4C6.1 5 6.42 5.27 6.58 5.86L6.94 7.2M6.94 7.2H18.6C19.58 7.2 20.18 8.02 19.92 8.96L18.84 12.86C18.64 13.58 17.98 14.08 17.24 14.08H9.18C8.38 14.08 7.69 13.54 7.5 12.76L6.94 7.2Z" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9.6 18.2C10.2627 18.2 10.8 17.6627 10.8 17C10.8 16.3373 10.2627 15.8 9.6 15.8C8.93726 15.8 8.4 16.3373 8.4 17C8.4 17.6627 8.93726 18.2 9.6 18.2Z" fill="#FFC1C1"/>
            <path d="M17.1 18.2C17.7627 18.2 18.3 17.6627 18.3 17C18.3 16.3373 17.7627 15.8 17.1 15.8C16.4373 15.8 15.9 16.3373 15.9 17C15.9 17.6627 16.4373 18.2 17.1 18.2Z" fill="#FFC1C1"/>
        </svg>
    </button>

    <div class="mobile-overlay js-mobile-overlay"></div>

    <div class="main-layout">
        <aside class="side-column restaurant-menu-column js-menu-drawer">
            <div class="card card_fixed">
                <div class="mobile-panel-header">
                    <p class="label-text">Меню</p>
                    <button
                        type="button"
                        class="mobile-panel-close js-close-panels"
                        aria-label="Закрыть меню"
                    >
                        ×
                    </button>
                </div>

                <p class="label-text label-text_desktop">Меню</p>
                <div class="categories-list js-restaurant-categories">
                    {{~it.sections :sec :idx}}
                        <div class="category-item js-restaurant-cat" data-section-idx="{{!idx}}" tabindex="0" role="button">
                            <span>—</span><span>{{!sec.name}}</span>
                        </div>
                    {{~}}
                </div>
            </div>
        </aside>

        <main class="center-column">
            <div class="sheet">
                <div class="sheet__header restaurant-sheet-header">
                    <h1 class="sheet__title restaurant-sheet-title">{{!it.restaurant.name}}</h1>
                </div>

                <div class="restaurant-hero">
                    <img
                        class="restaurant-hero__img"
                        src="{{!it.restaurant.logo_url}}"
                        alt="{{!it.restaurant.name}}"
                        onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/restaurants/default-restaurant-logo.webp'"
                    />
                </div>

                <div class="restaurant-search">
                    <div class="restaurant-search__box">
                        <svg class="restaurant-search__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="11" cy="11" r="7" stroke="#7D7D7D" stroke-width="1.8"/>
                            <path d="M16.5 16.5L21 21" stroke="#7D7D7D" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                        <input
                            type="text"
                            class="restaurant-search__input js-restaurant-search-input"
                            placeholder="Поиск по меню ресторана"
                            autocomplete="off"
                        />
                        <button type="button" class="restaurant-search__clear js-restaurant-search-clear" style="display:none">×</button>
                    </div>
                </div>

                <button type="button" class="reviews-btn js-reviews-btn">
                    <svg class="reviews-btn__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Отзывы
                </button>

                <div class="js-dish-content">
                    {{~it.sections :sec :idx}}
                        <h2 class="restaurant-section-title" id="dish-section-{{!idx}}">{{!sec.name}}</h2>
                        <div class="res-grid">
                            {{~sec.dishes :dish}}
                                <div class="dish-card" data-dish-id="{{!dish.id}}">
                                    <img
                                        class="dish-card__img"
                                        src="{{!dish.image_url}}"
                                        alt="{{!dish.name}}"
                                        onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'"
                                    />
                                    <div class="dish-card__prices">
                                        <div class="dish-card__price">{{!dish.price_rub.toFixed(2)}} ₽</div>
                                    </div>
                                    <div class="dish-card__title">{{!dish.name}}</div>
                                    <div class="dish-card__desc">
                                        {{!dish.description || 'Описание появится позже'}}
                                    </div>
                                    <button
                                        class="button js-add-to-cart dish-card__add-btn"
                                        type="button"
                                        data-id="{{!dish.id}}"
                                        data-name="{{!dish.name}}"
                                        data-price="{{!dish.price}}"
                                        data-image="{{!dish.image_url}}"
                                    >
                                        В корзину
                                    </button>
                                </div>
                            {{~}}
                        </div>
                    {{~}}
                </div>
            </div>
        </main>

        <aside class="side-column restaurant-cart-column js-cart-sheet">
            <div class="card card_cart">
                <div class="cart-slot js-cart-slot"></div>
            </div>
        </aside>
    </div>
</div>
`;
