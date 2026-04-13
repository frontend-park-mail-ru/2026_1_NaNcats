export const checkoutTemplate = `
<div class="page-wrapper checkout-page" style="background: var(--bg-main); overflow-y: auto;">
    <!-- Хедер -->
    <header class="checkout-header">
        <div class="checkout-header__container">
            <div class="checkout-header__back router-link" href="/">
                <div class="back-icon-arrow"></div>
                <span>Назад</span>
            </div>
            <div class="checkout-header__right">
                <svg width="92" height="48" viewBox="0 0 92 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.25041 14.7383L6.66741 11.7649C7.04586 9.06656 8.28854 6.56348 10.2092 4.63077C11.5525 3.27909 13.2073 2.13454 15.1088 2.26004C19.2718 2.53482 24.2532 5.34815 24.7504 7.07684M6.25041 14.7383C16.0334 23.582 20.7504 20.5456 22.7504 19.5768M6.25041 14.7383L6.58686 19.1297C6.69558 20.5487 6.95546 21.9521 7.36209 23.316L8.25041 26.2956L9.77341 30.9509C10.63 33.5691 11.1292 36.4164 10.0789 38.9631C8.37705 43.0896 4.95506 45.5385 2.25049 44.9831M73.2931 2.57684V7.98829V17.332V21.6445V22.1999C73.2931 23.2019 72.7992 24.1394 71.9727 24.706C71.4669 25.0527 70.8685 25.2383 70.2552 25.2383C69.1065 25.2383 67.4343 25.2383 66.6962 25.2383C66.5174 25.2383 66.2894 25.2149 66.0358 25.1767C64.2479 24.907 62.7505 23.4526 62.7505 21.6445C62.7505 20.457 62.6962 18.957 62.7505 17.332C62.7522 17.2811 62.7563 17.2298 62.7626 17.1781C63.1157 14.2894 66.7861 13.0255 69.6962 13.0195C70.6885 13.0175 73.2931 13.7383 73.2931 15.8945M24.7504 32.7643C24.2504 32.0456 21.2465 31.2383 20.7504 31.2383C15.7504 31.2383 15.7504 37.5768 15.7504 37.5768L15.9944 40.0953C16.1584 41.7884 16.9958 43.4031 18.3901 44.3774C19.5381 45.1797 20.9909 45.078 22.3597 44.7818L24.7504 44.2643M46.9151 31.3268C46.7214 31.8737 46.6463 32.4864 46.6271 33.0318C46.5905 34.0703 46.7057 35.1106 46.7057 36.1497V37.5768V39.1237V40.6706C46.7057 40.6706 46.6419 41.927 46.799 42.9863C46.9313 43.8794 47.7005 44.4131 48.5573 44.6979L48.6691 44.7351C49.1632 44.8994 49.6805 44.9831 50.2012 44.9831C51.8835 44.9831 53.2728 43.7968 54.815 43.1246C55.5966 42.7838 56.008 42.8846 56.008 40.6706M56.008 40.6706C56.008 37.0619 56.008 31.3268 56.008 31.3268M56.008 40.6706L57.9151 45.2383M69.7504 36.0768C69.8331 35.981 69.8938 35.8573 69.9368 35.7149C70.4492 34.0185 69.8919 31.579 68.1419 31.2999C67.871 31.2567 67.5723 31.2383 67.2505 31.2383H65.2505H63.0595C62.5637 31.2383 62.1104 31.5184 61.8887 31.9619C61.7978 32.1437 61.7505 32.3441 61.7505 32.5473V33.2383C61.7505 33.8086 61.9869 34.7768 62.4321 35.9949C62.8731 37.2018 63.1941 38.4546 63.2505 39.7383V42.7383V45.2383M80.231 2.57684C80.231 3.57684 80.231 15.0719 80.231 17.5768C80.231 20.5456 80.231 25.2383 80.231 28.9206C80.231 32.5675 78.7504 34.4779 77.7504 36.3581C76.9851 37.7971 76.5126 38.7205 76.333 39.9712C76.2148 40.7941 76.4763 41.6149 76.9041 42.3277C77.4512 43.2397 78.2983 43.9331 79.3003 44.2895L80.6634 44.7743C81.0543 44.9133 81.4535 45.0289 81.864 45.0889C84.2971 45.4442 87.4094 45.1613 89.2505 43.5456M75.2505 28.9206H82.0915H87.6729M32.3945 24.8581C30.9866 23.9334 29.9759 22.5151 29.5616 20.8824L29.4761 20.5456C29.0045 19.1517 29.0329 17.6372 29.5563 16.2619L29.8409 15.5143L29.8638 15.4544C30.5378 13.6835 32.0108 12.3366 33.8347 11.8233L33.9831 11.7815C35.309 11.4083 36.726 11.5385 37.9617 12.1472C39.5122 12.9109 40.6214 14.3499 40.9653 16.0437L41.0493 16.4576C41.1161 16.7866 41.1571 17.1203 41.1718 17.4556L41.2504 19.2383L41.2358 19.6371C41.1804 21.1438 40.5513 22.5725 39.4772 23.6306C39.1343 23.9685 38.7513 24.2632 38.3368 24.5082L38.1134 24.6402C36.366 25.6731 34.2155 25.755 32.3945 24.8581ZM48.8945 24.8581C47.4866 23.9334 46.4759 22.5151 46.0616 20.8824L45.9761 20.5456C45.5045 19.1517 45.5329 17.6372 46.0563 16.2619L46.3409 15.5143L46.3637 15.4544C47.0378 13.6835 48.5108 12.3366 50.3347 11.8233L50.4831 11.7815C51.809 11.4083 53.226 11.5385 54.4617 12.1472C56.0122 12.9109 57.1214 14.3499 57.4653 16.0437L57.5493 16.4576C57.6161 16.7866 57.6571 17.1203 57.6718 17.4556L57.7504 19.2383L57.7358 19.6371C57.6804 21.1438 57.0513 22.5725 55.9772 23.6306C55.6343 23.9685 55.2513 24.2632 54.8368 24.5082L54.6134 24.6402C52.866 25.6731 50.7155 25.755 48.8945 24.8581ZM32.3945 44.2643C30.9866 43.3397 29.9759 41.9213 29.5616 40.2887L29.4761 39.9518C29.0045 38.558 29.0329 37.0434 29.5563 35.6682L29.8409 34.9206L29.8638 34.8606C30.5378 33.0898 32.0108 31.7429 33.8347 31.2295L33.9831 31.1877C35.309 30.8145 36.726 30.9448 37.9617 31.5534C39.5122 32.3172 40.6214 33.7561 40.9653 35.45L41.0493 35.8639C41.1161 36.1929 41.1571 36.5265 41.1718 36.8619L41.2504 38.6445L41.2358 39.0433C41.1804 40.5501 40.5514 41.9787 39.4772 43.0369C39.1343 43.3748 38.7513 43.6695 38.3368 43.9144L38.1134 44.0465C36.366 45.0794 34.2155 45.1613 32.3945 44.2643Z" stroke="#FFC1C1" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="checkout-header__right">
                <div class="notif-btn">
                    <div class="notif-btn__icon">
                        <svg width="21" height="24" viewBox="0 0 21 24" fill="none">
                            <path d="M10.5422 23.89C11.6667 23.89 12.5714 22.9852 12.5714 21.8608H8.513C8.513 22.9852 9.41776 23.89 10.5422 23.89ZM18.6589 16.7878V10.7003C18.6589 7.54519 16.9748 4.88725 14.0933 4.18721V3.59554C14.0933 1.63751 12.5002 0.0444336 10.5422 0.0444336C8.58414 0.0444336 6.99105 1.63751 6.99105 3.59554V4.18721C4.10955 4.88725 2.42546 7.53504 2.42546 10.7003V16.7878L0.396286 18.8169V19.8315H20.6881V18.8169L18.6589 16.7878ZM16.6297 17.8024H4.45463V10.7003C4.45463 8.01188 6.07792 5.62804 8.513 5.62804H12.5714C15.0065 5.62804 16.6297 8.01188 16.6297 10.7003V17.8024Z" fill="#FFC1C1"/>
                        </svg>
                    </div>
                </div>
                <div class="user-menu-wrapper">
                    <a href="/profile" class="user-profile router-link">
                        <img src="{{!it.user.avatar_url}}" class="user-profile__avatar" onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'">
                    </a>
                    <div class="user-dropdown">
                        <div class="user-dropdown__item user-dropdown__item_logout" id="logout-btn">Выйти</div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <div class="checkout-content">
        <!-- ЛЕВАЯ КОЛОНКА: Настройки заказа -->
        <main class="checkout-main">
            <h1 class="checkout-title">Оформление заказа</h1>
            
            <div class="checkout-card">
                <div class="checkout-card__header">
                    <h2 class="checkout-card__title">Условия доставки</h2>
                </div>
                
                <div class="delivery-types">
                    <div class="delivery-type active">
                        <div class="delivery-type__title">Стандарт</div>
                        <div class="delivery-type__price">699 ₽</div>
                    </div>
                    <div class="delivery-type">
                        <div class="delivery-type__title">Заказ другому</div>
                        <div class="delivery-type__price">699 ₽</div>
                    </div>
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
                            {{? it.selectedAddress.entrance }}, под. {{!it.selectedAddress.entrance}}{{?}}
                            {{? it.selectedAddress.floor }}, эт. {{!it.selectedAddress.floor}}{{?}}
                        </div>
                        <button class="button button_ghost js-open-address-modal" style="height: 30px; margin: 0; padding: 0 10px;">Изменить</button>
                    </div>

                    <div class="address-details-grid">
                        <div class="address-detail-box">Кв./офис: <br><b>{{!it.selectedAddress.apartment || '-'}}</b></div>
                        <div class="address-detail-box">Домофон: <br><b>{{!it.selectedAddress.door_code || '-'}}</b></div>
                        <div class="address-detail-box">Подъезд: <br><b>{{!it.selectedAddress.entrance || '-'}}</b></div>
                        <div class="address-detail-box">Этаж: <br><b>{{!it.selectedAddress.floor || '-'}}</b></div>
                    </div>

                    <div class="address-comment">
                        Комментарий курьеру: {{!it.selectedAddress.courier_comment || 'Нет комментария'}}
                    </div>
                {{?}}
            </div>

            <div class="checkout-card mt-20">
                <h2 class="checkout-card__title">Время доставки</h2>
                <div class="time-display">
                    ⏱️ 45-55 минут
                </div>
                <button class="button button_secondary mt-20 js-open-cart-modal" style="width: 100%;">
                    Посмотреть состав заказа
                </button>
            </div>
        </main>

        <!-- ПРАВАЯ КОЛОНКА: Оплата и Итог -->
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
                
                <div class="summary-row">
                    <span>Товары в заказе</span>
                    <span>{{!it.cartItemsTotal}} ₽</span>
                </div>
                <div class="summary-row">
                    <span>Доставка</span>
                    <span>{{!it.deliveryFee}} ₽</span>
                </div>
                <div class="summary-row">
                    <span>Сервисный сбор</span>
                    <span>{{!it.serviceFee}} ₽</span>
                </div>

                <div class="promo-input-wrapper mt-10">
                    <input type="text" class="input-field promo-input" placeholder="У меня есть промокод">
                </div>
                
                <div class="checkout-total-row mt-20">
                    <button class="button button_primary js-pay-btn" style="width: auto; padding: 0 40px; margin: 0;" {{? !it.selectedAddress || it.cartItemsTotal === 0}}disabled{{?}}>
                        Оплатить
                    </button>
                    <div class="checkout-total-price">{{!it.grandTotal}} ₽</div>
                </div>
                <div id="checkout-error" class="error-msg" style="text-align: right; margin-top: 5px;"></div>
            </div>
        </aside>
    </div>

    <!-- МОДАЛКИ -->

    <!-- Модалка корзины -->
    <div class="modal-overlay js-cart-modal">
        <div class="checkout-modal">
            <div class="checkout-modal__close js-close-cart-modal">&times;</div>
            <h2 class="checkout-modal__title">Состав заказа</h2>
            <div class="checkout-modal__content" style="max-height: 400px; overflow-y: auto;">
                {{? it.cart && it.cart.items.length > 0 }}
                    {{~ it.cart.items :item }}
                        <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                            <img src="{{!item.image_url}}" style="width: 50px; height: 50px; border-radius: 12px; object-fit: cover; margin-right: 15px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 500; font-size: 14px;">{{!item.name}}</div>
                                <div style="color: #777; font-size: 12px;">{{!item.quantity}} шт. х {{!item.price / 1000000}} ₽</div>
                            </div>
                            <div style="font-weight: 700;">{{!(item.price * item.quantity) / 1000000}} ₽</div>
                        </div>
                    {{~}}
                {{??}}
                    <p>Корзина пуста</p>
                {{?}}
            </div>
        </div>
    </div>

    <!-- Модалка выбора адреса -->
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

    <!-- Модалка выбора карты -->
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
                                <div style="font-size: 12px; color: #777;">{{!card.card_type}}</div>
                            </div>
                        {{~}}
                    {{?}}
                </div>
            </div>
        </div>
    </div>
    <div id="checkout-address-picker-container" class="mt-20"></div>
</div>
`;
