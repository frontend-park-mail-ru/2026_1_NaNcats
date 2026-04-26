export const profilePageTemplate = `
<div class="profile-page">
    <header class="profile-header">
        <div class="profile-header__container">
            <a class="profile-header__back router-link" href="/">
                <div class="back-icon-arrow"></div>
                <span>Назад</span>
            </a>
            <div class="profile-header__right">
                <img class="logo-avatar" src="{{!it.user.avatar_url}}" alt="mini-avatar" onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/avatars/default-avatar.webp'">
            </div>
        </div>
    </header>

    <div class="profile-content">
        <aside class="profile-sidebar">

            <div class="profile-user-header">
                <div class="profile-avatar__wrapper">
                    <img id="profile-avatar-img" class="profile-avatar__img" src="{{!it.user.avatar_url}}" alt="avatar" onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/avatars/default-avatar.webp'">
                    <div class="profile-avatar__overlay js-upload-avatar">📷</div>
                    {{? it.user.avatar_url && it.user.avatar_url !== 'https://nancats-bucket.storage.yandexcloud.net/avatars/default-avatar.webp' }}
                        <div class="profile-avatar__delete-hover js-delete-avatar">Удалить</div>
                    {{?}}
                    <input type="file" class="js-avatar-input" accept="image/png, image/jpeg, image/webp" hidden>
                </div>
                <div class="profile-name-card">
                    <div class="profile-user-info">
                        <span class="profile-input profile-input_name">{{!it.user.name}}</span>
                    </div>
                </div>
            </div>

            <div class="profile-card profile-card_details">
                <div class="js-edit-form-slot"></div>
            </div>

            <div class="profile-card profile-card_row">
                <div class="card-side-label">
                    <span>Стрик</span>
                    <div class="orange-dot orange-dot_small"></div>
                </div>
                <div class="card-side-content card-value-text">{{!it.user.streak_weeks || 0}} нед. — так держать! 🔥</div>
            </div>

            <div class="profile-card profile-card_row">
                <div class="card-side-label">Пять букв</div>
                <div class="card-side-content card-subtext js-wordle-info">
                    Вы ещё не отгадали сегодняшнее слово в игре «5 букв»,
                    <span class="link-orange js-open-wordle">попробуйте</span>!
                </div>
            </div>

        </aside>

        <main class="profile-main">
            <div class="profile-card profile-card_main">
                <div class="section-header">
                    <h2 class="section-title">Адреса доставки</h2>
                    <div class="orange-dot orange-dot_large js-add-address"></div>
                </div>
                <div class="js-address-list-slot"></div>
            </div>

            <div class="profile-card profile-card_main">
                <div class="section-header">
                    <h2 class="section-title">Карты и оплата</h2>
                    <div class="orange-dot orange-dot_large js-add-card"></div>
                </div>
                <div class="js-card-list-slot"></div>
            </div>

            <div class="profile-card profile-card_main profile-card_orders">
                <h2 class="section-title">История заказов</h2>
                <div class="orders-list">
                    {{? it.orders && it.orders.length > 0 }}
                        {{~it.orders :order}}
                        <div class="order-row">
                            <img class="order-row__img" src="{{!order.restaurant_image_url || ''}}" alt="order" onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'">
                            <div class="order-row__date">{{!order.created_at || ''}}</div>
                            <div class="order-row__info">
                                <div class="order-row__name">{{!order.restaurant_name || 'Заказ'}}</div>
                                <div class="order-row__meta">Статус: {{!order.status}}</div>
                            </div>
                            <div class="order-row__price">{{!((order.total_cost || 0) / 1000000).toFixed(2)}}₽</div>
                        </div>
                        {{~}}
                    {{??}}
                        <div class="empty-text">История заказов пуста</div>
                    {{?}}
                </div>
            </div>
        </main>
    </div>

    <div class="js-picker-slot"></div>
    <div class="js-wordle-slot"></div>
</div>
`;
