export const orderStatusModalTemplate = `
<div class="modal-overlay" id="order-status-modal">
    {{? it.order }}
    <div class="order-status-modal">
        <button type="button" class="order-status-modal__close js-close-order-status" aria-label="Закрыть">&times;</button>

        <div class="order-status-modal__header">
            Заказ от {{!it.formatted.dateLabel}} на сумму {{!it.formatted.totalLabel}}₽
        </div>

        <div class="order-status-modal__restaurant">
            <img class="order-status-modal__restaurant-img"
                 src="{{!it.order.restaurant.image_url || ''}}"
                 alt="{{!it.order.restaurant.name}}"
                 onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'">
            <div class="order-status-modal__restaurant-info">
                <div class="order-status-modal__restaurant-name">{{!it.order.restaurant.name}}</div>
                <div class="order-status-modal__restaurant-rating">
                    <span class="order-status-modal__star">★</span>
                    <span>{{!it.order.restaurant.rating}} ({{!it.formatted.reviewsLabel}})</span>
                </div>
            </div>
        </div>

        <div class="order-status-modal__progress {{? it.order.status === 'cancelled' }}order-status-modal__progress_cancelled{{?}}">
            <div class="order-status-modal__progress-text">{{!it.formatted.statusText}}</div>
            <div class="order-status-modal__progress-track">
                {{~ it.steps :step:idx}}
                    {{? idx > 0 }}
                        <div class="order-status-modal__progress-dot {{? step.reached }}order-status-modal__progress-dot_active{{?}}"></div>
                    {{?}}
                    <div class="order-status-modal__progress-step {{? step.reached }}order-status-modal__progress-step_active{{?}} {{? step.current }}order-status-modal__progress-step_current{{?}}">
                        <div class="order-status-modal__progress-icon order-status-modal__progress-icon_{{!step.key}}"></div>
                    </div>
                {{~}}
            </div>
            {{? it.showPaymentButton }}
                <button type="button" class="order-status-modal__pay-btn js-pay-order">Оплатить</button>
            {{?}}
            {{? it.showCancelButton }}
                <button type="button" class="order-status-modal__cancel-btn js-cancel-order">Отменить заказ</button>
            {{?}}
            {{? it.errorText }}
                <div class="order-status-modal__error">{{!it.errorText}}</div>
            {{?}}
        </div>

        <div class="order-status-modal__divider"></div>

        <div class="order-status-modal__section-title">Состав заказа</div>

        <div class="order-status-modal__items">
            {{~ it.order.items :item }}
            <div class="order-status-modal__item">
                <div class="order-status-modal__item-left">
                    <img class="order-status-modal__item-img"
                         src="{{!item.image_url || ''}}"
                         alt="{{!item.name}}"
                         onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'">
                    <div class="order-status-modal__item-info">
                        <div class="order-status-modal__item-name">{{!item.name}}</div>
                        <div class="order-status-modal__item-meta">{{!item.quantity}} шт. x {{!(item.price / 1000000).toFixed(0)}}₽</div>
                    </div>
                </div>
                <div class="order-status-modal__item-price">{{!((item.price * item.quantity) / 1000000).toFixed(0)}}₽</div>
            </div>
            {{~}}

            <div class="order-status-modal__fee-row">
                <div class="order-status-modal__fee-label">Сервисный сбор:</div>
                <div class="order-status-modal__fee-value">{{!(it.order.service_fee / 1000000).toFixed(0)}}₽</div>
            </div>

            <div class="order-status-modal__fee-row">
                <div class="order-status-modal__fee-label">Доставка:</div>
                <div class="order-status-modal__fee-value">{{!(it.order.delivery_cost / 1000000).toFixed(0)}}₽</div>
            </div>
        </div>
    </div>
    {{?}}
</div>
`;
