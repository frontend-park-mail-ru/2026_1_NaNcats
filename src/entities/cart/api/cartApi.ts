import { httpClient } from '@shared/api/http';
import type { CartItem, CartMember, CartSnapshot } from '../model/types';

interface CartResponse {
    cart_id?: string;
    items?: CartItem[];
    restaurant_id?: number;
    mode?: string;
    status?: string;
    admin_id?: number;
    members?: CartMember[];
    total_cost?: number;
}

interface InviteResponse {
    token?: string;
    expires_at?: string;
}

interface JoinCartResponse {
    cart_id?: string;
}

const withCartId = <T extends object>(cartId: string | null, payload: T): T | (T & { cart_id: string }) => {
    return cartId ? { ...payload, cart_id: cartId } : payload;
};

export const cartApi = {
    async load(): Promise<CartSnapshot> {
        const data = await httpClient.getJson<CartResponse>('/cart');

        return {
            cartId: data.cart_id ?? null,
            items: data.items ?? [],
            restaurantId: data.restaurant_id ?? 0,
            mode: data.mode ?? 'solo',
            roomStatus: data.status ?? '',
            adminId: data.admin_id ?? null,
            members: data.members ?? [],
            totalCost: data.total_cost ?? 0,
        };
    },

    addItem(cartId: string | null, dishId: number, quantity: number = 1): Promise<void> {
        return httpClient.send(
            'POST',
            '/cart/items',
            withCartId(cartId, {
                dish_id: dishId,
                quantity,
            }),
        );
    },

    updateQuantity(cartId: string, dishId: number, quantity: number): Promise<void> {
        return httpClient.send('PUT', '/cart/items', {
            cart_id: cartId,
            dish_id: dishId,
            quantity,
        });
    },

    removeItem(cartId: string, dishId: number): Promise<void> {
        return httpClient.send('DELETE', '/cart/items', {
            cart_id: cartId,
            dish_id: dishId,
        });
    },

    clear(cartId: string): Promise<void> {
        return httpClient.send('DELETE', '/cart', {
            cart_id: cartId,
        });
    },

    reassignOwner(cartId: string, dishId: number, newOwnerId: number | null): Promise<void> {
        return httpClient.send('PATCH', '/cart/items/owner', {
            cart_id: cartId,
            dish_id: dishId,
            new_owner_id: newOwnerId,
        });
    },

    generateInvite(cartId: string): Promise<InviteResponse> {
        return httpClient.postJson<InviteResponse>(
            `/cart/invite?cart_id=${encodeURIComponent(cartId)}`,
            {},
        );
    },

    joinCart(token: string): Promise<JoinCartResponse> {
        return httpClient.postJson<JoinCartResponse>('/cart/join', { token });
    },

    kickMember(cartId: string, targetUserId: number): Promise<void> {
        return httpClient.send('DELETE', '/cart/members', {
            cart_id: cartId,
            target_user_id: targetUserId,
        });
    },

    closeSharedCart(cartId: string): Promise<void> {
        return httpClient.send('POST', '/cart/close', {
            cart_id: cartId,
        });
    },
};
