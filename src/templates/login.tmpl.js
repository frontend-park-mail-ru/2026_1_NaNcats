export const loginTemplate = `
<div class="auth-page">
    <div class="auth-container">
        <!-- Левая часть: Форма -->
        <div class="auth-form-side">
            <div class="auth-header">
                <h1>Вход</h1>
                <p>Нет аккаунта? <a href="/register" class="router-link secondary-link">Регистрация</a></p>
            </div>

            <form id="login-form" class="auth-form-actual">
                <div class="input-group">
                    <label for="email">Почта</label>
                    <input type="email" name="email" placeholder="Example@mail.com" id="email">
                    <span id="email-error" class="error-msg"></span>
                </div>

                <div class="input-group">
                    <div class="label-row">
                        <label for="password">Пароль</label>
                        <a href="#" class="secondary-link">Забыли пароль?</a>
                    </div>
                    <div class="password-wrapper">
                        <input type="password" name="password" placeholder="Пароль" id="password">
                        <div class="password-icon"></div>
                    </div>
                    <span id="password-error" class="error-msg"></span>
                </div>

                <button type="submit" class="btn-primary">Войти</button>
                
                <button type="button" class="btn-google">
                    <span class="google-icon"></span>
                    Войти через Google
                </button>
            </form>
        </div>

        <!-- Правая часть: Изображение и текст -->
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