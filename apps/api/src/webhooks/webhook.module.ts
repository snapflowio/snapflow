import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Organization } from "../organization/entities/organization.entity";
import { OrganizationModule } from "../organization/organization.module";
import { RedisLockProvider } from "../sandbox/common/redis-lock.provider";
import { UserModule } from "../user/user.module";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";

@Module({
  imports: [UserModule, OrganizationModule, TypeOrmModule.forFeature([Organization])],
  controllers: [WebhookController],
  providers: [RedisLockProvider, WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
