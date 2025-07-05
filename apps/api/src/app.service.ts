import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { EventEmitterReadinessWatcher } from "@nestjs/event-emitter";
import { TypedConfigService } from "./config/typed-config.service";

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly configService: TypedConfigService,
    private readonly eventEmitterReadinessWatcher: EventEmitterReadinessWatcher,
  ) {}

  async onApplicationBootstrap() {}
}
