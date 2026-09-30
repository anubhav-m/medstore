import type { ErrorCode } from "./errorCodes.js";

export interface FieldError {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data?: T;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: ErrorCode;
  errors?: FieldError[];
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
