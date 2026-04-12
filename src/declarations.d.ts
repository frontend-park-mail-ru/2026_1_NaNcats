declare module "*.scss" {
    const content: { [className: string]: string };
    export default content;
}

interface Window {
    router: {
        go(path: string): void;
        render(path: string): Promise<void>;
        register(path: string, component: unknown): unknown;
    };
}
