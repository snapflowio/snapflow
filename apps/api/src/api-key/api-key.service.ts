import * as crypto from "crypto";
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OrganizationUser } from "../organization/entities/organization-user.entity";
import { OrganizationMemberRole } from "../organization/enums/organization-member-role.enum";
import { OrganizationResourcePermission } from "../organization/enums/organization-resource-permission.enum";
import { OrganizationUserService } from "../organization/services/organization-user.service";
import { ApiKey } from "./api-key.entity";

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    private organizationUserService: OrganizationUserService,
  ) {}

  private getSuffix(key: string) {
    return key.slice(-9);
  }

  private getPrefix(key: string) {
    return key.substring(0, 9);
  }

  private generate() {
    return `snapflow_${crypto.randomBytes(32).toString("hex")}`;
  }

  private generateHash(key: string) {
    return crypto.createHash("sha256").update(key).digest("hex");
  }

  async createApiKey(
    organizationId: string,
    userId: string,
    name: string,
    permissions: OrganizationResourcePermission[],
    expiresAt?: Date,
  ): Promise<{ apiKey: ApiKey; key: string }> {
    const existingKey = await this.apiKeyRepository.findOne({
      where: { organizationId, userId, name },
    });
    if (existingKey) throw new ConflictException("API key already exists");

    const key = this.generate();

    const apiKey = await this.apiKeyRepository.save({
      organizationId,
      userId,
      name,
      keyHash: this.generateHash(key),
      keyPrefix: this.getPrefix(key),
      keySuffix: this.getSuffix(key),
      permissions,
      createdAt: new Date(),
      expiresAt,
    });

    return { apiKey, key };
  }

  async getApiKeys(organizationId: string, userId: string): Promise<ApiKey[]> {
    const apiKeys = await this.apiKeyRepository.find({
      where: { organizationId, userId },
      order: {
        lastUsedAt: {
          direction: "DESC",
          nulls: "LAST",
        },
        createdAt: "DESC",
      },
    });

    const organizationUser = await this.organizationUserService.findOne(
      organizationId,
      userId,
    );
    if (!organizationUser)
      throw new NotFoundException(
        "Organization user (API key owner) not found",
      );

    return apiKeys.map((apiKey) => {
      return {
        ...apiKey,
        permissions: this.getEffectivePermissions(apiKey, organizationUser),
      };
    });
  }

  async getApiKeyByName(
    organizationId: string,
    userId: string,
    name: string,
  ): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: {
        organizationId,
        userId,
        name,
      },
    });

    if (!apiKey) throw new NotFoundException("API key not found");

    const organizationUser = await this.organizationUserService.findOne(
      organizationId,
      userId,
    );
    if (!organizationUser)
      throw new NotFoundException(
        "Organization user (API key owner) not found",
      );

    apiKey.permissions = this.getEffectivePermissions(apiKey, organizationUser);
    return apiKey;
  }

  async getApiKeyByValue(value: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyHash: this.generateHash(value) },
    });

    if (!apiKey) throw new NotFoundException("API key not found");

    const organizationUser = await this.organizationUserService.findOne(
      apiKey.organizationId,
      apiKey.userId,
    );

    if (!organizationUser)
      throw new NotFoundException(
        "Organization user (API key owner) not found",
      );

    apiKey.permissions = this.getEffectivePermissions(apiKey, organizationUser);
    return apiKey;
  }

  async deleteApiKey(
    organizationId: string,
    userId: string,
    name: string,
  ): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { organizationId, userId, name },
    });
    if (!apiKey) throw new NotFoundException("API key not found");

    await this.apiKeyRepository.remove(apiKey);
  }

  async updateLastUsedAt(
    organizationId: string,
    userId: string,
    name: string,
    lastUsedAt: Date,
  ): Promise<void> {
    await this.apiKeyRepository.update(
      {
        organizationId,
        userId,
        name,
      },
      { lastUsedAt },
    );
  }

  private getEffectivePermissions(
    apiKey: ApiKey,
    organizationUser: OrganizationUser,
  ): OrganizationResourcePermission[] {
    if (organizationUser.role === OrganizationMemberRole.OWNER)
      return apiKey.permissions;
    const organizationUserPermissions = new Set(
      organizationUser.assignedRoles.flatMap((role) => role.permissions),
    );

    return apiKey.permissions.filter((permission) =>
      organizationUserPermissions.has(permission),
    );
  }
}
