import { DocumentBuilder } from "@nestjs/swagger";

export function getOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle("Snapflow")
    .addServer("http://localhost:3000")
    .setDescription("Snapflow AI platform API Docs")
    .setVersion("1.0")
    .addCookieAuth("snapflow.session_token")
    .build();
}
