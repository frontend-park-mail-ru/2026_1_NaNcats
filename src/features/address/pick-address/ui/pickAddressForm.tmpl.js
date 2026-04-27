export const pickAddressFormTemplate = `
<form id="address-full-form" class="address-form">
    <div class="input-group">
        <label for="display-address-text">Адрес</label>
        <input id="display-address-text" name="display_address_text" class="input-field" type="text" readonly>
    </div>
    <div class="address-form__grid">
        <div class="input-group">
            <label for="apartment">Квартира</label>
            <input id="apartment" name="apartment" class="input-field" type="text">
        </div>
        <div class="input-group">
            <label for="entrance">Подъезд</label>
            <input id="entrance" name="entrance" class="input-field" type="text">
        </div>
        <div class="input-group">
            <label for="floor">Этаж</label>
            <input id="floor" name="floor" class="input-field" type="text">
        </div>
        <div class="input-group">
            <label for="door_code">Код двери</label>
            <input id="door_code" name="door_code" class="input-field" type="text">
        </div>
    </div>
    <div class="input-group">
        <label for="courier_comment">Комментарий курьеру</label>
        <input id="courier_comment" name="courier_comment" class="input-field" type="text">
    </div>
    <button type="submit" class="button button_primary">Сохранить</button>
</form>
`;
