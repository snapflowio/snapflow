import { readFileSync } from "node:fs";
import {
  ConsoleLogger,
  Logger,
  type LogLevel,
  ValidationPipe,
} from "@nestjs/common";
import type { HttpsOptions } from "@nestjs/common/interfaces/external/https-options.interface";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as packageJson from "../../../package.json";
import { AppModule } from "./app.module";
import { NotFoundExceptionFilter } from "./common/middleware/frontend.middleware";
import { TypedConfigService } from "./config/typed-config.service";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter";

const httpsEnabled = process.env.CERT_PATH && process.env.CERT_KEY_PATH;
const httpsOptions: HttpsOptions = {
  cert: process.env.CERT_PATH ? readFileSync(process.env.CERT_PATH) : undefined,
  key: process.env.CERT_KEY_PATH
    ? readFileSync(process.env.CERT_KEY_PATH)
    : undefined,
};

const logLevels: LogLevel[] = [
  "error",
  "warn",
  "log",
  "debug",
  "verbose",
  "fatal",
];
if (process.env.LOG_LEVEL) logLevels.push(process.env.LOG_LEVEL as LogLevel);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      prefix: "API",
      logLevels,
    }),
    httpsOptions: httpsEnabled ? httpsOptions : undefined,
  });

  app.enableCors({
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  const configService = app.get(TypedConfigService);
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  app.useGlobalFilters(new NotFoundExceptionFilter());
  app.useGlobalPipes(new ValidationPipe());

  const globalPrefix = "api";
  app.setGlobalPrefix(globalPrefix);

  const config = new DocumentBuilder()
    .setTitle("Snapflow API")
    .setDescription("The official Snapflow backend API")
    .setVersion(packageJson.version)
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, documentFactory);

  const host = "0.0.0.0";
  const port = configService.get("port");
  await app.listen(port, host);

  Logger.log(
    `🚀 Snapflow API is running on: http://${host}:${port}/${globalPrefix}`,
  );
}

bootstrap();
