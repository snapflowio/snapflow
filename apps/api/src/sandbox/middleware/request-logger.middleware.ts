import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, headers, body } = req;

    this.logger.debug(`${method} ${originalUrl}`, {
      headers,
      body,
      contentType: headers["content-type"],
      contentLength: headers["content-length"],
    });

    next();
  }
}
