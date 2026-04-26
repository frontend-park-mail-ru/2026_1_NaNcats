export interface User {
    id: string;
    name: string;
    email: string;
    avatar_url: string;
    streak_weeks?: number;
}

export type UserStatus = 'idle' | 'loading' | 'error';

export interface UserState {
    user: User | null;
    status: UserStatus;
}
