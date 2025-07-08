import { DocumentBuilder } from "@nestjs/swagger";

const getOpenApiConfig = () =>
  new DocumentBuilder()
    .setTitle("Snapflow")
    .addServer("http://localhost:3000")
    .setDescription("Snapflow AI platform API Docs")
    .setContact(
      "Snapflow Platforms Inc.",
      "https://www.snapflow.io",
      "support@snapflow.com",
    )
    .setVersion("1.0")
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      description: "API Key access",
    })
    .build();

export { getOpenApiConfig };
