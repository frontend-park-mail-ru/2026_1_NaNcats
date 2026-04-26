export const editProfileFormTemplate = `
<form class="edit-profile-form">
    <div class="info-group">
        <label class="info-label">Имя</label>
        <div class="info-row">
            <input id="profile-name" name="name" class="profile-input profile-input_email" type="text" value="{{= it.name }}" disabled>
            <div class="edit-icon-orange js-edit-trigger"></div>
        </div>
        <span id="name-error" class="error-msg"></span>
    </div>
    <div class="info-group">
        <label class="info-label">Почта</label>
        <div class="info-row">
            <input id="profile-email" name="email" class="profile-input profile-input_email" type="email" value="{{= it.email }}" disabled>
            <div class="edit-icon-orange js-edit-trigger"></div>
        </div>
        <span id="email-error" class="error-msg"></span>
    </div>
    <div class="info-group">
        <label class="info-label">Подписка</label>
        <div class="subscription-status">Обычная</div>
        <div class="subscription-text">Оформи подписку <span class="link-orange">Премиум</span> для дополнительных бонусов и привилегий</div>
    </div>
    <div id="profile-error" class="error-msg"></div>
    <button type="submit" id="save-profile-btn" class="button button_primary button_hidden" style="height:40px; margin-top:10px;">Сохранить</button>
</form>
`;
