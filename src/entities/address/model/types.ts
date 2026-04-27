export type Coordinates = [number, number];

export interface AddressLocation {
    address_text: string;
    latitude: number;
    longitude: number;
}

export interface AddressDetails {
    apartment?: string;
    entrance?: string;
    floor?: string;
    door_code?: string;
    courier_comment?: string;
    label?: string;
}

export interface Address extends AddressDetails {
    id: string;
    location: AddressLocation;
}

export interface AddressListResponse {
    addresses?: Address[];
}

export interface AddressUpsertPayload extends AddressDetails {
    address_text: string;
    lat: number;
    lon: number;
}
