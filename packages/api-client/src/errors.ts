export interface ApiError {
    status: number;
    detail: string;
    code?: string;
}

export class SentimentaApiError extends Error {
    status: number;
    code?: string;

    constructor(status: number, detail: string, code?: string) {
        super(detail);
        this.name = "SentimentaApiError";
        this.status = status;
        this.code = code;
    }
}
