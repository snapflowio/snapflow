import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { EventEmitterReadinessWatcher } from "@nestjs/event-emitter";
import { ApiKeyService } from "../api-key/api-key.service";
import { TypedConfigService } from "../config/typed-config.service";
import { OrganizationService } from "../organization/services/organization.service";
import { RegistryType } from "../registry/enums/registry-type.enum";
import { RegistryService } from "../registry/registry.service";
import { ImageService } from "../sandbox/services/image.service";
import { SystemRole } from "../user/enums/system-role.enum";
import { UserService } from "../user/user.service";

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly dockerRegistryService: RegistryService,
    private readonly configService: TypedConfigService,
    private readonly userService: UserService,
    private readonly organizationService: OrganizationService,
    private readonly imageService: ImageService,
    private readonly apiKeyService: ApiKeyService,
    private readonly eventEmitterReadinessWatcher: EventEmitterReadinessWatcher
  ) {}

  async onApplicationBootstrap() {
    await this.initializeAdminUser();
    await this.initializeTransientRegistry();
    await this.initializeInternalRegistry();
    await this.initializeDefaultImage();
  }

  private async initializeAdminUser(): Promise<void> {
    if (await this.userService.findOne("admin")) return;

    await this.eventEmitterReadinessWatcher.waitUntilReady();
    const user = await this.userService.create({
      id: "admin",
      name: "Admin",
      personalOrganizationQuota: {
        totalCpuQuota: 0,
        totalMemoryQuota: 0,
        totalDiskQuota: 0,
        maxCpuPerSandbox: 0,
        maxMemoryPerSandbox: 0,
        maxDiskPerSandbox: 0,
        imageQuota: 100,
        maxImageSize: 100,
        bucketQuota: 0,
      },
      role: SystemRole.ADMIN,
    });

    const personalOrg = await this.organizationService.findPersonal(user.id);
    await this.apiKeyService.createApiKey(personalOrg.id, user.id, "admin", []);
  }

  private async initializeTransientRegistry(): Promise<void> {
    const existingRegistry = await this.dockerRegistryService.getDefaultTransientRegistry();
    if (existingRegistry) return;

    let registryUrl = this.configService.getOrThrow("transientRegistry.url");
    const registryAdmin = this.configService.getOrThrow("transientRegistry.admin");
    const registryPassword = this.configService.getOrThrow("transientRegistry.password");
    const registryProjectId = this.configService.getOrThrow("transientRegistry.projectId");

    if (!registryUrl || !registryAdmin || !registryPassword || !registryProjectId) {
      this.logger.warn("Registry configuration not found, skipping transient registry setup");
      return;
    }

    registryUrl = registryUrl.replace(/^(https?:\/\/)/, "");

    this.logger.log("Initializing default transient registry...");

    await this.dockerRegistryService.create({
      name: "Transient Registry",
      url: registryUrl,
      username: registryAdmin,
      password: registryPassword,
      project: registryProjectId,
      registryType: RegistryType.TRANSIENT,
      isDefault: true,
    });

    this.logger.log("Default transient registry initialized successfully");
  }

  private async initializeInternalRegistry(): Promise<void> {
    const existingRegistry = await this.dockerRegistryService.getDefaultInternalRegistry();
    if (existingRegistry) return;

    let registryUrl = this.configService.getOrThrow("internalRegistry.url");
    const registryAdmin = this.configService.getOrThrow("internalRegistry.admin");
    const registryPassword = this.configService.getOrThrow("internalRegistry.password");
    const registryProjectId = this.configService.getOrThrow("internalRegistry.projectId");

    if (!registryUrl || !registryAdmin || !registryPassword || !registryProjectId) {
      this.logger.warn("Registry configuration not found, skipping internal registry setup");
      return;
    }

    registryUrl = registryUrl.replace(/^(https?:\/\/)/, "");

    this.logger.log("Initializing default internal registry...");

    await this.dockerRegistryService.create({
      name: "Internal Registry",
      url: registryUrl,
      username: registryAdmin,
      password: registryPassword,
      project: registryProjectId,
      registryType: RegistryType.INTERNAL,
      isDefault: true,
    });

    this.logger.log("Default internal registry initialized successfully");
  }

  private async initializeDefaultImage(): Promise<void> {
    let adminPersonalOrg = await this.organizationService.findPersonal("admin");
    adminPersonalOrg = await this.organizationService.unsuspend(adminPersonalOrg.id);

    try {
      const existingSnapshot = await this.imageService.getImageByName(
        this.configService.getOrThrow("defaultImage"),
        adminPersonalOrg.id
      );

      if (existingSnapshot) return;
    } catch {
      this.logger.log("Default snapshot not found, creating...");
    }

    const defaultSnapshot = this.configService.getOrThrow("defaultImage");

    await this.imageService.createImage(
      adminPersonalOrg,
      {
        name: defaultSnapshot,
        imageName: defaultSnapshot,
      },
      true
    );
  }
}
