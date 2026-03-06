import { Component } from '../core/Component.js';
import { Ajax } from '../core/Ajax.js';
import { restaurantsTemplate } from "../templates/restaurants.tmpl.js"

export class RestaurantList extends Component {
    constructor() {
        super(restaurantsTemplate);
    }

    async mount(container) {
        // Заглушка, если API еще не готово
        let restaurants = [];

        try {
            const [resResponse, userResponse] = await Promise.all([
                Ajax.get('/api/restaurants'),
                Ajax.get('/api/me')
            ]);
            if (resResponse.ok) restaurants = await resResponse.json();
            var user = userResponse.ok ? await userResponse.json() : null;
        } catch (e) {
            console.log("Mock data used");
        }

        super.mount(container, { restaurants, user });
    }

    afterRender() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => window.router.go('/login');
        }
    }
}