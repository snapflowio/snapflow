import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrganizationModule } from "../organization/organization.module";
import { ApiKeyController } from "./api-key.controller";
import { ApiKey } from "./api-key.entity";
import { ApiKeyService } from "./api-key.service";

/**
 * Encapsulates the functionality for managing API keys within organizations.
 *
 * This module imports the `OrganizationModule` to interact with organization data
 * and uses `TypeOrmModule` to register the `ApiKey` entity. It provides and
 * exports the `ApiKeyService` for use in other parts of the application.
 */
@Module({
  imports: [OrganizationModule, TypeOrmModule.forFeature([ApiKey])],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
