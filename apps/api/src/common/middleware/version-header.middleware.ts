import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import * as packageJson from "../../../../../package.json";

@Injectable()
export class VersionHeaderMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const version = packageJson.version;
    res.setHeader("X-Snapflow-Version", `v${version}`);
    next();
  }
}
