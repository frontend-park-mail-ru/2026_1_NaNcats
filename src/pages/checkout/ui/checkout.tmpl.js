export const checkoutPageTemplate = `
<div class="page-wrapper checkout-page" style="background: var(--bg-main); overflow-y: auto;">
    <header class="checkout-header">
        <div class="checkout-header__container">
            <a class="checkout-header__back router-link" href="/" style="text-decoration: none;">
                <div class="back-icon-arrow"></div>
                <span>Назад</span>
            </a>
        </div>
    </header>

    <div class="checkout-content">
        <main class="checkout-main">
            <h1 class="checkout-title">Оформление заказа</h1>

            <div class="checkout-card">
                <div class="checkout-card__header">
                    <h2 class="checkout-card__title">Условия доставки</h2>
                </div>
                {{? !it.selectedAddress }}
                    <div class="checkout-warning">
                        ⚠️ Необходимо добавить или выбрать адрес доставки
                        <button class="button button_primary mt-10 js-open-address-modal" style="height: 40px; width: 200px;">Выбрать адрес</button>
                    </div>
                {{??}}
                    <div class="address-display">
                        <div class="address-display__icon">🏠</div>
                        <div class="address-display__text">
                            {{!it.selectedAddress.location.address_text}}
                            {{? it.selectedAddress.apartment }}, кв. {{!it.selectedAddress.apartment}}{{?}}
                        </div>
                        <button class="button button_ghost js-open-address-modal" style="height: 30px; margin: 0; padding: 0 10px;">Изменить</button>
                    </div>
                {{?}}
            </div>

            <div class="checkout-card mt-20">
                <h2 class="checkout-card__title">Время доставки</h2>
                <div class="time-display">⏱️ 45-55 минут</div>
                <button class="button button_secondary mt-20 js-open-cart-modal" style="width: 100%;">
                    Посмотреть состав заказа
                </button>
            </div>
        </main>

        <aside class="checkout-sidebar">
            <div class="checkout-card">
                <div class="checkout-card__header">
                    <h2 class="checkout-card__title">Способ оплаты</h2>
                </div>
                {{? !it.selectedCard }}
                    <div class="payment-display">
                        <div class="payment-display__icon">💳</div>
                        <div class="payment-display__text">Стандартная оплата (новая карта)</div>
                        <button class="button button_ghost js-open-payment-modal" style="height: 30px; margin: 0; padding: 0 10px;">Изменить</button>
                    </div>
                {{??}}
                    <div class="payment-display">
                        <div class="payment-display__icon">💳</div>
                        <div class="payment-display__text">**{{!it.selectedCard.last4}}</div>
                        <button class="button button_ghost js-open-payment-modal" style="height: 30px; margin: 0; padding: 0 10px;">Изменить</button>
                    </div>
                {{?}}
            </div>

            <div class="checkout-card mt-20">
                <h2 class="checkout-card__title">Что в цене</h2>
                <div class="summary-row"><span>Товары в заказе</span><span>{{!it.cartItemsTotal}} ₽</span></div>
                <div class="summary-row"><span>Доставка</span><span>{{!it.deliveryFee}} ₽</span></div>
                <div class="summary-row"><span>Сервисный сбор</span><span>{{!it.serviceFee}} ₽</span></div>

                <div class="checkout-total-row mt-20">
                    <button class="button button_primary js-pay-btn" style="width: auto; padding: 0 40px; margin: 0;" {{? !it.selectedAddress || it.cartItemsTotal === '0.00'}}disabled{{?}}>
                        Оплатить
                    </button>
                    <div class="checkout-total-price">{{!it.grandTotal}} ₽</div>
                </div>
                <div class="error-msg js-checkout-error" style="text-align: right; margin-top: 5px;"></div>
            </div>
        </aside>
    </div>

    <div class="modal-overlay js-cart-modal">
        <div class="checkout-modal">
            <div class="checkout-modal__close js-close-cart-modal">&times;</div>
            <h2 class="checkout-modal__title">Состав заказа</h2>
            <div class="checkout-modal__content" style="max-height: 400px; overflow-y: auto;">
                {{? it.items && it.items.length > 0 }}
                    {{~ it.items :item }}
                        <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                            <img src="{{!item.image_url}}" style="width: 50px; height: 50px; border-radius: 12px; object-fit: cover; margin-right: 15px;" onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'">
                            <div style="flex: 1;">
                                <div style="font-weight: 500; font-size: 14px;">{{!item.name}}</div>
                                <div style="color: #777; font-size: 12px;">{{!item.quantity}} шт. х {{!(item.price / 1000000).toFixed(2)}} ₽</div>
                            </div>
                            <div style="font-weight: 700;">{{!((item.price * item.quantity) / 1000000).toFixed(2)}} ₽</div>
                        </div>
                    {{~}}
                {{??}}
                    <p>Корзина пуста</p>
                {{?}}
            </div>
        </div>
    </div>

    <div class="modal-overlay js-address-modal">
        <div class="checkout-modal" style="width: 500px;">
            <div class="checkout-modal__close js-close-address-modal">&times;</div>
            <h2 class="checkout-modal__title">Выберите адрес</h2>
            <div class="checkout-modal__content">
                <div class="selection-list">
                    {{? it.addresses && it.addresses.length > 0 }}
                        {{~ it.addresses :addr }}
                            <div class="selection-item js-select-address {{? it.selectedAddress && it.selectedAddress.id === addr.id }}selection-item_active{{?}}" data-id="{{!addr.id}}">
                                <div style="font-weight: 600;">{{!addr.location.address_text}}</div>
                                <div style="font-size: 12px; color: #777;">Кв. {{!addr.apartment || '-'}}, эт. {{!addr.floor || '-'}}</div>
                            </div>
                        {{~}}
                    {{??}}
                        <p class="empty-text">У вас нет сохраненных адресов.</p>
                    {{?}}
                </div>
                <button class="button button_primary mt-20 js-add-new-address-btn">Добавить новый адрес (Карта)</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay js-payment-modal">
        <div class="checkout-modal" style="width: 400px;">
            <div class="checkout-modal__close js-close-payment-modal">&times;</div>
            <h2 class="checkout-modal__title">Способ оплаты</h2>
            <div class="checkout-modal__content">
                <div class="selection-list">
                    <div class="selection-item js-select-card {{? !it.selectedCard }}selection-item_active{{?}}" data-id="">
                        <div style="font-weight: 600;">💳 Стандартная оплата</div>
                        <div style="font-size: 12px; color: #777;">Ввести реквизиты новой карты</div>
                    </div>
                    {{? it.cards && it.cards.length > 0 }}
                        {{~ it.cards :card }}
                            <div class="selection-item js-select-card {{? it.selectedCard && it.selectedCard.id === card.id }}selection-item_active{{?}}" data-id="{{!card.id}}">
                                <div style="font-weight: 600;">💳 **{{!card.last4}}</div>
                                <div style="font-size: 12px; color: #777;">{{!card.card_type || ''}}</div>
                            </div>
                        {{~}}
                    {{?}}
                </div>
            </div>
        </div>
    </div>

    <div class="js-picker-slot"></div>
    <div class="js-order-status-slot"></div>
</div>
`;
