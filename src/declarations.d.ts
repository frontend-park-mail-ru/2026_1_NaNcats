declare module "*.css" {
    const content: { [className: string]: string };
    export default content;
}

interface Window {
    router: {
        go(path: string): void;
        render(path: string): void;
        register(path: string, component: any): any;
    };
}
