import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrganizationModule } from "../organization/organization.module";
import { ApiKeyController } from "./api-key.controller";
import { ApiKey } from "./api-key.entity";
import { ApiKeyService } from "./api-key.service";

@Module({
  imports: [OrganizationModule, TypeOrmModule.forFeature([ApiKey])],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
