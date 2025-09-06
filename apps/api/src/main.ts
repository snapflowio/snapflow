import { ConsoleLogger, Logger, LogLevel, ValidationPipe } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app/app.module";
import { TypedConfigService } from "./config/typed-config.service";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter";

const logLevels: LogLevel[] = ["error", "warn", "log", "debug", "verbose", "fatal"];
if (process.env.LOG_LEVEL) {
  logLevels.push(process.env.LOG_LEVEL as LogLevel);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
    logger: new ConsoleLogger({
      prefix: "API",
      logLevels,
    }),
  });

  app.disable("x-powered-by");

  const configService = app.get(TypedConfigService);
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  app.useGlobalPipes(new ValidationPipe());

  const globalPrefix = "api";
  app.setGlobalPrefix(globalPrefix);

  const documentFactory = () =>
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Snapflow")
        .setDescription("API Docs for Snapflow")
        .setVersion("0.1")
        .addCookieAuth("snapflow.session_token")
        .build()
    );

  SwaggerModule.setup("api", app, documentFactory);

  const host = "0.0.0.0";
  const port = configService.get("port");
  await app.listen(port, host);

  Logger.log(`🚀 API running on: ${host}:${port}/${globalPrefix}`);

  const gracefulShutdown = async (signal: string) => {
    Logger.log(`Received ${signal}. Starting graceful shutdown...`);
    try {
      await app.close();
      Logger.log("Application closed gracefully");
      process.exit(0);
    } catch (error) {
      Logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  return app;
}

bootstrap().catch((error) => {
  Logger.error("Failed to start application:", error);
  process.exit(1);
});
