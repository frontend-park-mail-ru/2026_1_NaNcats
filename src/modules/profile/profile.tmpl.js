export const profileTemplate = `
<div class="profile-page">
    <header class="profile-header">
        <div class="profile-header__container">
            <div class="profile-header__back router-link" href="/">
                <div class="back-icon-arrow"></div>
                <span>Назад</span>
            </div>
            
            <div class="profile-header__right">
                <div class="logo-bars">
                    <div class="bar bar-1"></div>
                    <div class="bar bar-2"></div>
                    <div class="bar bar-3"></div>
                    <div class="bar bar-4"></div>
                </div>
                <img class="logo-avatar" src="{{=it.user.avatar_url || 'https://placehold.co/40x40'}}" alt="mini-avatar">
            </div>
        </div>
    </header>

    <div class="profile-content">
        <!-- ЛЕВАЯ КОЛОНКА -->
        <aside class="profile-sidebar">
            <!-- Имя и Аватар -->
            <div class="profile-card profile-card_user">
                <div class="profile-user-info">
                    <input type="text" id="profile-name" class="profile-input profile-input_name" value="{{=it.user.name}}" disabled>
                    <div class="edit-icon-orange" id="edit-profile-btn"></div>
                </div>
                <div class="profile-avatar-wrapper">
                    <img id="profile-avatar-img" class="profile-avatar-img" src="{{=it.user.avatar_url || 'https://placehold.co/100x100'}}" alt="avatar">
                    <div class="avatar-overlay" id="upload-avatar-btn">📷</div>
                    <input type="file" id="avatar-input" accept="image/png, image/jpeg, image/webp" hidden>
                </div>
                {{? it.user.avatar_url }}
                    <div class="delete-avatar-link" id="delete-avatar-btn">Удалить аватар</div>
                {{?}}
            </div>

            <!-- Детали аккаунта -->
            <div class="profile-card">
                <div class="info-group">
                    <label class="info-label">Почта</label>
                    <div class="info-row">
                        <input type="email" id="profile-email" class="profile-input profile-input_email" value="{{=it.user.email}}" disabled>
                        <div class="edit-icon-orange"></div>
                    </div>
                </div>
                <div class="info-group">
                    <label class="info-label">Пароль</label>
                    <div class="link-orange">Сменить пароль</div>
                </div>
                <div class="info-group">
                    <label class="info-label">Подписка</label>
                    <div class="subscription-status">Обычная</div>
                    <p class="subscription-text">Оформи подписку <span class="link-orange">Премиум</span> для дополнительных бонусов и привилегий</p>
                </div>
                <button id="save-profile-btn" class="button button_primary hidden" style="height: 40px; margin-top: 10px;">Сохранить</button>
                <div id="profile-error" class="error-msg"></div>
            </div>

            <!-- Стрик -->
            <div class="profile-card profile-card_row">
                <div class="card-label-row">
                    <span>Стрик</span>
                    <div class="orange-dot-small"></div>
                </div>
                <div class="card-value-text">14 недель - так держать! 🔥</div>
            </div>

            <!-- Пять букв -->
            <div class="profile-card profile-card_row">
                <span class="card-label-row">Пять букв</span>
                <p class="card-subtext">Вы ещё не отгадали сегодняшнее слово в игре «5 букв», <span class="link-orange">попробуйте</span>!</p>
            </div>

            <!-- Бонусы -->
            <div class="profile-card profile-card_row profile-card_bonuses">
                <div class="bonuses-left">
                    <div class="bonuses-num">67</div>
                    <div class="info-label">Мои бонусы:</div>
                </div>
                <p class="card-subtext">Успей использовать 67 бонусов до их <span class="text-red">сгорания 01.04.2026</span></p>
            </div>
        </aside>

        <!-- ПРАВАЯ КОЛОНКА -->
        <main class="profile-main">
            <div class="profile-card profile-card_main">
                <div class="section-header">
                    <h2 class="section-title">Адреса доставки</h2>
                    <div class="orange-dot-large"></div>
                </div>
                
                <div class="address-list" id="profile-address-list">
                    {{? it.addresses && it.addresses.length > 0 }}
                        {{~it.addresses :addr}}
                        <div class="address-row" data-id="{{=addr.id}}">
                            <span class="address-row__text">{{=addr.location.address_text}}...</span>
                            <div class="address-row__actions">
                                <div class="edit-icon-orange edit-addr-btn" data-id="{{=addr.id}}"></div>
                                <div class="delete-icon-orange delete-addr-btn" data-id="{{=addr.id}}"></div>
                            </div>
                        </div>
                        {{~}}
                    {{??}}
                        <div class="empty-text">У вас пока нет сохраненных адресов</div>
                    {{?}}
                    <div class="link-orange mt-10" id="add-address-btn">+ добавить адрес</div>
                </div>

                <div class="section-header mt-30">
                    <h2 class="section-title">Карты и оплата</h2>
                    <div class="orange-dot-large"></div>
                </div>

                <div class="cards-grid" id="profile-cards-list">
                    {{? it.cards && it.cards.length > 0 }}
                        {{~it.cards :card}}
                        <div class="mini-card {{= card.issuer_name && card.issuer_name.toLowerCase().includes('sber') ? 'mini-card_sber' : 'mini-card_tinkoff' }}">
                            <div class="mini-card__top">
                                <div class="mini-card__logo"></div>
                            </div>
                            <div class="mini-card__number">** {{=card.last4}}</div>
                            <div class="mini-card__delete delete-card-btn" data-id="{{=card.id}}">×</div>
                        </div>
                        {{~}}
                    {{?}}
                    <div class="mini-card mini-card_add" id="add-card-btn">+</div>
                </div>
            </div>

            <div class="profile-card profile-card_main profile-card_orders">
                <h2 class="section-title">История заказов</h2>
                <div class="orders-list">
                    <div class="order-row">
                        <img class="order-row__img" src="https://placehold.co/75x75" alt="order">
                        <div class="order-row__date">15.03.2026</div>
                        <div class="order-row__info">
                            <div class="order-row__name">4 вида премиума метр</div>
                            <div class="order-row__meta">2 кг</div>
                        </div>
                        <div class="order-row__price">4 317,20₽</div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <div id="profile-address-picker-container"></div>
    <div class="modal-overlay" id="address-details-modal">
        <div class="address-modal" style="width: 500px;">
            <div class="address-modal__close" id="close-details-modal">&times;</div>
            <h2 class="section-title">Детали адреса</h2>
            <form id="address-full-form" class="auth-form" style="max-width:100%">
                <div class="input-group">
                    <label class="info-label">Адрес</label>
                    <input type="text" id="display-address-text" class="input-field" disabled style="background:#eee">
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div class="input-group"><label class="info-label">Квартира</label><input name="apartment" class="input-field"></div>
                    <div class="input-group"><label class="info-label">Подъезд</label><input name="entrance" class="input-field"></div>
                    <div class="input-group"><label class="info-label">Этаж</label><input name="floor" class="input-field"></div>
                    <div class="input-group"><label class="info-label">Код</label><input name="door_code" class="input-field"></div>
                </div>
                <div class="input-group">
                    <label class="info-label">Комментарий</label>
                    <input name="courier_comment" class="input-field">
                </div>
                <button type="submit" class="button button_primary" style="height: 48px; margin-top: 20px;">Сохранить адрес</button>
            </form>
        </div>
    </div>
</div>
`;