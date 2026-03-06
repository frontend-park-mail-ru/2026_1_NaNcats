export const registerTemplate = `
<div class="auth-page">
    <div class="auth-container">
        <div class="auth-form-side">
            <div class="auth-header">
                <h1>Регистрация</h1>
                <p>Есть аккаунт? <a href="/login" class="router-link secondary-link">Авторизоваться</a></p>
            </div>

            <form id="auth-form" class="auth-form-actual">
                <div class="input-group">
                    <label for="name">Имя</label>
                    <input type="text" name="name" placeholder="Ваше имя" id="name">
                    <span id="name-error" class="error-msg"></span>
                </div>

                <div class="input-group">
                    <label for="email">Почта</label>
                    <input type="email" name="email" placeholder="Example@mail.com" id="email">
                    <span id="email-error" class="error-msg"></span>
                </div>

                <div class="input-group">
                    <label for="password">Пароль</label>
                    <div class="password-wrapper">
                        <input type="password" name="password" placeholder="Пароль" id="password">
                        <div class="password-icon"></div>
                    </div>
                    <span id="password-error" class="error-msg"></span>
                </div>

                <div class="input-group">
                    <label for="repeatPassword">Повторите пароль</label>
                    <div class="password-wrapper">
                        <input type="password" name="repeatPassword" placeholder="Повторите пароль" id="repeatPassword">
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

                <button type="submit" class="btn-primary">Зарегистрироваться</button>
            </form>
        </div>

        <div class="auth-image-side">
            <img src="https://img.freepik.com/free-photo/delicious-burger-with-fresh-ingredients_23-2150857908.jpg" alt="Food" class="promo-image">
            <div class="promo-text">
                <h2>Рядом с домом</h2>
                <p>Найдем самый близкий ресторан и доставим за считанные секунды</p>
            </div>
            <div class="promo-nav">
                <div class="nav-arrow prev"></div>
                <div class="nav-arrow next"></div>
            </div>
        </div>
    </div>
</div>
`;