import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Organization } from "../../organization/entities/organization.entity";
import { OrganizationService } from "../../organization/services/organization.service";
import { SandboxEvents } from "../constants/sandbox-events.constants";
import { CreateImageDto } from "../dto/create-image.dto";
import {
  BuildInfo,
  generateBuildInfoHash as generateBuildImageRef,
} from "../entities/build-info.entity";
import { Image } from "../entities/image.entity";
import { ImageState } from "../enums/image-state.enum";
import { SandboxCreatedEvent } from "../events/sandbox-create.event";

const IMAGE_NAME_REGEX = /^[a-zA-Z0-9.\-:]+(\/[a-zA-Z0-9.\-:]+)*$/;
@Injectable()
export class ImageService {
  constructor(
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    @InjectRepository(BuildInfo)
    private readonly buildInfoRepository: Repository<BuildInfo>,
    private readonly organizationService: OrganizationService
  ) {}

  private validateRegistryImageName(name: string): string | null {
    if (!name.includes(":") || name.endsWith(":") || /:\s*$/.test(name)) {
      return "Image name must include a tag (e.g., ubuntu:22.04)";
    }

    if (name.endsWith(":latest")) {
      return 'Images with tag ":latest" are not allowed';
    }

    if (!IMAGE_NAME_REGEX.test(name)) {
      return "Invalid image name format. Must be lowercase, may contain digits, dots, dashes, and single slashes between components";
    }

    return null;
  }

  private validateImageName(name: string): string | null {
    if (!IMAGE_NAME_REGEX.test(name))
      return "Invalid image name format. May contain letters, digits, dots, colons, and dashes";

    return null;
  }

  async createImage(organization: Organization, createImageDto: CreateImageDto, general = false) {
    const nameValidationError = this.validateImageName(createImageDto.name);
    if (nameValidationError) throw new BadRequestException(nameValidationError);

    if (createImageDto.imageName) {
      const imageValidationError = this.validateRegistryImageName(createImageDto.imageName);
      if (imageValidationError) {
        throw new BadRequestException(imageValidationError);
      }
    }

    console.log("Organization object:", JSON.stringify(organization, null, 2));
    console.log("Organization suspended status:", organization.suspended);
    console.log("Organization suspended type:", typeof organization.suspended);

    this.organizationService.assertOrganizationIsNotSuspended(organization);

    const images = await this.imageRepository.find({
      where: { organizationId: organization.id },
    });

    if (images.length >= organization.imageQuota) {
      throw new ForbiddenException("Reached the maximum number of images in the organization");
    }

    await this.validateOrganizationMaxQuotas(
      organization,
      createImageDto.cpu,
      createImageDto.memory,
      createImageDto.disk
    );

    try {
      const image = this.imageRepository.create({
        organizationId: organization.id,
        ...createImageDto,
        mem: createImageDto.memory, // Map memory to mem
        state: createImageDto.buildInfo ? ImageState.BUILD_PENDING : ImageState.PENDING,
        general,
      });

      if (createImageDto.buildInfo) {
        const buildImageRef = generateBuildImageRef(
          createImageDto.buildInfo.dockerfileContent,
          createImageDto.buildInfo.contextHashes
        );

        // Check if buildInfo with the same imageRef already exists
        const existingBuildInfo = await this.buildInfoRepository.findOne({
          where: { imageRef: buildImageRef },
        });

        if (existingBuildInfo) {
          image.buildInfo = existingBuildInfo;
        } else {
          const buildInfoEntity = this.buildInfoRepository.create({
            ...createImageDto.buildInfo,
          });
          await this.buildInfoRepository.save(buildInfoEntity);
          image.buildInfo = buildInfoEntity;
        }
      }

      return await this.imageRepository.save(image);
    } catch (error) {
      if (error.code === "23505") {
        // PostgreSQL unique violation error code
        throw new ConflictException(
          `Image with name "${createImageDto.name}" already exists for this organization`
        );
      }
      throw error;
    }
  }

  async toggleImageState(imageId: string, enabled: boolean) {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`Image ${imageId} not found`);
    }

    image.enabled = enabled;
    return await this.imageRepository.save(image);
  }

  async removeImage(imageId: string) {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`Image ${imageId} not found`);
    }
    if (image.general) {
      throw new ForbiddenException("You cannot delete a general image");
    }
    image.state = ImageState.REMOVING;
    await this.imageRepository.save(image);
  }

  async getAllImages(organizationId: string, page = 1, limit = 10) {
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const [items, total] = await this.imageRepository.findAndCount({
      // Retrieve all images belonging to the organization as well as all general images
      where: [{ organizationId }, { general: true, hideFromUsers: false }],
      order: {
        general: "ASC", // Sort general images last
        lastUsedAt: {
          direction: "DESC",
          nulls: "LAST",
        },
        createdAt: "DESC",
      },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    return {
      items,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getImage(imageId: string): Promise<Image> {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`Image ${imageId} not found`);
    }

    return image;
  }

  async getImageByName(imageName: string, organizationId: string): Promise<Image> {
    const image = await this.imageRepository.findOne({
      where: { name: imageName, organizationId },
    });

    if (!image) {
      //  check if the image is general
      const generalImage = await this.imageRepository.findOne({
        where: { name: imageName, general: true },
      });
      if (generalImage) {
        return generalImage;
      }

      throw new NotFoundException(`Image with name ${imageName} not found`);
    }

    return image;
  }

  async setImageGeneralStatus(imageId: string, general: boolean) {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`Image ${imageId} not found`);
    }

    image.general = general;
    return await this.imageRepository.save(image);
  }

  private async validateOrganizationMaxQuotas(
    organization: Organization,
    cpu?: number,
    memory?: number,
    disk?: number
  ): Promise<void> {
    if (cpu && cpu > organization.maxCpuPerSandbox) {
      throw new ForbiddenException(
        `CPU request ${cpu} exceeds maximum allowed per sandbox (${organization.maxCpuPerSandbox})`
      );
    }
    if (memory && memory > organization.maxMemoryPerSandbox) {
      throw new ForbiddenException(
        `Memory request ${memory}GB exceeds maximum allowed per sandbox (${organization.maxMemoryPerSandbox}GB)`
      );
    }
    if (disk && disk > organization.maxDiskPerSandbox) {
      throw new ForbiddenException(
        `Disk request ${disk}GB exceeds maximum allowed per sandbox (${organization.maxDiskPerSandbox}GB)`
      );
    }
  }

  @OnEvent(SandboxEvents.CREATED)
  private async handleSandboxCreatedEvent(event: SandboxCreatedEvent) {
    if (!event.sandbox.image) {
      return;
    }

    const image = await this.getImageByName(event.sandbox.image, event.sandbox.organizationId);
    image.lastUsedAt = event.sandbox.createdAt;
    await this.imageRepository.save(image);
  }

  async activateImage(imageId: string): Promise<Image> {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`Image ${imageId} not found`);
    }

    if (image.state === ImageState.ACTIVE) {
      throw new BadRequestException(`Image ${imageId} is already active`);
    }

    if (image.state !== ImageState.INACTIVE) {
      throw new BadRequestException(
        `Image ${imageId} cannot be activated - it is in ${image.state} state`
      );
    }

    image.state = ImageState.ACTIVE;
    image.lastUsedAt = new Date();
    return await this.imageRepository.save(image);
  }
}
