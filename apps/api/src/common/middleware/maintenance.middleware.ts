import { HttpException, HttpStatus, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { TypedConfigService } from "../../config/typed-config.service";

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly configService: TypedConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const isMaintenanceMode = this.configService.get("maintananceMode");

    if (isMaintenanceMode) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: "Service is currently under maintenance. Please try again later.",
          error: "Service Unavailable",
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    next();
  }
}
