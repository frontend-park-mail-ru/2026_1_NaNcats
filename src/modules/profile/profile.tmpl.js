export const profileTemplate = `
<div class="profile-page">
    <header class="profile-header">
        <div class="profile-header__back router-link" href="/">
            <div class="back-icon"></div>
            <span>Назад</span>
        </div>
        <div class="profile-header__logo">
            <!-- Твой логотип из фигмы -->
            <div class="logo-bars">
                <div class="bar bar-1"></div>
                <div class="bar bar-2"></div>
                <div class="bar bar-3"></div>
                <div class="bar bar-4"></div>
            </div>
            <img class="logo-avatar" src="{{=it.user.avatar_url || 'https://placehold.co/40x40'}}" alt="mini-avatar">
        </div>
    </header>

    <div class="profile-content">
        <!-- ЛЕВАЯ КОЛОНКА (Инфо пользователя) -->
        <aside class="profile-sidebar">
            <div class="profile-card profile-user">
                <div class="profile-user__header">
                    <input type="text" id="profile-name" class="profile-input profile-input_name" value="{{=it.user.name}}" disabled>
                    <div class="edit-icon" id="edit-profile-btn" title="Редактировать">✏️</div>
                </div>
                
                <div class="profile-avatar-container">
                    <img id="profile-avatar-img" class="profile-avatar" src="{{=it.user.avatar_url || 'https://placehold.co/100x100'}}" alt="avatar">
                    <div class="profile-avatar-overlay" id="upload-avatar-btn">📷</div>
                    <input type="file" id="avatar-input" accept="image/png, image/jpeg, image/webp" hidden>
                </div>
                {{? it.user.avatar_url }}
                    <div class="delete-avatar" id="delete-avatar-btn">Удалить аватар</div>
                {{?}}
            </div>

            <div class="profile-card profile-details">
                <div class="detail-group">
                    <span class="detail-label">Почта</span>
                    <div class="detail-row">
                        <input type="email" id="profile-email" class="profile-input profile-input_email" value="{{=it.user.email}}" disabled>
                    </div>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Пароль</span>
                    <span class="detail-value link-orange">Сменить пароль</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Подписка</span>
                    <span class="detail-value text-gray">Обычная</span>
                    <span class="detail-subtext">Оформи подписку <span class="link-orange">Премиум</span> для дополнительных бонусов и привилегий</span>
                </div>
                
                <button id="save-profile-btn" class="button button_primary hidden">Сохранить изменения</button>
                <div id="profile-error" class="error-msg"></div>
            </div>

            <div class="profile-card flex-row space-between">
                <div class="flex-row gap-5 align-center">
                    <span class="detail-label m-0">Стрик</span>
                    <div class="orange-dot"></div>
                </div>
                <span class="detail-value">14 недель - так держать! 🔥</span>
            </div>

            <div class="profile-card flex-row space-between">
                <span class="detail-label m-0">Пять букв</span>
                <span class="detail-subtext w-200">Вы ещё не отгадали сегодняшнее слово в игре «5 букв», <span class="link-orange">попробуйте</span>!</span>
            </div>

            <div class="profile-card flex-row align-center gap-20">
                <div class="bonuses-count">
                    <span class="bonuses-number">67</span>
                    <span class="detail-label">Мои бонусы:</span>
                </div>
                <span class="detail-subtext w-200">Успей использовать 67 бонусов до их <span class="text-red">сгорания 01.04.2026</span></span>
            </div>
        </aside>

        <!-- ПРАВАЯ КОЛОНКА (Адреса, Карты, Заказы) -->
        <main class="profile-main">
            <div class="profile-card p-20">
                <div class="section-header">
                    <h2>Адреса доставки</h2>
                    <div class="orange-dot-large"></div>
                    <button class="link-orange" id="add-address-btn" style="background:none; border:none; margin-left:auto; cursor:pointer;">+ Добавить</button>
                </div>
                <div class="address-list" id="profile-address-list">
                    {{? it.addresses && it.addresses.length > 0 }}
                        {{~it.addresses :addr}}
                        <div class="address-item" data-id="{{=addr.id}}">
                            <div class="address-info">
                                <span class="address-text">{{=addr.location.address_text}}</span>
                                <span class="address-details">
                                    {{=addr.apartment ? 'кв. ' + addr.apartment : ''}} 
                                    {{=addr.entrance ? 'под. ' + addr.entrance : ''}}
                                    {{=addr.floor ? 'эт. ' + addr.floor : ''}}
                                </span>
                            </div>
                            <div class="address-actions">
                                <span class="edit-addr-btn" data-id="{{=addr.id}}">✏️</span>
                                <span class="delete-addr-btn" data-id="{{=addr.id}}">🗑️</span>
                            </div>
                        </div>
                        {{~}}
                    {{??}}
                        <span class="text-gray">У вас пока нет сохраненных адресов</span>
                    {{?}}
                </div>

                <div class="section-header mt-20">
                    <h2>Карты и оплата</h2>
                    <div class="orange-dot-large"></div>
                </div>
                <div class="cards-list">
                    <div class="pay-card pay-card_sber">
                        <span class="card-number">** 2974</span>
                    </div>
                    <div class="pay-card pay-card_tinkoff">
                        <span class="card-number">** 2974</span>
                    </div>
                    <div class="pay-card pay-card_sbp">
                        <span class="card-number">СБП</span>
                    </div>
                </div>
            </div>

            <div class="profile-card p-20 orders-card">
                <h2 class="orders-title">История заказов</h2>
                <div class="order-item">
                    <img src="https://placehold.co/75x75" alt="order">
                    <span class="order-date">15.03.2026</span>
                    <div class="order-info">
                        <span class="order-name">4 вида премиума метр</span>
                        <span class="order-weight">2 кг</span>
                    </div>
                    <span class="order-price">4 317,20₽</span>
                </div>
                <div class="order-item">
                    <img src="https://placehold.co/75x75" alt="order">
                    <span class="order-date">15.03.2026</span>
                    <div class="order-info">
                        <span class="order-name">4 вида премиума метр</span>
                        <span class="order-weight">2 кг</span>
                    </div>
                    <span class="order-price">4 317,20₽</span>
                </div>
            </div>
        </main>
    </div>
    <div id="profile-address-picker-container"></div>

    <div class="modal-overlay" id="address-details-modal">
        <div class="address-modal" style="width: 500px;">
            <div class="address-modal__close" id="close-details-modal">&times;</div>
            <h2>Детали адреса</h2>
            <form id="address-full-form" class="auth-form" style="max-width:100%">
                <div class="input-group">
                    <label>Адрес</label>
                    <input type="text" id="display-address-text" class="input-field" disabled style="background:#eee">
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div class="input-group"><label>Квартира</label><input name="apartment" class="input-field"></div>
                    <div class="input-group"><label>Подъезд</label><input name="entrance" class="input-field"></div>
                    <div class="input-group"><label>Этаж</label><input name="floor" class="input-field"></div>
                    <div class="input-group"><label>Код двери</label><input name="door_code" class="input-field"></div>
                </div>
                <div class="input-group">
                    <label>Комментарий курьеру</label>
                    <input name="courier_comment" class="input-field">
                </div>
                <button type="submit" class="button button_primary">Сохранить адрес</button>
            </form>
        </div>
    </div>
</div>
`;
