export const ROUTES = {
    home: '/',
    login: '/login',
    register: '/register',
    restaurant: '/restaurant',
    profile: '/profile',
    checkout: '/checkout',
    notFound: '/404',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
