export const cartTemplate = `
<div class="cart-wrapper">
    <div class="cart-header-top">
        <span class="cart-title">Корзина</span>
        {{? it.items && it.items.length > 0 }}
            <span class="cart-clear-btn" id="clear-cart-btn">Очистить</span>
        {{?}}
    </div>

    {{? !it.items || it.items.length === 0 }}
        <!-- Пустая корзина -->
        <div class="cart-empty-container">
            <div class="empty-icon">🛍️</div>
            <div class="empty-title">Тут пока пусто</div>
            <div class="empty-subtitle">Выберите что-нибудь вкусное</div>
        </div>
        <div class="cart-footer">
            <button class="button button_checkout" disabled>Оформить заказ</button>
        </div>
    {{??}}
        <!-- Заполненная корзина -->
        <div class="cart-delivery-tabs">
            <div class="cart-tab active">Доставка</div>
            <div class="cart-tab">Самовывоз</div>
        </div>

        <div class="cart-items-list">
            {{~ it.items :item:index }}
                <div class="cart-item">
                    <img src="{{!item.image_url}}" alt="{{!item.name}}" class="cart-item__img" onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'">
                    <div class="cart-item__info">
                        <div class="cart-item__name">{{!item.name}}</div>
                        <div class="cart-item__price">{{!item.price}}₽</div>
                    </div>
                    <div class="cart-item__counter">
                        <button class="counter-btn minus" data-id="{{!item.dish_id}}">−</button>
                        <span class="counter-value">{{!item.quantity}}</span>
                        <button class="counter-btn plus" data-id="{{!item.dish_id}}">+</button>
                    </div>
                </div>
            {{~}}
        </div>

        <div class="cart-footer">
            <button class="button button_checkout active" id="checkout-btn">
                <span>Оформить заказ</span>
                <span>{{!it.totalCost}}₽</span>
            </button>
        </div>
    {{?}}
</div>
`;