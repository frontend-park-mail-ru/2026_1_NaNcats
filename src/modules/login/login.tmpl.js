export const loginTemplate = `
<div class="auth-page">
    <div class="auth-container">
        <div class="auth-form-side">
            <div class="auth-header">
                <h1 class="auth-header__title">Вход</h1>
                <p class="auth-header__subtitle">Нет аккаунта? <a href="/register" class="router-link secondary-link">Регистрация</a></p>
            </div>

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
                        <div class="password-icon"></div>
                    </div>
                    <div id="password-error" class="error-msg"></div>
                </div>

                <button type="submit" class="button button_primary">Войти</button>
            </form>
        </div>

        <div class="auth-image-side promo-slider"></div>
    </div>
</div>
`;