import { Logger, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { Server, Socket } from "socket.io";
import { JwtStrategy } from "../auth/strategies/jwt.strategy";
import { OrganizationService } from "../organization/services/organization.service";
import { BucketEvents } from "../sandbox/constants/bucket-events.constants";
import { ImageEvents } from "../sandbox/constants/image-events.constants";
import { SandboxEvents } from "../sandbox/constants/sandbox-events.constants";
import { BucketDto } from "../sandbox/dto/bucket.dto";
import { ImageDto } from "../sandbox/dto/image.dto";
import { SandboxDto } from "../sandbox/dto/sandbox.dto";
import { BucketState } from "../sandbox/enums/bucket-state.enum";
import { ImageState } from "../sandbox/enums/image-state.enum";
import { SandboxDesiredState } from "../sandbox/enums/sandbox-desired-state.enum";
import { SandboxState } from "../sandbox/enums/sandbox-state.enum";

@WebSocketGateway({
  path: "/api/realtime/",
  transports: ["websocket"],
})
export class RealtimeGateway implements OnGatewayInit, OnModuleInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly jwtStrategy: JwtStrategy,
    private readonly organizationService: OrganizationService
  ) {}

  onModuleInit() {
    const pubClient = this.redis.duplicate();
    const subClient = pubClient.duplicate();
    this.server.adapter(createAdapter(pubClient, subClient));
    this.logger.debug("Realtime gateway started");
  }

  afterInit(server: Server) {
    this.logger.debug("Realtime gateway initialized");

    server.use(async (socket: Socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new UnauthorizedException());

      try {
        const payload = await this.jwtStrategy.verifyToken(token);
        await socket.join(payload.sub);

        const organizations = await this.organizationService.findByUser(payload.sub);
        const organizationIds = organizations.map((organization) => organization.id);
        await socket.join(organizationIds);
        next();
      } catch (error) {
        next(new UnauthorizedException());
      }
    });
  }

  emitSandboxCreated(sandbox: SandboxDto) {
    this.server.to(sandbox.organizationId).emit(SandboxEvents.CREATED, sandbox);
  }

  emitSandboxStateUpdated(sandbox: SandboxDto, oldState: SandboxState, newState: SandboxState) {
    this.server
      .to(sandbox.organizationId)
      .emit(SandboxEvents.STATE_UPDATED, { sandbox, oldState, newState });
  }

  emitSandboxDesiredStateUpdated(
    sandbox: SandboxDto,
    oldDesiredState: SandboxDesiredState,
    newDesiredState: SandboxDesiredState
  ) {
    this.server.to(sandbox.organizationId).emit(SandboxEvents.DESIRED_STATE_UPDATED, {
      sandbox,
      oldDesiredState,
      newDesiredState,
    });
  }

  emitImageCreated(image: ImageDto) {
    this.server.to(image.organizationId).emit(ImageEvents.CREATED, image);
  }

  emitImageStateUpdated(image: ImageDto, oldState: ImageState, newState: ImageState) {
    this.server
      .to(image.organizationId)
      .emit(ImageEvents.STATE_UPDATED, { image: image, oldState, newState });
  }

  emitImageEnabledToggled(image: ImageDto) {
    this.server.to(image.organizationId).emit(ImageEvents.ENABLED_TOGGLED, image);
  }

  emitImageRemoved(image: ImageDto) {
    this.server.to(image.organizationId).emit(ImageEvents.REMOVED, image.id);
  }

  emitBucketCreated(bucket: BucketDto) {
    this.server.to(bucket.organizationId).emit(BucketEvents.CREATED, bucket);
  }

  emitBucketStateUpdated(bucket: BucketDto, oldState: BucketState, newState: BucketState) {
    this.server
      .to(bucket.organizationId)
      .emit(BucketEvents.STATE_UPDATED, { bucket, oldState, newState });
  }

  emitBucketLastUsedAtUpdated(bucket: BucketDto) {
    this.server.to(bucket.organizationId).emit(BucketEvents.LAST_USED_AT_UPDATED, bucket);
  }
}
