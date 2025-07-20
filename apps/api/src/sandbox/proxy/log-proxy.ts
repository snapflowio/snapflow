import { IncomingMessage, ServerResponse } from "http";
import { NextFunction } from "express";
import { createProxyMiddleware, fixRequestBody, Options } from "http-proxy-middleware";

export class LogProxy {
  constructor(
    private readonly targetUrl: string,
    private readonly imageRef: string,
    private readonly authToken: string,
    private readonly follow: boolean,
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
    private readonly next: NextFunction
  ) {}

  create() {
    const proxyOptions: Options = {
      target: this.targetUrl,
      secure: false,
      changeOrigin: true,
      autoRewrite: true,
      pathRewrite: () => `/images/logs?imageRef=${this.imageRef}&follow=${this.follow}`,
      on: {
        proxyReq: (proxyReq: any, req: any) => {
          proxyReq.setHeader("Authorization", `Bearer ${this.authToken}`);
          proxyReq.setHeader("Accept", "application/octet-stream");
          fixRequestBody(proxyReq, req);
        },
      },
      proxyTimeout: 5 * 60 * 1000,
    };

    return createProxyMiddleware(proxyOptions)(this.req, this.res, this.next);
  }
}
