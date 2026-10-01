export interface StoreAddressInput {
  line1: string;
  line2?: string;
  city: string;
  /** 6 digits, not starting with 0 */
  pincode: string;
}

export interface StoreAddress {
  line1: string;
  line2: string | null;
  city: string;
  pincode: string;
}

export interface CreateStoreRequest {
  /** 2–6 of A–Z 0–9 (stored uppercase); can never change */
  code: string;
  name: string;
  address: StoreAddressInput;
  /** Indian 10-digit mobile or landline with STD code; stored as `+91XXXXXXXXXX` */
  phone: string;
  lat: number;
  lng: number;
  /** 0.5–50, one decimal */
  deliveryRadiusKm: number;
  /** Minutes after midnight IST, 0–1440, opening < closing, not a 24-hour store */
  openingMinutes: number;
  closingMinutes: number;
  deliveryFeePaise: number;
  /** Defaults to true */
  isAcceptingOrders?: boolean;
  /** Defaults to true */
  isActive?: boolean;
}

/**
 * At least one field; `code` is not allowed. `address` replaces the whole address (leaving out
 * `line2` clears it). `lat` + `lng` come together, and so do `openingMinutes` + `closingMinutes`.
 */
export type UpdateStoreRequest = Partial<Omit<CreateStoreRequest, "code">>;

export interface AdminStore {
  id: string;
  code: string;
  name: string;
  address: StoreAddress;
  phone: string;
  lat: number;
  lng: number;
  deliveryRadiusKm: number;
  openingMinutes: number;
  closingMinutes: number;
  deliveryFeePaise: number;
  isAcceptingOrders: boolean;
  isActive: boolean;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** `data` of admin POST /stores and PATCH /stores/:id. */
export interface AdminStoreResponse {
  store: AdminStore;
}

/** `data` of admin GET /stores: the admin's stores (owner: all, including inactive), by code. */
export interface AdminStoresResponse {
  stores: AdminStore[];
}

export interface StoreSummary {
  id: string;
  code: string;
  name: string;
}

/** An active store as a customer sees it, relative to one of their addresses. */
export interface CustomerStore {
  id: string;
  name: string;
  address: StoreAddress;
  phone: string;
  openingMinutes: number;
  closingMinutes: number;
  deliveryFeePaise: number;
  /** Straight-line distance from the address pin, one decimal */
  distanceKm: number;
  deliversToAddress: boolean;
  isOpen: boolean;
  /** ISO 8601; set only when the store is closed because of its hours */
  nextOpensAt: string | null;
}

/** `data` of GET /stores?addressId=: nearest first. */
export interface CustomerStoresResponse {
  stores: CustomerStore[];
}
