export const loginFormTemplate = `
<form id="auth-form" class="auth-form">
    <div class="input-group">
        <label for="email">Почта</label>
        <input type="email" class="input-field" name="email" placeholder="Example@mail.com" id="email">
        <div id="email-error" class="error-msg"></div>
    </div>

    <div class="input-group">
        <div class="label-row">
            <label for="password">Пароль</label>
            <a href="#" class="secondary-link">Забыли пароль?</a>
        </div>
        <div class="password-wrapper">
            <input type="password" class="input-field" name="password" placeholder="Пароль" id="password">
            <div class="password-wrapper__icon js-password-toggle"></div>
        </div>
        <div id="password-error" class="error-msg"></div>
    </div>

    <button type="submit" class="button button_primary">Войти</button>
</form>
`;
