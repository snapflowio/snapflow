import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class ContentTypeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ContentTypeInterceptor.name);

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    if (request.readable) {
      await new Promise<void>((resolve, reject) => {
        let rawBody = "";

        request.on("data", (chunk: Buffer) => {
          rawBody += chunk.toString();
        });

        request.on("end", () => {
          try {
            if (rawBody) {
              request.body = JSON.parse(rawBody);
              request.headers["content-type"] = "application/json";
            }
            resolve();
          } catch (e) {
            this.logger.error("Failed to parse JSON body:", e);
            resolve();
          }
        });

        request.on("error", (error: Error) => {
          this.logger.error("Error reading request body:", error);
          reject(error);
        });
      });
    }

    if (request.body && Object.keys(request.body).length > 0 && !request.get("content-type")) {
      request.headers["content-type"] = "application/json";
    }

    return next.handle();
  }
}
