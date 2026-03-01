import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorResponse, ValidationErrorDetail } from '../../common/interfaces/api-response.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let errors: ValidationErrorDetail[] | undefined = undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse: any = exception.getResponse();

            // Kasus ValidationPipe (Class Validator)
            if (typeof exceptionResponse === 'object' && exceptionResponse.message) {
                if (Array.isArray(exceptionResponse.message)) {
                    // Flatten class-validator errors kalau ada
                    message = 'Validation failed';
                    errors = exceptionResponse.message.map((msg: string) => {
                        // Contoh parsing msg dari: "email must be an email"
                        // Kita coba tebak field-nya dari kata pertama (hanya estimasi simple)
                        const field = msg.split(' ')[0];
                        return {
                            field: field,
                            value: msg,
                        };
                    });
                } else {
                    message = exceptionResponse.message;
                }
            } else if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            }
        } else {
            // Log unexpected error
            this.logger.error(`Unexpected Exception: ${exception.message}`, exception.stack);
        }

        const errorResponse: ErrorResponse = {
            data: null,
            message: message,
            status: 'error',
            code: status,
            meta: null,
            errors: errors,
        };

        response.status(status).json(errorResponse);
    }
}
