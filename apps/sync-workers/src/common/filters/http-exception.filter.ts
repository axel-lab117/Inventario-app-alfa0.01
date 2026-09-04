import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let error = 'Internal Server Error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || exception.message;
      error = exception.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Database Error';
      if (exception.code === 'P2002') {
        message = 'Registro duplicado';
        details = { field: exception.meta?.target };
      } else if (exception.code === 'P2003') {
        message = 'Referencia inválida';
        details = { field: exception.meta?.field_name };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Registro no encontrado';
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Validation Error';
      message = 'Datos de entrada inválidos';
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    this.logger.error(`${request.method} ${request.url} - ${status} - ${message}`, exception instanceof Error ? exception.stack : '');

    const responseBody = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details && { details }),
    };

    response.status(status).json(responseBody);
  }
}