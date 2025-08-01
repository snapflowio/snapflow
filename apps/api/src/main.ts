import { ConsoleLogger, Logger, type LogLevel, ValidationPipe } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app/app.module";
import { TypedConfigService } from "./config/typed-config.service";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter";
import { ExecutorRegion } from "./sandbox/enums/executor-region.enum";
import { SandboxClass } from "./sandbox/enums/sandbox-class.enum";
import { ExecutorService } from "./sandbox/services/executor.service";

const logLevels: LogLevel[] = ["error", "warn", "log", "debug", "verbose", "fatal"];
if (process.env.LOG_LEVEL) logLevels.push(process.env.LOG_LEVEL as LogLevel);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      prefix: "API",
      logLevels,
    }),
  });

  app.enableCors({
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  const configService = app.get(TypedConfigService);
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  app.useGlobalPipes(new ValidationPipe());

  const globalPrefix = "api";
  app.setGlobalPrefix(globalPrefix, { exclude: ["sse", "messages", "mcp"] });

  const documentFactory = () =>
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Snapflow")
        .addServer("http://localhost:3000")
        .setDescription("API Docs for Snapflow")
        .setVersion("0.1")
        .addBearerAuth({
          type: "http",
          scheme: "bearer",
          description: "API Key access",
        })
        .addOAuth2({
          type: "openIdConnect",
          flows: undefined,
          openIdConnectUrl: `${configService.get("oidc.issuer")}/.well-known/openid-configuration`,
        })
        .build()
    );

  SwaggerModule.setup("api", app, documentFactory, {
    swaggerOptions: {
      initOAuth: {
        clientId: configService.get("oidc.clientId"),
        appName: "Snapflow",
        scopes: ["open_id", "email", "profile"],
      },
    },
  });

  if (!configService.get("production")) {
    const executorService = app.get(ExecutorService);
    const executors = await executorService.findAll();
    if (!executors.find((executor) => executor.domain === "localhost:8083")) {
      await executorService.create({
        apiUrl: "http://localhost:8083",
        apiKey: "secret_api_token",
        cpu: 4,
        memory: 8192,
        disk: 50,
        gpu: 0,
        gpuType: "none",
        capacity: 100,
        region: ExecutorRegion.US,
        class: SandboxClass.SMALL,
        domain: "localhost:8083",
      });
    }
  }

  const host = "0.0.0.0";
  const port = configService.get("port");
  await app.listen(port, host);

  Logger.log(`🚀 Snapflow API is running on: http://${host}:${port}/${globalPrefix}`);
}

bootstrap();
