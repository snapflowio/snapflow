import { RedisModule } from "@nestjs-modules/ioredis";
import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";

@Module({
  imports: [TerminusModule, RedisModule],
  controllers: [HealthController],
  providers: [],
})
export class HealthModule {}
