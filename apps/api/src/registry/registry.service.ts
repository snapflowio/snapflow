import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { RegistryPushAccessDto } from "../sandbox/dto/registry-push-access.dto";
import { CreateDockerRegistryDto } from "./dto/create-registry.dto";
import { UpdateRegistryDto } from "./dto/update-registry.dto";
import { Registry } from "./entities/registry.entity";
import { RegistryType } from "./enums/registry-type.enum";
import { IRegistryProvider, REGISTRY_PROVIDER } from "./providers/registry.provider.interface";

@Injectable()
export class RegistryService {
  constructor(
    @InjectRepository(Registry)
    private readonly registryRepository: Repository<Registry>,
    @Inject(REGISTRY_PROVIDER)
    private readonly registryProvider: IRegistryProvider
  ) {}

  async create(createDto: CreateDockerRegistryDto, organizationId?: string): Promise<Registry> {
    if (organizationId) {
      const registries = await this.registryRepository.find({
        where: { organizationId },
      });

      if (registries.length >= 100)
        throw new ForbiddenException("You have reached the maximum number of registries");
    }

    const registry = this.registryRepository.create({
      ...createDto,
      organizationId,
    });

    return this.registryRepository.save(registry);
  }

  async findAll(organizationId: string): Promise<Registry[]> {
    return this.registryRepository.find({
      where: { organizationId },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findOne(registryId: string): Promise<Registry | null> {
    return this.registryRepository.findOne({
      where: { id: registryId },
    });
  }

  async findOneOrFail(registryId: string): Promise<Registry> {
    return this.registryRepository.findOneOrFail({
      where: { id: registryId },
    });
  }

  async update(registryId: string, updateDto: UpdateRegistryDto): Promise<Registry> {
    const registry = await this.registryRepository.findOne({
      where: { id: registryId },
    });

    if (!registry) throw new NotFoundException(`Docker registry with ID ${registryId} not found`);

    registry.name = updateDto.name;
    registry.username = updateDto.username;
    if (updateDto.password) registry.password = updateDto.password;

    return this.registryRepository.save(registry);
  }

  async remove(registryId: string): Promise<void> {
    const registry = await this.registryRepository.findOne({
      where: { id: registryId },
    });

    if (!registry) throw new NotFoundException(`Docker registry with ID ${registryId} not found`);

    await this.registryRepository.remove(registry);
  }

  async setDefault(registryId: string): Promise<Registry> {
    const registry = await this.registryRepository.findOne({
      where: { id: registryId },
    });

    if (!registry) throw new NotFoundException(`Docker registry with ID ${registryId} not found`);

    await this.unsetDefaultRegistry();

    registry.isDefault = true;
    return this.registryRepository.save(registry);
  }

  private async unsetDefaultRegistry(): Promise<void> {
    await this.registryRepository.update({ isDefault: true }, { isDefault: false });
  }

  async getDefaultInternalRegistry(): Promise<Registry | null> {
    return this.registryRepository.findOne({
      where: { isDefault: true, registryType: RegistryType.INTERNAL },
    });
  }

  async getDefaultTransientRegistry(): Promise<Registry | null> {
    return this.registryRepository.findOne({
      where: { isDefault: true, registryType: RegistryType.TRANSIENT },
    });
  }

  async findOneByImageImageName(
    imageName: string,
    organizationId?: string
  ): Promise<Registry | null> {
    const whereCondition = organizationId
      ? [
          {
            organizationId,
            registryType: In([RegistryType.INTERNAL, RegistryType.ORGANIZATION]),
          },
          {
            organizationId: IsNull(),
            registryType: In([RegistryType.INTERNAL, RegistryType.ORGANIZATION]),
          },
        ]
      : [
          {
            organizationId: IsNull(),
            registryType: In([RegistryType.INTERNAL, RegistryType.ORGANIZATION]),
          },
        ];

    const registries = await this.registryRepository.find({
      where: whereCondition,
    });

    for (const registry of registries) {
      const strippedUrl = registry.url.replace(/^(https?:\/\/)/, "");
      if (imageName.startsWith(strippedUrl)) {
        return registry;
      }
    }

    return null;
  }

  async getRegistryPushAccess(
    organizationId: string,
    userId: string
  ): Promise<RegistryPushAccessDto> {
    const transientRegistry = await this.getDefaultTransientRegistry();
    if (!transientRegistry) {
      throw new Error("No default transient registry configured");
    }

    const uniqueId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const robotName = `temp-push-robot-${uniqueId}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const url = `${this.getRegistryUrl(transientRegistry)}/api/v2.0/robots`;

    try {
      const response = await this.registryProvider.createRobotAccount(
        url,
        {
          username: transientRegistry.username,
          password: transientRegistry.password,
        },
        {
          name: robotName,
          description: `Temporary push access for user ${userId} in organization ${organizationId}`,
          duration: 3600,
          level: "project",
          permissions: [
            {
              kind: "project",
              namespace: transientRegistry.project,
              access: [{ resource: "repository", action: "push" }],
            },
          ],
        }
      );

      return {
        username: response.name,
        secret: response.secret,
        registryId: transientRegistry.id,
        registryUrl: new URL(url).host,
        project: transientRegistry.project,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      let errorMessage = `Failed to generate push token: ${error.message}`;
      if (error.response)
        errorMessage += ` - ${error.response.data.message || error.response.statusText}`;

      throw new Error(errorMessage);
    }
  }

  async removeImage(imageName: string, registryId: string): Promise<void> {
    const registry = await this.findOne(registryId);
    if (!registry) throw new Error("Registry not found");

    const [nameWithTag, tag] = imageName.split(":");

    const parts = nameWithTag.split("/");
    let project: string;
    let repository: string;

    if (parts.length >= 3 && parts[0].includes(".")) {
      project = parts[1];
      repository = parts.slice(2).join("/");
    } else if (parts.length === 2) {
      [project, repository] = parts;
    } else {
      throw new Error("Invalid image name format. Expected: [registry]/project/repository[:tag]");
    }

    try {
      await this.registryProvider.deleteArtifact(
        this.getRegistryUrl(registry),
        {
          username: registry.username,
          password: registry.password,
        },
        { project, repository, tag }
      );
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      throw new Error(`Failed to remove image ${imageName}: ${message}`);
    }
  }

  getRegistryUrl(registry: Registry): string {
    if (registry.url === "registry:5000") return "http://registry:5000";

    return registry.url.startsWith("http") ? registry.url : `https://${registry.url}`;
  }
}
