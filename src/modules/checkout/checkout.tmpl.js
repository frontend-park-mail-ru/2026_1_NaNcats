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
                <svg width="76" height="31" viewBox="0 0 76 31" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M44.9107 19.8461C44.9108 18.9787 45.6535 18.2754 46.5696 18.2754C47.4856 18.2755 48.2284 18.9788 48.2285 19.8461V25.3289L49.6306 27.856C50.0568 28.6237 49.7455 29.5729 48.9348 29.9766C48.1239 30.3802 47.1206 30.0849 46.6943 29.317L46.3371 28.6743C46.3313 28.676 46.3262 28.6789 46.3209 28.6805C45.6969 28.8677 45.2321 29.0983 44.3898 29.4183C43.6533 29.6981 42.7247 29.9973 41.6738 29.9973C41.1244 29.9973 40.577 29.9299 40.0457 29.7971L39.9655 29.7764C39.0885 29.5572 37.4395 28.9082 37.1961 27.1658C37.1404 26.7669 37.128 26.3806 37.128 26.1089C37.128 25.9698 37.1312 25.8523 37.1345 25.7676C37.1361 25.7251 37.138 25.6904 37.1394 25.6649V23.4338C37.1394 22.9656 37.094 22.5911 37.0624 21.9674C37.0344 21.4149 37.027 20.7484 37.1758 20.0539C37.2328 19.7879 37.3205 19.4977 37.4577 19.2065C37.8309 18.4142 38.8121 18.0586 39.6488 18.4119C40.4854 18.7653 40.8611 19.6943 40.488 20.4865C40.4682 20.5285 40.4459 20.5913 40.4272 20.6782C40.3612 20.986 40.3522 21.3422 40.3762 21.8171C40.3966 22.2209 40.4572 22.8793 40.4572 23.4338V25.717C40.4572 25.75 40.4553 25.783 40.4531 25.8159L40.454 25.8167C40.4538 25.8187 40.4534 25.8219 40.4531 25.8259C40.4525 25.8374 40.4517 25.8567 40.4507 25.8827C40.4487 25.9356 40.4459 26.0146 40.4459 26.1097C40.4458 26.2653 40.4524 26.4448 40.4693 26.6174C40.4864 26.6261 40.506 26.637 40.5301 26.6473C40.6039 26.6789 40.6986 26.7108 40.8128 26.7393L40.893 26.7593C41.1478 26.823 41.4103 26.8559 41.6738 26.8559C42.0775 26.8559 42.5286 26.7409 43.1546 26.5031C43.5833 26.3402 44.2569 26.0462 44.9074 25.8198C44.908 25.7878 44.9107 25.7536 44.9107 25.717V19.8461ZM50.9607 28.5869V25.1832C50.9235 24.6485 50.7473 24.0835 50.4536 23.4852C50.2394 23.0488 50.0621 22.6306 49.9352 22.2481C49.8165 21.8901 49.7076 21.4648 49.7076 21.0471V20.6736C49.7076 20.2112 49.846 19.7581 50.1061 19.3667L50.1993 19.2364C50.6845 18.6007 51.4647 18.2202 52.2997 18.2202H55.9618C56.2424 18.2202 56.5273 18.2307 56.8066 18.2593C58.2519 18.407 59.2663 19.445 59.7308 20.3783C60.1849 21.2909 60.4514 22.8721 59.1735 23.986C58.4994 24.5735 57.4498 24.533 56.8293 23.8948C56.26 23.3093 56.2509 22.4252 56.7734 21.8294C56.7644 21.7995 56.7509 21.7616 56.7288 21.7174C56.669 21.5973 56.5824 21.4936 56.5004 21.4283C56.4633 21.3987 56.4381 21.3852 56.4267 21.38C56.2999 21.368 56.1461 21.3616 55.9618 21.3616H53.1194C53.1926 21.5718 53.3045 21.8404 53.462 22.1615C53.878 23.0091 54.2141 23.9832 54.2761 25.0444C54.2778 25.0733 54.2785 25.1022 54.2785 25.1311V28.5869C54.2784 29.4542 53.5357 30.1576 52.6196 30.1576C51.7037 30.1574 50.9609 29.4541 50.9607 28.5869ZM65.1474 1.78314C65.1475 0.91579 65.8902 0.212444 66.8063 0.212444C67.7222 0.212635 68.465 0.915908 68.4652 1.78314V16.7638H73.0232C73.9393 16.7638 74.682 17.4671 74.6821 18.3344C74.6821 19.2019 73.9393 19.9051 73.0232 19.9051H68.2902C67.8461 21.8595 66.6652 23.0989 66.1121 23.881C65.4947 24.7539 65.2966 25.0819 65.2033 25.4578C65.2024 25.4659 65.2025 25.4952 65.2219 25.5544C65.251 25.6433 65.3157 25.7677 65.4301 25.911C65.619 26.1478 65.8843 26.3196 66.1858 26.4003L68.0011 26.8858C68.8947 27.013 69.9624 27.0517 70.9714 26.9449C72.0388 26.8318 72.8773 26.5748 73.3925 26.2347C74.1441 25.7387 75.178 25.9134 75.7019 26.6251C76.2257 27.3367 76.0412 28.3156 75.2896 28.8116C74.1341 29.5742 72.6751 29.9257 71.3408 30.0671C69.9794 30.2113 68.576 30.1546 67.3976 29.9774C67.3333 29.9677 67.2691 29.9542 67.2064 29.9375L65.2843 29.4236C64.2862 29.1567 63.4073 28.5882 62.7821 27.8046C62.2286 27.1108 61.6599 26.002 61.9737 24.7384C62.2272 23.7176 62.7926 22.928 63.3548 22.1331C63.9711 21.2617 64.5198 20.6547 64.8428 19.9051H62.6452C61.729 19.9051 60.9863 19.2019 60.9863 18.3344C60.9864 17.467 61.7291 16.7638 62.6452 16.7638H65.1474V1.78314Z" fill="#FFC1C1"/>
                </svg>
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
                            {{=it.selectedAddress.location.address_text}}
                            {{? it.selectedAddress.apartment }}, кв. {{=it.selectedAddress.apartment}}{{?}}
                            {{? it.selectedAddress.entrance }}, под. {{=it.selectedAddress.entrance}}{{?}}
                            {{? it.selectedAddress.floor }}, эт. {{=it.selectedAddress.floor}}{{?}}
                        </div>
                        <button class="button button_ghost js-open-address-modal" style="height: 30px; margin: 0; padding: 0 10px;">Изменить</button>
                    </div>

                    <div class="address-details-grid">
                        <div class="address-detail-box">Кв./офис: <br><b>{{=it.selectedAddress.apartment || '-'}}</b></div>
                        <div class="address-detail-box">Домофон: <br><b>{{=it.selectedAddress.door_code || '-'}}</b></div>
                        <div class="address-detail-box">Подъезд: <br><b>{{=it.selectedAddress.entrance || '-'}}</b></div>
                        <div class="address-detail-box">Этаж: <br><b>{{=it.selectedAddress.floor || '-'}}</b></div>
                    </div>

                    <div class="address-comment">
                        Комментарий курьеру: {{=it.selectedAddress.courier_comment || 'Нет комментария'}}
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
                        <div class="payment-display__text">**{{=it.selectedCard.last4}}</div>
                        <button class="button button_ghost js-open-payment-modal" style="height: 30px; margin: 0; padding: 0 10px;">Изменить</button>
                    </div>
                {{?}}
            </div>

            <div class="checkout-card mt-20">
                <h2 class="checkout-card__title">Что в цене</h2>
                
                <div class="summary-row">
                    <span>Товары в заказе</span>
                    <span>{{=it.cartItemsTotal}} ₽</span>
                </div>
                <div class="summary-row">
                    <span>Доставка</span>
                    <span>{{=it.deliveryFee}} ₽</span>
                </div>
                <div class="summary-row">
                    <span>Сервисный сбор</span>
                    <span>{{=it.serviceFee}} ₽</span>
                </div>

                <div class="promo-input-wrapper mt-10">
                    <input type="text" class="input-field" placeholder="У меня есть промокод">
                </div>
                
                <div class="checkout-total-row mt-20">
                    <button class="button button_primary js-pay-btn" style="width: auto; padding: 0 40px; margin: 0;" {{? !it.selectedAddress || it.cartItemsTotal === 0}}disabled{{?}}>
                        Оплатить
                    </button>
                    <div class="checkout-total-price">{{=it.grandTotal}} ₽</div>
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
                            <img src="{{=item.image_url}}" style="width: 50px; height: 50px; border-radius: 12px; object-fit: cover; margin-right: 15px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 500; font-size: 14px;">{{=item.name}}</div>
                                <div style="color: #777; font-size: 12px;">{{=item.quantity}} шт. х {{=item.price / 1000000}} ₽</div>
                            </div>
                            <div style="font-weight: 700;">{{=(item.price * item.quantity) / 1000000}} ₽</div>
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
                            <div class="selection-item js-select-address {{? it.selectedAddress && it.selectedAddress.id === addr.id }}selection-item_active{{?}}" data-id="{{=addr.id}}">
                                <div style="font-weight: 600;">{{=addr.location.address_text}}</div>
                                <div style="font-size: 12px; color: #777;">Кв. {{=addr.apartment || '-'}}, эт. {{=addr.floor || '-'}}</div>
                            </div>
                        {{~}}
                    {{??}}
                        <p class="empty-text">У вас нет сохраненных адресов.</p>
                    {{?}}
                </div>
                <div id="checkout-address-picker-container" class="mt-20"></div>
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
                            <div class="selection-item js-select-card {{? it.selectedCard && it.selectedCard.id === card.id }}selection-item_active{{?}}" data-id="{{=card.id}}">
                                <div style="font-weight: 600;">💳 **{{=card.last4}}</div>
                                <div style="font-size: 12px; color: #777;">{{=card.card_type}}</div>
                            </div>
                        {{~}}
                    {{?}}
                </div>
            </div>
        </div>
    </div>
</div>
`;
