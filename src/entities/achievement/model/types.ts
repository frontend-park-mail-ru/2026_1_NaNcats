export interface Achievement {
    code: string;
    title: string;
    description: string;
    icon: string;
    earned: boolean;
    awarded_at?: string;
}

export interface AchievementsResponse {
    items: Achievement[] | null;
}
