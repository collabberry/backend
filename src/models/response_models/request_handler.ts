import { ResponseModel } from './response_model.js';

export function handleResponse<T>(response: ResponseModel<T>): any {
    if (!response.success) {
        return { message: response.message, error: response.error };
    } else {
        return response.data;
    }
}
