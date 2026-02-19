import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const parsed = this.parseException(exception);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → 500`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    response.status(status).json({
      statusCode: status,
      error: parsed.error,
      message: parsed.message,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString()
    });
  }

  private parseException(exception: unknown): { error: string; message: unknown } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === "string") {
        return { error: exception.name, message: response };
      }
      const error = (response as { error?: string }).error ?? exception.name;
      const message = (response as { message?: unknown }).message ?? exception.message;
      return { error, message };
    }
    return {
      error: "InternalServerError",
      message: "Internal server error"
    };
  }
}
