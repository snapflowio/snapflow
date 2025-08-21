import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import getRawBody from "raw-body";

@Injectable()
export class RawRequestMiddleware implements NestMiddleware {
  private logger = new Logger("RawRequest");

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.method === "POST" && req.headers["content-type"] !== "application/json") {
      const rawBody = await getRawBody(req);
      const bodyStr = rawBody.toString();

      try {
        req.body = JSON.parse(bodyStr);

        req.headers["content-type"] = "application/json";
      } catch (e) {
        this.logger.error("Failed to parse body:", e);
      }
    }

    next();
  }
}
