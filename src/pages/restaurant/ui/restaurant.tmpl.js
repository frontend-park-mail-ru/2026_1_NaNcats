export const restaurantPageTemplate = `
<div class="page-wrapper restaurant-details-page">
    <div class="js-header-slot"></div>

    <div class="main-layout">
        <aside class="side-column">
            <div class="card card_fixed">
                <p class="label-text">Меню</p>
                <div class="categories-list">
                    <div class="category-item"><span>—</span><span>Выбор пользователей</span></div>
                    <div class="category-item"><span>—</span><span>Акции</span></div>
                    <div class="category-item"><span>—</span><span>Комбо</span></div>
                    <div class="category-item"><span>—</span><span>Пицца Метровая</span></div>
                    <div class="category-item"><span>—</span><span>Пицца круглая (35 см)</span></div>
                    <div class="category-item"><span>—</span><span>Пасты</span></div>
                    <div class="category-item"><span>—</span><span>Закуски</span></div>
                    <div class="category-item"><span>—</span><span>Соусы</span></div>
                    <div class="category-item"><span>—</span><span>Салаты</span></div>
                    <div class="category-item"><span>—</span><span>Бургеры</span></div>
                    <div class="category-item"><span>—</span><span>Десерты</span></div>
                    <div class="category-item"><span>—</span><span>Роллы</span></div>
                </div>
            </div>
        </aside>

        <main class="center-column">
            <div class="sheet">
                <div class="sheet__header" style="justify-content:center;">
                    <h1 class="sheet__title" style="text-align:center;">{{!it.restaurant.name}}</h1>
                </div>

                <div class="restaurant-hero" style="margin-bottom:14px;">
                    <img
                      class="restaurant-hero__img"
                      src="{{!it.restaurant.logo_url}}"
                      alt="{{!it.restaurant.name}}"
                      onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/restaurants/default-restaurant-logo.webp'"
                      style="width:100%; border-radius:20px; object-fit:cover; aspect-ratio: 16 / 5;"
                    />
                </div>

                <h2 style="margin: 0 0 14px 0; font-size:20px;">Выбор пользователей</h2>

                <div class="res-grid js-dish-grid">
                    {{~it.dishes :dish}}
                        <div class="dish-card" style="
                            background:#fff;
                            border-radius:18px;
                            padding:14px;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                            display:flex;
                            flex-direction:column;
                            gap:10px;
                        ">
                            <img
                              class="dish-card__img"
                              src="{{!dish.image_url}}"
                              alt="{{!dish.name}}"
                              onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'"
                              style="width:100%; border-radius:16px; aspect-ratio: 1 / 1; object-fit:cover;"
                            />
                            <div class="dish-card__prices" style="display:flex; gap:8px; align-items:baseline;">
                                <div style="color:#ff6b6b; font-weight:700;">{{!dish.price_rub.toFixed(2)}} ₽</div>
                            </div>
                            <div class="dish-card__title" style="font-weight:600;">{{!dish.name}}</div>
                            <div class="dish-card__desc" style="color:#777; font-size:12px; line-height:1.35;">
                                {{!dish.description || 'Описание появится позже'}}
                            </div>
                            <button class="button js-add-to-cart" type="button"
                                data-id="{{!dish.id}}"
                                data-name="{{!dish.name}}"
                                data-price="{{!dish.price}}"
                                data-image="{{!dish.image_url}}"
                                style="
                                margin-top:auto;
                                background: #FFE3E3;
                                border-radius: 14px;
                                padding: 10px 14px;
                                font-weight: 600;
                            ">В корзину</button>
                        </div>
                    {{~}}
                </div>
            </div>
        </main>

        <aside class="side-column">
            <div class="card card_cart js-cart-slot" style="flex: 1; padding: 15px; display: flex; flex-direction: column;"></div>
        </aside>
    </div>
</div>
`;
