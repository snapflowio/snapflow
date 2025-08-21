import { Module } from "@nestjs/common";
import { RedisModule } from "@nestjs-modules/ioredis";
import { AuthModule } from "../auth/auth.module";
import { OrganizationModule } from "../organization/organization.module";
import { SandboxModule } from "../sandbox/sandbox.module";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";

/**
 * The RealtimeModule encapsulates all functionality related to real-time communication
 * using WebSockets. It bundles the RealtimeGateway, which manages WebSocket
 * connections and event emissions, and the RealtimeService, which listens for
 * application-level events and forwards them to the gateway.
 *
 * It imports necessary modules for authentication (`AuthModule`), data access
 * (`OrganizationModule`, `SandboxModule`), and scaling (`RedisModule`).
 */
@Module({
  imports: [OrganizationModule, SandboxModule, RedisModule, AuthModule],
  providers: [RealtimeService, RealtimeGateway],
  exports: [RealtimeService, RealtimeGateway],
})
export class RealtimeModule {}
