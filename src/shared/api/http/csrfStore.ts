import { Store } from '@shared/lib/store';

export interface CsrfState {
    token: string | null;
}

class CsrfStore extends Store<CsrfState> {
    constructor() {
        super({ token: null });
    }

    getToken(): string | null {
        return this.getState().token;
    }

    setToken(token: string): void {
        this.setState({ token });
    }

    clear(): void {
        this.setState({ token: null });
    }
}

export const csrfStore = new CsrfStore();
export type { CsrfStore };
