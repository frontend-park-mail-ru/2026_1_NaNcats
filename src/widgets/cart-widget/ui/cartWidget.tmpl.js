export const cartWidgetTemplate = `
<div class="cart-wrapper">
    <div class="cart-header-top">
        <span class="cart-title">Корзина</span>

        <div class="cart-header-actions">
            {{? it.items.length > 0 }}
                <span class="js-clear-slot"></span>
            {{?}}

            <button
                type="button"
                class="cart-close-btn js-close-panels"
                aria-label="Закрыть корзину"
            >
                ×
            </button>
        </div>
    </div>

    {{? it.items.length === 0 }}
        <div class="cart-empty-container">
            <div class="empty-icon">🛍️</div>
            <div class="empty-title">Тут пока пусто</div>
            <div class="empty-subtitle">Выберите что-нибудь вкусное</div>
        </div>
        <div class="cart-footer">
            <button class="button button_checkout" disabled>Оформить заказ</button>
        </div>
    {{??}}
        <div class="cart-items-list">
            {{~ it.items :item }}
                <div class="cart-item">
                    <img src="{{!item.image_url}}" alt="{{!item.name}}" class="cart-item__img" onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'">
                    <div class="cart-item__info">
                        <div class="cart-item__name">{{!item.name}}</div>
                        <div class="cart-item__price">{{!item.priceRub}}₽</div>
                    </div>
                    <div class="cart-item__counter">
                        <button class="counter-btn js-minus" data-id="{{!item.dish_id}}">−</button>
                        <span class="counter-value">{{!item.quantity}}</span>
                        <button class="counter-btn js-plus" data-id="{{!item.dish_id}}">+</button>
                    </div>
                </div>
            {{~}}
        </div>

        <div class="cart-footer">
            <button class="button button_checkout active js-checkout-btn">
                <span>Оформить заказ</span>
                <span>{{!it.totalRub}}₽</span>
            </button>
        </div>
    {{?}}
</div>
`;
