export const restaurantPageTemplate = `
<div class="page-wrapper">
    <header class="header">

        <button class="button header__back-btn" type="button" id="header__back-btn" aria-label="Назад">
            <svg class="back-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                d="M15 6l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                />
            </svg>
            <span class="back-btn__text">Назад</span>
        </button>

        <div class="logo-container">
            <svg width="92" height="48" viewBox="0 0 92 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.25041 14.7383L6.66741 11.7649C7.04586 9.06656 8.28854 6.56348 10.2092 4.63077C11.5525 3.27909 13.2073 2.13454 15.1088 2.26004C19.2718 2.53482 24.2532 5.34815 24.7504 7.07684M6.25041 14.7383C16.0334 23.582 20.7504 20.5456 22.7504 19.5768M6.25041 14.7383L6.58686 19.1297C6.69558 20.5487 6.95546 21.9521 7.36209 23.316L8.25041 26.2956L9.77341 30.9509C10.63 33.5691 11.1292 36.4164 10.0789 38.9631C8.37705 43.0896 4.95506 45.5385 2.25049 44.9831M73.2931 2.57684V7.98829V17.332V21.6445V22.1999C73.2931 23.2019 72.7992 24.1394 71.9727 24.706C71.4669 25.0527 70.8685 25.2383 70.2552 25.2383C69.1065 25.2383 67.4343 25.2383 66.6962 25.2383C66.5174 25.2383 66.2894 25.2149 66.0358 25.1767C64.2479 24.907 62.7505 23.4526 62.7505 21.6445C62.7505 20.457 62.6962 18.957 62.7505 17.332C62.7522 17.2811 62.7563 17.2298 62.7626 17.1781C63.1157 14.2894 66.7861 13.0255 69.6962 13.0195C70.6885 13.0175 73.2931 13.7383 73.2931 15.8945M24.7504 32.7643C24.2504 32.0456 21.2465 31.2383 20.7504 31.2383C15.7504 31.2383 15.7504 37.5768 15.7504 37.5768L15.9944 40.0953C16.1584 41.7884 16.9958 43.4031 18.3901 44.3774C19.5381 45.1797 20.9909 45.078 22.3597 44.7818L24.7504 44.2643M46.9151 31.3268C46.7214 31.8737 46.6463 32.4864 46.6271 33.0318C46.5905 34.0703 46.7057 35.1106 46.7057 36.1497V37.5768V39.1237V40.6706C46.7057 40.6706 46.6419 41.927 46.799 42.9863C46.9313 43.8794 47.7005 44.4131 48.5573 44.6979L48.6691 44.7351C49.1632 44.8994 49.6805 44.9831 50.2012 44.9831C51.8835 44.9831 53.2728 43.7968 54.815 43.1246C55.5966 42.7838 56.008 42.8846 56.008 40.6706M56.008 40.6706C56.008 37.0619 56.008 31.3268 56.008 31.3268M56.008 40.6706L57.9151 45.2383M69.7504 36.0768C69.8331 35.981 69.8938 35.8573 69.9368 35.7149C70.4492 34.0185 69.8919 31.579 68.1419 31.2999C67.871 31.2567 67.5723 31.2383 67.2505 31.2383H65.2505H63.0595C62.5637 31.2383 62.1104 31.5184 61.8887 31.9619C61.7978 32.1437 61.7505 32.3441 61.7505 32.5473V33.2383C61.7505 33.8086 61.9869 34.7768 62.4321 35.9949C62.8731 37.2018 63.1941 38.4546 63.2505 39.7383V42.7383V45.2383M80.231 2.57684C80.231 3.57684 80.231 15.0719 80.231 17.5768C80.231 20.5456 80.231 25.2383 80.231 28.9206C80.231 32.5675 78.7504 34.4779 77.7504 36.3581C76.9851 37.7971 76.5126 38.7205 76.333 39.9712C76.2148 40.7941 76.4763 41.6149 76.9041 42.3277C77.4512 43.2397 78.2983 43.9331 79.3003 44.2895L80.6634 44.7743C81.0543 44.9133 81.4535 45.0289 81.864 45.0889C84.2971 45.4442 87.4094 45.1613 89.2505 43.5456M75.2505 28.9206H82.0915H87.6729M32.3945 24.8581C30.9866 23.9334 29.9759 22.5151 29.5616 20.8824L29.4761 20.5456C29.0045 19.1517 29.0329 17.6372 29.5563 16.2619L29.8409 15.5143L29.8638 15.4544C30.5378 13.6835 32.0108 12.3366 33.8347 11.8233L33.9831 11.7815C35.309 11.4083 36.726 11.5385 37.9617 12.1472C39.5122 12.9109 40.6214 14.3499 40.9653 16.0437L41.0493 16.4576C41.1161 16.7866 41.1571 17.1203 41.1718 17.4556L41.2504 19.2383L41.2358 19.6371C41.1804 21.1438 40.5513 22.5725 39.4772 23.6306C39.1343 23.9685 38.7513 24.2632 38.3368 24.5082L38.1134 24.6402C36.366 25.6731 34.2155 25.755 32.3945 24.8581ZM48.8945 24.8581C47.4866 23.9334 46.4759 22.5151 46.0616 20.8824L45.9761 20.5456C45.5045 19.1517 45.5329 17.6372 46.0563 16.2619L46.3409 15.5143L46.3637 15.4544C47.0378 13.6835 48.5108 12.3366 50.3347 11.8233L50.4831 11.7815C51.809 11.4083 53.226 11.5385 54.4617 12.1472C56.0122 12.9109 57.1214 14.3499 57.4653 16.0437L57.5493 16.4576C57.6161 16.7866 57.6571 17.1203 57.6718 17.4556L57.7504 19.2383L57.7358 19.6371C57.6804 21.1438 57.0513 22.5725 55.9772 23.6306C55.6343 23.9685 55.2513 24.2632 54.8368 24.5082L54.6134 24.6402C52.866 25.6731 50.7155 25.755 48.8945 24.8581ZM32.3945 44.2643C30.9866 43.3397 29.9759 41.9213 29.5616 40.2887L29.4761 39.9518C29.0045 38.558 29.0329 37.0434 29.5563 35.6682L29.8409 34.9206L29.8638 34.8606C30.5378 33.0898 32.0108 31.7429 33.8347 31.2295L33.9831 31.1877C35.309 30.8145 36.726 30.9448 37.9617 31.5534C39.5122 32.3172 40.6214 33.7561 40.9653 35.45L41.0493 35.8639C41.1161 36.1929 41.1571 36.5265 41.1718 36.8619L41.2504 38.6445L41.2358 39.0433C41.1804 40.5501 40.5514 41.9787 39.4772 43.0369C39.1343 43.3748 38.7513 43.6695 38.3368 43.9144L38.1134 44.0465C36.366 45.0794 34.2155 45.1613 32.3945 44.2643Z" stroke="#FFC1C1" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>

        <div class="header__controls">
            {{? it.user }}
                <div class="notif-btn">
                    <div class="notif-btn__icon">
                        <svg width="15" height="17" viewBox="0 0 15 17" fill="none">
                            <path d="M5.83333 14.4524H9.16667C9.16667 15.3952 8.41667 16.1667 7.5 16.1667C6.58333 16.1667 5.83333 15.3952 5.83333 14.4524ZM15 12.7381V13.5952H0V12.7381L1.66667 11.0238V5.88095C1.66667 3.22381 3.33333 0.909525 5.83333 0.138097L6.5 1.07481e-06C7.5 1.07481e-06 6.58333 1.07481e-06 7.5 1.07481e-06C8.41667 1.07481e-06 7.5 0 8.5 1.65839e-07L9.16667 0.138097C11.6667 0.909525 13.3333 3.22381 13.3333 5.88095V11.0238L15 12.7381ZM11.6667 5.88095C11.6667 3.48095 9.83333 1.59524 7.5 1.59524C5.16667 1.59524 3.33333 3.48095 3.33333 5.88095V11.881H11.6667V5.88095Z" fill="#FFC1C1"/>
                        </svg>
                    </div>
                    <div class="notif-btn__label">Уведомления</div>
                </div>
                <div class="user-menu-wrapper">
                    <div class="user-profile">
                        <div class="user-profile__avatar"></div>
                        <div class="user-profile__name">
                            {{=it.user.name}}
                        </div>
                    </div>

                    <div class="user-dropdown">
                        <div class="user-dropdown__item logout" id="logout-btn">
                            Выйти
                        </div>
                    </div>
                </div>
            {{??}}
                <div class="auth-guest-controls">
                    <button id="login-btn" class="button button_header-login">Войти</button>
                    <button id="register-btn" class="button button_header-reg">Регистрация</button>
                </div>
            {{?}}
        </div>
    </header>

    <div class="main-layout">
        <!-- МЕНЮ (ПОКА ЗАГЛУШКА ИЗ МАКЕТА) -->
        <aside class="side-column">
            <div class="card card_fixed">
                <p class="label-text">Меню</p>

                <div class="categories-list">
                    <div class="category-item"><span>—</span><span>Выбор пользователей</span></div>
                    <div class="category-item"><span>—</span><span>Акции</span></div>
                    <div class="category-item"><span>—</span><span>Комбо</span></div>
                    <div class="category-item"><span>—</span><span>Пицца Метровая</span></div>
                    <div class="category-item"><span>—</span><span>Пицца круглая (35 см)</span></div>
                    <div class="category-item"><span>—</span><span>Пицца Пол метра</span></div>
                    <div class="category-item"><span>—</span><span>Пасты</span></div>
                    <div class="category-item"><span>—</span><span>Закуски</span></div>
                    <div class="category-item"><span>—</span><span>Соусы</span></div>
                    <div class="category-item"><span>—</span><span>Салаты</span></div>
                    <div class="category-item"><span>—</span><span>Бургеры</span></div>
                    <div class="category-item"><span>—</span><span>Десерты</span></div>
                    <div class="category-item"><span>—</span><span>Роллы</span></div>
                    <div class="category-item"><span>—</span><span>Шашлык и гриль</span></div>
                </div>
            </div>

            <div class="button button_support">
                <svg width="31" height="24" viewBox="0 0 31 24" fill="none">
                    <path d="M1.70947 22.3117L0.120783 21.7613C0.0072668 22.01 -0.0270883 22.2808 0.0213384 22.5451C0.0697651 22.8093 0.19918 23.0573 0.395941 23.2629C0.592701 23.4685 0.849518 23.6241 1.13932 23.7132C1.42912 23.8023 1.74118 23.8217 2.04258 23.7694L1.70947 22.3117ZM9.74857 20.9194L10.5583 19.609L10.0168 19.3561L9.41546 19.4602L9.74857 20.9194ZM4.4837 16.2384L6.07238 16.7888L6.35083 16.173L6.01601 15.5795L4.4837 16.2384ZM27.3335 11.8996C27.3335 16.7278 22.4598 20.8242 16.1785 20.8242V23.7991C24.1066 23.7991 30.75 18.5722 30.75 11.8996H27.3335ZM5.02522 11.8996C5.02522 7.07131 9.90061 2.97489 16.1802 2.97489V0C8.25213 0 1.60697 5.22688 1.60697 11.8996H5.02522ZM16.1802 2.97489C22.4598 2.97489 27.3335 7.07131 27.3335 11.8996H30.75C30.75 5.22688 24.1083 0 16.1802 0V2.97489ZM16.1785 20.8242C14.12 20.8242 12.2034 20.378 10.5583 19.609L8.93885 22.2284C11.1653 23.2677 13.6523 23.8075 16.1785 23.7991V20.8242ZM2.04258 23.7694L10.0817 22.3771L9.41546 19.4602L1.37636 20.8525L2.04258 23.7709V23.7694ZM6.01601 15.5795C5.36567 14.4353 5.02781 13.1762 5.02522 11.8996H1.60697C1.60697 13.6845 2.08871 15.3772 2.94967 16.8974L6.01601 15.5795ZM2.89672 15.6881L0.120783 21.7628L3.29474 22.8605L6.06897 16.7873L2.89501 15.6881H2.89672Z" fill="#FFC1C1"/>
                    <circle cx="10.25" cy="11.9" r="1.5" fill="#FFC1C1"/>
                    <circle cx="16.23" cy="11.9" r="1.5" fill="#FFC1C1"/>
                    <circle cx="22.21" cy="11.9" r="1.5" fill="#FFC1C1"/>
                </svg>
                Поддержка
            </div>
        </aside>

        <main class="center-column">
            <div class="sheet">

                <!-- Заголовок ресторана (пока заглушка) -->
                <div class="sheet__header" style="justify-content:center;">
                    <h1 class="sheet__title" style="text-align:center;">Pizza Epic Family</h1>
                </div>

                <!-- Баннер ресторана (плейсхолдер) -->
                <div class="restaurant-hero" style="margin-bottom:14px;">
                    <img
                      class="restaurant-hero__img"
                      src="https://placehold.co/1200x360/png?text=Restaurant+Banner"
                      alt="Баннер ресторана"
                      style="width:100%; border-radius:20px; object-fit:cover; aspect-ratio: 16 / 5;"
                    />
                </div>

                <!-- Плашка про скидку (заглушка) -->
                <div class="promo-note" style="
                    background:#E6F3E0;
                    border-radius:14px;
                    padding:12px 14px;
                    margin-bottom:18px;
                    font-size:13px;
                    color:#1f2a1f;
                    display:flex;
                    gap:10px;
                    align-items:center;
                ">
                    <span style="font-size:16px;">🍀</span>
                    <span><b>В ресторане активна выбранная Вами категория месяца</b> — скидка 10% на пиццы, это знак — пора заказывать!</span>
                </div>

                <!-- Секция -->
                <h2 style="margin: 0 0 14px 0; font-size:20px;">Выбор пользователей</h2>

                <!-- Сетка блюд -->
                <div class="res-grid">
                    {{~it.dishes :dish}}
                        <div class="dish-card" style="
                            background:#fff;
                            border-radius:18px;
                            padding:14px;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                            display:flex;
                            flex-direction:column;
                            gap:10px;
                        ">
                            <img
                              class="dish-card__img"
                              src="{{=dish.image_url}}"
                              alt="{{=dish.name}}"
                              onerror="this.src='https://placehold.co/400x300/png?text={{=dish.name}}'"
                              style="width:100%; border-radius:16px; aspect-ratio: 1 / 1; object-fit:cover;"
                            />

                            <div class="dish-card__prices" style="display:flex; gap:8px; align-items:baseline;">
                                <div style="color:#ff6b6b; font-weight:700;">
                                  {{=dish.price}} ₽
                                </div>
                                <div style="color:#999; text-decoration:line-through; font-size:12px;">
                                  {{=dish.price}} ₽
                                </div>
                            </div>

                            <div class="dish-card__title" style="font-weight:600;">
                                {{=dish.name}}
                            </div>

                            <div class="dish-card__desc" style="color:#777; font-size:12px; line-height:1.35;">
                                {{=dish.description || 'Описание появится позже'}}
                            </div>

                            <button class="button" type="button" style="
                                margin-top:auto;
                                background: #FFE3E3;
                                border-radius: 14px;
                                padding: 10px 14px;
                                font-weight: 600;
                            ">
                                В корзину
                            </button>
                        </div>
                    {{~}}
                </div>

            </div>
        </main>

        <aside class="side-column">
            <div class="card card_fixed">
                <div class="cart-container">
                    <p class="label-text" style="padding:0">Корзина</p>
                    <div class="cart-empty-container">
                        <div class="empty-icon">🛍️</div>
                        <div class="empty-title">Тут пока пусто</div>
                        <div class="empty-subtitle">Выберите что-нибудь вкусное</div>
                    </div>
                </div>
                <div class="cart-footer">
                    <button class="button button_checkout" disabled>Оформить заказ</button>
                </div>
            </div>
        </aside>
    </div>
</div>
`;
