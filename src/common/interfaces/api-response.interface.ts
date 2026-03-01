export interface Meta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export interface ApiResponse<T> {
    data: T | null;
    message?: string;
    status?: string;
    code?: number;
}

export interface PaginationResponse<T> {
    data: T[];
    meta: Meta;
    message?: string;
    status?: string;
    code?: number;
}

export interface ValidationErrorDetail {
    field: string;
    value: any;
}

export interface ErrorResponse {
    data: null;
    message: string;
    status: string;
    code: number;
    meta: null;
    errors?: ValidationErrorDetail[];
}
