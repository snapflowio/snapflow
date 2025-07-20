import * as crypto from "crypto";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OrganizationUser } from "../organization/entities/organization-user.entity";
import { OrganizationMemberRole } from "../organization/enums/organization-member-role.enum";
import { OrganizationResourcePermission } from "../organization/enums/organization-resource-permission.enum";
import { OrganizationUserService } from "../organization/services/organization-user.service";
import { ApiKey } from "./api-key.entity";

// Constants for key generation
const API_KEY_PREFIX = "snapflow_";
const KEY_FRAGMENT_LENGTH = 9;
const HASH_ALGORITHM = "sha256";

/**
 * Service responsible for the business logic of creating, retrieving,
 * and managing API keys.
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly organizationUserService: OrganizationUserService
  ) {}

  /**
   * Creates a new API key for a user within an organization.
   * @param organizationId - The ID of the organization.
   * @param userId - The ID of the user creating the key.
   * @param name - A unique name for the key.
   * @param permissions - The permissions to assign to the key.
   * @param expiresAt - An optional expiration date for the key.
   * @returns A promise that resolves to the created ApiKey entity and the raw, unhashed key.
   * @throws {ConflictException} If an API key with the same name already exists for the user.
   */
  async createApiKey(
    organizationId: string,
    userId: string,
    name: string,
    permissions: OrganizationResourcePermission[],
    expiresAt?: Date
  ): Promise<{ apiKey: ApiKey; key: string }> {
    const existingKey = await this.apiKeyRepository.findOne({
      where: { organizationId, userId, name },
    });
    if (existingKey) {
      throw new ConflictException("An API key with this name already exists.");
    }

    const key = this.generate();
    const keyHash = this.generateHash(key);

    const apiKey = await this.apiKeyRepository.save({
      organizationId,
      userId,
      name,
      keyHash,
      keyPrefix: this.getPrefix(key),
      keySuffix: this.getSuffix(key),
      permissions,
      createdAt: new Date(),
      expiresAt,
    });

    this.logger.log(`Successfully created API key "${name}" for user ${userId}`);
    return { apiKey, key };
  }

  /**
   * Retrieves all API keys for a specific user in an organization.
   * @param organizationId - The ID of the organization.
   * @param userId - The ID of the user.
   * @returns A promise that resolves to an array of ApiKey entities with effective permissions.
   */
  async getApiKeys(organizationId: string, userId: string): Promise<ApiKey[]> {
    const apiKeys = await this.apiKeyRepository.find({
      where: { organizationId, userId },
      order: {
        lastUsedAt: "DESC",
        createdAt: "DESC",
      },
    });

    const organizationUser = await this.findOrganizationUser(organizationId, userId);

    return apiKeys.map((apiKey) => ({
      ...apiKey,
      permissions: this.getEffectivePermissions(apiKey, organizationUser),
    }));
  }

  /**
   * Retrieves a single API key by its name for a specific user.
   * @param organizationId - The ID of the organization.
   * @param userId - The ID of the user.
   * @param name - The name of the API key.
   * @returns A promise that resolves to the ApiKey entity with effective permissions.
   * @throws {NotFoundException} If the API key or user is not found.
   */
  async getApiKeyByName(organizationId: string, userId: string, name: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { organizationId, userId, name },
    });
    if (!apiKey) {
      throw new NotFoundException("API key not found.");
    }

    const organizationUser = await this.findOrganizationUser(organizationId, userId);
    apiKey.permissions = this.getEffectivePermissions(apiKey, organizationUser);
    return apiKey;
  }

  /**
   * Retrieves an API key by its raw value.
   * @param value - The raw API key string provided by a client.
   * @returns A promise that resolves to the ApiKey entity with effective permissions.
   * @throws {NotFoundException} If the API key is not found.
   */
  async getApiKeyByValue(value: string): Promise<ApiKey> {
    const keyHash = this.generateHash(value);
    const apiKey = await this.apiKeyRepository.findOne({ where: { keyHash } });

    if (!apiKey) {
      throw new NotFoundException("API key not found.");
    }

    const organizationUser = await this.findOrganizationUser(apiKey.organizationId, apiKey.userId);
    apiKey.permissions = this.getEffectivePermissions(apiKey, organizationUser);
    return apiKey;
  }

  /**
   * Deletes an API key by its name.
   * @param organizationId - The ID of the organization.
   * @param userId - The ID of the user who owns the key.
   * @param name - The name of the API key to delete.
   * @returns A promise that resolves when the key is deleted.
   * @throws {NotFoundException} If the API key is not found.
   */
  async deleteApiKey(organizationId: string, userId: string, name: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { organizationId, userId, name },
    });
    if (!apiKey) {
      throw new NotFoundException("API key not found.");
    }

    await this.apiKeyRepository.remove(apiKey);
    this.logger.log(`Successfully deleted API key "${name}" for user ${userId}`);
  }

  /**
   * Updates the last used timestamp for an API key.
   * @param organizationId - The ID of the organization.
   * @param userId - The ID of the user.
   * @param name - The name of the API key.
   * @param lastUsedAt - The timestamp to set as the last used date.
   */
  async updateLastUsedAt(
    organizationId: string,
    userId: string,
    name: string,
    lastUsedAt: Date
  ): Promise<void> {
    await this.apiKeyRepository.update({ organizationId, userId, name }, { lastUsedAt });
  }

  /**
   * Generates a secure, random API key string.
   * @returns A new API key string.
   */
  private generate(): string {
    const randomBytes = crypto.randomBytes(32).toString("hex");
    return `${API_KEY_PREFIX}${randomBytes}`;
  }

  /**
   * Hashes an API key value using a secure algorithm.
   * @param key - The raw API key to hash.
   * @returns The hex-encoded hash string.
   */
  private generateHash(key: string): string {
    return crypto.createHash(HASH_ALGORITHM).update(key).digest("hex");
  }

  /**
   * Extracts the last few characters of a key for display.
   * @param key - The raw API key.
   * @returns The key's suffix.
   */
  private getSuffix(key: string): string {
    return key.slice(-KEY_FRAGMENT_LENGTH);
  }

  /**
   * Extracts the first few characters of a key for display.
   * Excludes the "snapflow_" prefix.
   * @param key - The raw API key.
   * @returns The key's prefix for display.
   */
  private getPrefix(key: string): string {
    return key.substring(API_KEY_PREFIX.length, API_KEY_PREFIX.length + KEY_FRAGMENT_LENGTH);
  }

  /**
   * Finds an organization user and throws a standard error if not found.
   * @param organizationId - The ID of the organization.
   * @param userId - The ID of the user.
   * @returns A promise that resolves to the OrganizationUser entity.
   * @throws {NotFoundException} If the organization user is not found.
   */
  private async findOrganizationUser(
    organizationId: string,
    userId: string
  ): Promise<OrganizationUser> {
    const organizationUser = await this.organizationUserService.findOne(organizationId, userId);
    if (!organizationUser) {
      this.logger.warn(
        `Attempted to access API keys for non-existent user ${userId} in organization ${organizationId}`
      );
      throw new NotFoundException("Organization user (API key owner) not found.");
    }
    return organizationUser;
  }

  /**
   * Calculates the effective permissions for an API key by intersecting its
   * assigned permissions with the permissions of its owner.
   * @param apiKey - The API key entity.
   * @param organizationUser - The user who owns the API key.
   * @returns An array of the permissions the key can actually use.
   */
  private getEffectivePermissions(
    apiKey: ApiKey,
    organizationUser: OrganizationUser
  ): OrganizationResourcePermission[] {
    // Owners have all permissions, so the key's permissions are not restricted.
    if (organizationUser.role === OrganizationMemberRole.OWNER) {
      return apiKey.permissions;
    }

    const organizationUserPermissions = new Set(
      organizationUser.assignedRoles.flatMap((role) => role.permissions)
    );

    // Filter the key's permissions to only include those the user also has.
    return apiKey.permissions.filter((permission) => organizationUserPermissions.has(permission));
  }
}
