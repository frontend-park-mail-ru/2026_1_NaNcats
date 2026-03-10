export const loginTemplate = `
<div class="auth-page">
    <div class="auth-container">
        <div class="auth-form-side">
            <div class="auth-header">
                <h1 class="auth-header__title">Вход</h1>
                <p class="auth-header__subtitle">Нет аккаунта? <a href="/register" class="router-link secondary-link">Регистрация</a></p>
            </div>

            <form id="login-form" class="auth-form">
                <div class="input-group">
                    <label for="email">Почта</label>
                    <input type="email" class="input-field" name="email" placeholder="Example@mail.com" id="email">
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
                    <div id="form-error" class="error-msg"></div>
                </div>

                <button type="submit" class="button button_primary">Войти</button>
            </form>
        </div>

        <div class="auth-image-side">
            <img src="https://img.freepik.com/free-photo/view-delicious-food-assortment_23-2149598944.jpg?t=st=1773128362~exp=1773131962~hmac=7bec2e7e3a0c83384b1d0c94ea34b424b6f853b3884fb061d43e8cda28d6a753&w=2000" alt="Food" class="promo-image">
            <div class="promo-text">
                <h2 class="promo-text__title">Рядом с домом</h2>
                <p>Найдем самый близкий ресторан и доставим за считанные секунды</p>
            </div>
            <div class="promo-nav">
                <div class="nav-arrow nav-arrow_prev"></div>
                <div class="nav-arrow nav-arrow_next"></div>
            </div>
        </div>
    </div>
</div>
`;