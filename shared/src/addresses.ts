export interface AddressInput {
  label: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  /** 6 digits, not starting with 0 */
  pincode: string;
  lat: number;
  lng: number;
}

/** A new address becomes the default when `isDefault` is true or it is the customer's only one. */
export interface CreateAddressRequest extends AddressInput {
  isDefault?: boolean;
}

/** At least one field. `lat` and `lng` come together. The default can only be moved, never unset. */
export interface UpdateAddressRequest extends Partial<Omit<AddressInput, "line2" | "landmark">> {
  /** `null` clears it */
  line2?: string | null;
  /** `null` clears it */
  landmark?: string | null;
  isDefault?: true;
}

export interface Address {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** `data` of POST /addresses and PATCH /addresses/:id. */
export interface AddressResponse {
  address: Address;
}

/** `data` of GET /addresses: the default first, then newest first. */
export interface AddressesResponse {
  addresses: Address[];
}
