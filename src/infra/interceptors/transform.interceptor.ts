import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, PaginationResponse } from '../../common/interfaces/api-response.interface';

@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, ApiResponse<T> | PaginationResponse<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<ApiResponse<T> | PaginationResponse<T>> {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        return next.handle().pipe(
            map((data) => {
                // Jika data sudah dalam bentuk paginasi (memiliki data & meta)
                if (data && data.data && data.meta) {
                    return {
                        status: 'success',
                        message: 'Operation successful',
                        code: statusCode,
                        ...data, // data dan meta dari service/controller
                    } as PaginationResponse<T>;
                }

                // Response standar non-paginasi
                return {
                    status: 'success',
                    message: 'Operation successful',
                    code: statusCode,
                    data: data,
                } as ApiResponse<T>;
            }),
        );
    }
}
