export const addressPickerTemplate = `
    {{? !it.hideInput }}
    <div class="address-picker search-bar__group search-bar__group_address js-address-container">
        <div class="search-bar__icon search-bar__icon_address">
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                <path d="M4.73067 11.118C5.984 10.0273 6.97467 8.91822 7.70267 7.79067C8.43067 6.66311 8.79467 5.68755 8.79467 4.864C8.79467 3.64444 8.40867 2.63778 7.63667 1.844C6.86378 1.05067 5.89512 0.654 4.73067 0.654C3.56623 0.654 2.59756 1.05067 1.82467 1.844C1.05178 2.63733 0.665782 3.644 0.666671 4.864C0.666671 5.68711 1.03067 6.66267 1.75867 7.79067C2.48667 8.91867 3.47734 10.0278 4.73067 11.118Z" fill="black" fill-opacity="0.65"/>
            </svg>
        </div>
        <input type="text" 
        class="address-picker__input js-address-input" 
        placeholder="Укажите адрес доставки" 
        value="{{=it.currentAddress || ''}}"
        autocomplete="off">
        
        <div class="address-dropdown js-address-dropdown">
            <div class="address-dropdown__map-button-wrapper js-open-map-btn" style="display: none;">
                <div class="address-dropdown__map-button">Указать на карте</div>
            </div>
            <div class="address-dropdown__suggestions js-address-suggestions"></div>
        </div>
    </div>
    {{?}}

    <!-- Модалка с картой -->
    <div class="modal-overlay js-map-modal">
        <div class="address-modal">
            <div class="address-modal__close js-close-map-modal">&times;</div>
            <div class="address-modal__header">
                <h2 class="address-modal__title">Укажите адрес доставки</h2>
            </div>
            <div class="address-modal__search-row">
                <div class="modal-search-container">
                    <div class="modal-search">
                        <div class="modal-search__icon">🔍</div>
                        <input type="text" class="modal-search__input js-modal-address-input" placeholder="Введите адрес" autocomplete="off">
                    </div>
                    <div class="address-modal__suggestions js-modal-suggestions"></div>
                </div>
                <button class="button button_modal-ok js-confirm-address-btn">ОК</button>
            </div>
            <div class="address-modal__map-container">
                <div class="js-yandex-map" style="width: 100%; height: 297px; border-radius: 24px;"></div>
                <div class="map-center-pin">📍</div>
            </div>
        </div>
    </div>

    <div class="modal-overlay js-details-modal">
        <div class="address-modal" style="width: 500px;">
            <div class="address-modal__close js-close-details-modal">&times;</div>
            <h2 class="address-modal__title">Детали адреса</h2>
            <form class="auth-form js-details-form" style="max-width:100%">
                <div class="input-group">
                    <label>Адрес</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" class="input-field js-display-address" disabled style="background:#eee; flex: 1;">
                        <button type="button" class="button js-change-address-btn" style="width: 48px; background: #eee; border-radius: 12px;">✏️</button>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div class="input-group"><label>Квартира</label><input name="apartment" class="input-field"></div>
                    <div class="input-group"><label>Подъезд</label><input name="entrance" class="input-field"></div>
                    <div class="input-group"><label>Этаж</label><input name="floor" class="input-field"></div>
                    <div class="input-group"><label>Код</label><input name="door_code" class="input-field"></div>
                </div>
                <div class="input-group">
                    <label>Комментарий курьеру</label>
                    <input name="courier_comment" class="input-field">
                </div>
                <button type="submit" class="button button_primary">Сохранить</button>
            </form>
        </div>
    </div>
`;
