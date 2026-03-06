/**
 * Имитация базы данных в браузере
 */
const mockDB = {
    users: JSON.parse(localStorage.getItem('mock_users') || '[]'),
    restaurants: [
        { id: 1, name: 'Вкусно и точка', description: 'Бургеры и картошка' },
        { id: 2, name: 'Пицца Хат', description: 'Лучшая пицца в городе' },
        { id: 3, name: 'Теремок', description: 'Блины с икрой' },
        { id: 4, name: 'Burger King', description: 'Воппер и фри' },
        { id: 5, name: 'Додо Пицца', description: 'Уютная доставка' },
        { id: 6, name: 'Шоколадница', description: 'Кофе и завтраки' },
        { id: 7, name: 'KFC', description: 'Острые крылышки и бургеры' },
        { id: 8, name: 'Суши Вок', description: 'Роллы, лапша и вок' },
        { id: 9, name: 'Papa Johns', description: 'Сырные бортики и соусы' },
        { id: 10, name: 'Чайхона №1', description: 'Плов, лагман и самса' },
        { id: 11, name: 'Starbucks', description: 'Кофе и десерты' },
        { id: 12, name: 'Вилка-Ложка', description: 'Бизнес-ланчи и салаты' },
        { id: 13, name: 'Subway', description: 'Свежие сэндвичи на любой вкус' },
        { id: 14, name: 'Кофе Хауз', description: 'Ароматный кофе и десерты' },
        { id: 15, name: 'IL Патио', description: 'Итальянская паста и пицца' },
        { id: 16, name: 'Макдональдс', description: 'Бигмак и картошка фри' }
    ]
};

/**
 * Модуль-заглушка для работы с данными
 */
export class Ajax {
    /**
     * Имитация сетевой задержки
     */
    static #delay(ms = 500) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async get(url) {
        await this.#delay();

        if (url === '/api/restaurants') {
            return { ok: true, json: () => Promise.resolve(mockDB.restaurants) };
        }

        if (url === '/api/me') {
            const user = localStorage.getItem('mock_session');
            return user 
                ? { ok: true, json: () => Promise.resolve(JSON.parse(user)) }
                : { ok: false };
        }

        return { ok: false, status: 404 };
    }

    static async post(url, body) {
        await this.#delay();

        if (url === '/api/login') {
            const user = mockDB.users.find(u => u.email === body.email && u.password === body.password);
            if (user) {
                localStorage.setItem('mock_session', JSON.stringify(user));
                return { ok: true };
            }
            return { ok: false, status: 401 };
        }

        if (url === '/api/register') {
            mockDB.users.push(body);
            localStorage.setItem('mock_users', JSON.stringify(mockDB.users));
            return { ok: true };
        }

        if (url === '/api/logout') {
            localStorage.removeItem('mock_session');
            return { ok: true };
        }

        return { ok: false };
    }
}