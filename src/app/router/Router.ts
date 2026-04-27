import type { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';

export type RouteFactory<P extends object> = () => Promise<{
    component: Component<P>;
    props: P;
}>;

interface RouteEntry {
    factory: () => Promise<{ component: Component<object>; props: object }>;
}

export class Router {
    private readonly routes = new Map<string, RouteEntry>();
    private active: Component<object> | null = null;

    constructor(private readonly root: HTMLElement) {
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const link = target.closest('.router-link') as HTMLAnchorElement | null;
            if (!link) return;
            const path = link.getAttribute('href');
            if (!path) return;
            e.preventDefault();
            this.go(path);
        });
        window.addEventListener('popstate', () => void this.render(window.location.pathname));
    }

    register<P extends object>(path: string, factory: RouteFactory<P>): this {
        this.routes.set(path, { factory: factory as unknown as RouteEntry['factory'] });
        return this;
    }

    go(path: string): void {
        window.history.pushState(null, '', path);
        void this.render(path.split('?')[0]);
    }

    async render(path: string): Promise<void> {
        const entry = this.routes.get(path) ?? this.routes.get(ROUTES.notFound);
        if (!entry) return;

        if (this.active) {
            this.active.destroy();
            this.active = null;
        }

        try {
            const { component, props } = await entry.factory();
            component.mount(this.root, props);
            this.active = component;
        } catch (e) {
            console.warn(`router: route "${path}" failed`, e);
        }
    }
}
