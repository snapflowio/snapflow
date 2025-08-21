/// <reference path="./types.d.ts" />

import * as fs from "fs";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app/app.module";
import { getOpenApiConfig } from "./openapi.config";

async function generateOpenAPI() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ["error"],
    });

    const config = getOpenApiConfig();
    const document = SwaggerModule.createDocument(app, config);

    // Ensure directory exists
    fs.mkdirSync("./dist/apps/api", { recursive: true });
    fs.writeFileSync("./dist/apps/api/openapi.json", JSON.stringify(document, null, 2));

    console.log("File written to:", fs.realpathSync("./dist/apps/api/openapi.json"));

    await app.close();
    console.log("OpenAPI specification generated successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error generating OpenAPI:", error);
    process.exit(1);
  }
}

const timeout = setTimeout(() => {
  console.error("Generation timed out after 30 seconds");
  process.exit(1);
}, 30000);

process.on("exit", () => clearTimeout(timeout));

generateOpenAPI();
