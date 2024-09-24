export class ResponseModel<T> {
    data: T | null;
    success: boolean;
    message: string;
    statusCode: number;
    error: any;

    // Private constructor to force the use of factory methods
    private constructor(data: T, success: boolean, message: string, statusCode: number, error: any) {
        this.data = data;
        this.success = success;
        this.message = message;
        this.statusCode = statusCode;
        this.error = error;
    }

    // Static method to create a success response
    static createSuccess<T>(data: T, status: number = 200): ResponseModel<T> {
        return new ResponseModel(data, true, 'Operation successful', status, null);
    }

    // Static method to create an error response
    static createError<T>(e: Error, statusCode: number): ResponseModel<T | null> {
        return new ResponseModel(null, false, e.message, statusCode, e);
    }

    // Static method to create a response with all fields specified
    static createResponseModel<T>(data: T, success: boolean, message: string, statusCode: number, error: any)
        : ResponseModel<T | null> {
        return new ResponseModel(data, success, message, statusCode, error);
    }
}
