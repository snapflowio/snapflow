import { join } from "path";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";

@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    const prefixes = ["/api/", "/mcp", "/sse", "/messages"];
    if (!prefixes.some((prefix) => request.path.startsWith(prefix))) {
      const response = ctx.getResponse();
      response.sendFile(join(__dirname, "..", "website", "index.html"));
      return;
    }

    let statusCode: number;
    let message: string;
    let error: string;
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === "object" && response !== null) {
        message = (response as any).message || exception.message;
        error = (response as any).error || "Http Exception";
      } else {
        message = exception.message;
        error = "Http Exception";
      }
    } else if (exception instanceof Error) {
      const customError = this.handleCustomError(exception.message);
      statusCode = customError.statusCode;
      error = customError.errorType;
      message = exception.message;
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      error = "Unknown Error";
    }

    const responseBody = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.path,
      error,
      message,
    };
    ctx.getResponse().status(statusCode).json(responseBody);
    return;
  }

  private handleCustomError(errorMessage: string): {
    statusCode: number;
    errorType: string;
  } {
    switch (errorMessage) {
      case "Sandbox not found":
        return {
          statusCode: HttpStatus.NOT_FOUND,
          errorType: "Not Found",
        };
      case "Unauthorized access":
        return {
          statusCode: HttpStatus.UNAUTHORIZED,
          errorType: "Unauthorized",
        };
      case "Forbidden operation":
        return {
          statusCode: HttpStatus.FORBIDDEN,
          errorType: "Forbidden",
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorType: "Internal Server Error",
        };
    }
  }
}
