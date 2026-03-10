export const registerTemplate = `
<div class="auth-page">
    <div class="auth-container">
        <div class="auth-form-side">
            <div class="auth-header">
                <h1 class="auth-header__title">Регистрация</h1>
                <p class="auth-header__subtitle">Есть аккаунт? <a href="/login" class="router-link secondary-link">Войти</a></p>
            </div>

            <form id="auth-form" class="auth-form">
                <div class="input-group">
                    <label for="name">Имя</label>
                    <input class="input-field" type="text" name="name" placeholder="Ваше имя" id="name">
                    <span id="name-error" class="error-msg"></span>
                </div>

                <div class="input-group">
                    <label for="email">Почта</label>
                    <input class="input-field" type="email" name="email" placeholder="Example@mail.com" id="email">
                    <span id="email-error" class="error-msg"></span>
                </div>

                <div class="input-group">
                    <label for="password">Пароль</label>
                    <div class="password-wrapper">
                        <input class="input-field" type="password" name="password" placeholder="Пароль" id="password">
                        <div class="password-icon"></div>
                    </div>
                    <span id="password-error" class="error-msg"></span>
                </div>

                <div class="input-group">
                    <label for="repeatPassword">Повторите пароль</label>
                    <div class="password-wrapper">
                        <input class="input-field" type="password" name="repeatPassword" placeholder="Повторите пароль" id="repeatPassword">
                        <div class="password-icon"></div>
                    </div>
                    <span id="repeatPassword-error" class="error-msg"></span>
                </div>

                <div class="checkbox-group">
                    <input type="checkbox" id="terms" required>
                    <label for="terms">
                        Я согласен с <span class="secondary-link">условиями использования</span> и <span class="secondary-link">политикой конфиденциальности</span>
                    </label>
                </div>

                <button type="submit" class="button button_primary">Зарегистрироваться</button>
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