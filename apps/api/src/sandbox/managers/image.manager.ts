import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { Redis } from "ioredis";
import { In, LessThan, Not, Raw, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { fromAxiosError } from "../../common/utils/axios-error";
import { OrganizationService } from "../../organization/services/organization.service";
import { Registry } from "../../registry/entities/registry.entity";
import { RegistryType } from "../../registry/enums/registry-type.enum";
import { RegistryService } from "../../registry/registry.service";
import { ExecutorAdapterFactory } from "../adapter/adapter";
import { RedisLockProvider } from "../common/redis-lock.provider";
import { DockerProvider } from "../docker/docker-provider";
import { BuildInfo } from "../entities/build-info.entity";
import { Executor } from "../entities/executor.entity";
import { Image } from "../entities/image.entity";
import { ImageExecutor } from "../entities/image-executor.entity";
import { ExecutorState } from "../enums/executor-state.enum";
import { ImageExecutorState } from "../enums/image-executor-state.enum";
import { ImageState } from "../enums/image-state.enum";
import { ExecutorNotReadyError } from "../errors/executor-not-ready.error";
import { ExecutorService } from "../services/executor.service";
@Injectable()
export class ImageManager {
  private readonly logger = new Logger(ImageManager.name);
  //  generate a unique instance id used to ensure only one instance of the worker is handing the
  //  image activation
  private readonly instanceId = uuidv4();

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    @InjectRepository(ImageExecutor)
    private readonly imageExecutorRepository: Repository<ImageExecutor>,
    @InjectRepository(Executor)
    private readonly executorRepository: Repository<Executor>,
    @InjectRepository(BuildInfo)
    private readonly buildInfoRepository: Repository<BuildInfo>,
    private readonly executorService: ExecutorService,
    private readonly dockerRegistryService: RegistryService,
    private readonly dockerProvider: DockerProvider,
    private readonly executorAdapterFactory: ExecutorAdapterFactory,
    private readonly redisLockProvider: RedisLockProvider,
    private readonly organizationService: OrganizationService
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async syncExecutorImages() {
    const lockKey = "sync-executor-images-lock";
    if (!(await this.redisLockProvider.lock(lockKey, 30))) {
      return;
    }

    const skip = (await this.redis.get("sync-executor-images-skip")) || 0;

    const images = await this.imageRepository
      .createQueryBuilder("image")
      .innerJoin("organization", "org", "org.id = image.organizationId")
      .where("image.state = :imageState", { imageState: ImageState.ACTIVE })
      .andWhere("org.suspended = false")
      .orderBy("image.createdAt", "ASC")
      .take(100)
      .skip(Number(skip))
      .getMany();

    if (images.length === 0) {
      await this.redis.set("sync-executor-images-skip", 0);
      return;
    }

    await this.redis.set("sync-executor-images-skip", Number(skip) + images.length);

    await Promise.all(
      images.map((image) => {
        this.propagateImageToExecutors(image.internalName).catch((err) => {
          this.logger.error(`Error propagating image ${image.id} to executors: ${err}`);
        });
      })
    );

    await this.redisLockProvider.unlock(lockKey);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async syncExecutorImageStates() {
    //  this approach is not ideal, as if the number of executors is large, this will take a long time
    //  also, if some images stuck in a "pulling" state, they will infest the queue
    //  todo: find a better approach

    const lockKey = "sync-executor-image-states-lock";
    if (!(await this.redisLockProvider.lock(lockKey, 30))) {
      return;
    }

    const executorImages = await this.imageExecutorRepository
      .createQueryBuilder("imageExecutor")
      .where({
        state: In([
          ImageExecutorState.PULLING_IMAGE,
          ImageExecutorState.BUILDING_IMAGE,
          ImageExecutorState.REMOVING,
        ]),
      })
      .orderBy("RANDOM()")
      .take(100)
      .getMany();

    await Promise.allSettled(
      executorImages.map((imageExecutor) => {
        return this.syncExecutorImageState(imageExecutor).catch((err) => {
          if (err.code !== "ECONNRESET") {
            if (err instanceof ExecutorNotReadyError) {
              this.logger.debug(
                `Executor ${imageExecutor.executorId} is not ready while trying to sync image executor ${imageExecutor.id}: ${err}`
              );
              return;
            }
            this.logger.error(
              `Error syncing executor image state ${imageExecutor.id}: ${fromAxiosError(err)}`
            );
            this.imageExecutorRepository.update(imageExecutor.id, {
              state: ImageExecutorState.ERROR,
              errorReason: fromAxiosError(err).message,
            });
          }
        });
      })
    );

    await this.redisLockProvider.unlock(lockKey);
  }

  async syncExecutorImageState(imageExecutor: ImageExecutor): Promise<void> {
    const executor = await this.executorRepository.findOne({
      where: {
        id: imageExecutor.executorId,
      },
    });
    if (!executor) {
      //  cleanup the image executor record if the executor is not found
      //  this can happen if the executor is deleted from the database without cleaning up the image executors
      await this.imageExecutorRepository.delete(imageExecutor.id);
      this.logger.warn(
        `Executor ${imageExecutor.executorId} not found while trying to process image executor ${imageExecutor.id}. Image executor has been removed.`
      );
      return;
    }
    if (executor.state !== ExecutorState.READY) {
      //  todo: handle timeout policy
      //  for now just remove the image executor record if the executor is not ready
      await this.imageExecutorRepository.delete(imageExecutor.id);

      throw new ExecutorNotReadyError(`Executor ${executor.id} is not ready`);
    }

    switch (imageExecutor.state) {
      case ImageExecutorState.PULLING_IMAGE:
        await this.handleImageExecutorStatePullingImage(imageExecutor);
        break;
      case ImageExecutorState.BUILDING_IMAGE:
        await this.handleImageExecutorStateBuildingImage(imageExecutor);
        break;
      case ImageExecutorState.REMOVING:
        await this.handleImageExecutorStateRemoving(imageExecutor);
        break;
    }
  }

  async propagateImageToExecutors(internalImageName: string) {
    //  todo: remove try catch block and implement error handling
    try {
      const executors = await this.executorRepository.find({
        where: {
          state: ExecutorState.READY,
          unschedulable: false,
        },
      });

      //  get all executors that have the image in their base image
      const imageExecutors = await this.imageExecutorRepository.find({
        where: {
          imageRef: internalImageName,
          state: In([ImageExecutorState.READY, ImageExecutorState.PULLING_IMAGE]),
        },
      });
      //  filter duplicate image executor records
      const imageExecutorsDistinctExecutorsIds = [
        ...new Set(imageExecutors.map((imageExecutor) => imageExecutor.executorId)),
      ];

      const propagateLimit =
        Math.ceil(executors.length / 3) - imageExecutorsDistinctExecutorsIds.length;
      const unallocatedExecutors = executors.filter(
        (executor) =>
          !imageExecutorsDistinctExecutorsIds.some(
            (imageExecutorId) => imageExecutorId === executor.id
          )
      );
      //  shuffle the executors to propagate to
      unallocatedExecutors.sort(() => Math.random() - 0.5);
      //  limit the number of executors to propagate to
      const executorsToPropagateTo = unallocatedExecutors.slice(0, propagateLimit);

      const results = await Promise.allSettled(
        executorsToPropagateTo.map(async (executor) => {
          let imageExecutor = await this.imageExecutorRepository.findOne({
            where: {
              imageRef: internalImageName,
              executorId: executor.id,
            },
          });

          try {
            if (imageExecutor && !imageExecutor.imageRef) {
              //  this should never happen
              this.logger.warn(
                `Internal image name not found for image executor ${imageExecutor.id}`
              );
              return;
            }

            if (!imageExecutor) {
              imageExecutor = new ImageExecutor();
              imageExecutor.imageRef = internalImageName;
              imageExecutor.executorId = executor.id;
              imageExecutor.state = ImageExecutorState.PULLING_IMAGE;
              await this.imageExecutorRepository.save(imageExecutor);
              await this.propagateImageToExecutor(internalImageName, executor);
            } else if (imageExecutor.state === ImageExecutorState.PULLING_IMAGE) {
              await this.handleImageExecutorStatePullingImage(imageExecutor);
            }
          } catch (err) {
            this.logger.error(
              `Error propagating image to executor ${executor.id}: ${fromAxiosError(err)}`
            );
            imageExecutor.state = ImageExecutorState.ERROR;
            imageExecutor.errorReason = err.message;
            await this.imageExecutorRepository.update(imageExecutor.id, imageExecutor);
          }
        })
      );

      results.forEach((result) => {
        if (result.status === "rejected") {
          this.logger.error(result.reason);
        }
      });
    } catch (err) {
      this.logger.error(err);
    }
  }

  async propagateImageToExecutor(internalImageName: string, executor: Executor) {
    let dockerRegistry =
      await this.dockerRegistryService.findOneByImageImageName(internalImageName);

    // If no registry found by image name, use the default internal registry
    if (!dockerRegistry) {
      dockerRegistry = await this.dockerRegistryService.getDefaultInternalRegistry();
      if (!dockerRegistry) {
        throw new Error("No registry found for image and no default internal registry configured");
      }
    }

    const executorAdapter = await this.executorAdapterFactory.create(executor);

    let retries = 0;
    while (retries < 10) {
      try {
        await executorAdapter.pullImage(internalImageName, dockerRegistry);
      } catch (err) {
        if (err.code !== "ECONNRESET") {
          throw err;
        }
      }
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retries * 1000));
    }
  }

  async handleImageExecutorStatePullingImage(imageExecutor: ImageExecutor) {
    const executor = await this.executorRepository.findOneOrFail({
      where: {
        id: imageExecutor.executorId,
      },
    });

    const executorAdapter = await this.executorAdapterFactory.create(executor);
    const exists = await executorAdapter.imageExists(imageExecutor.imageRef);
    if (exists) {
      imageExecutor.state = ImageExecutorState.READY;
      await this.imageExecutorRepository.save(imageExecutor);
      return;
    }

    const timeoutMinutes = 60;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    if (Date.now() - imageExecutor.createdAt.getTime() > timeoutMs) {
      imageExecutor.state = ImageExecutorState.ERROR;
      imageExecutor.errorReason = "Timeout while pulling image";
      await this.imageExecutorRepository.save(imageExecutor);
      return;
    }

    const retryTimeoutMinutes = 10;
    const retryTimeoutMs = retryTimeoutMinutes * 60 * 1000;
    if (Date.now() - imageExecutor.createdAt.getTime() > retryTimeoutMs) {
      await this.retryImageExecutorPull(imageExecutor);
      return;
    }
  }

  async handleImageExecutorStateBuildingImage(imageExecutor: ImageExecutor) {
    const executor = await this.executorRepository.findOneOrFail({
      where: {
        id: imageExecutor.executorId,
      },
    });

    const executorAdapter = await this.executorAdapterFactory.create(executor);
    const exists = await executorAdapter.imageExists(imageExecutor.imageRef);
    if (exists) {
      imageExecutor.state = ImageExecutorState.READY;
      await this.imageExecutorRepository.save(imageExecutor);
      return;
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async checkImageCleanup() {
    const lockKey = "check-image-cleanup-lock";
    if (!(await this.redisLockProvider.lock(lockKey, 30))) {
      return;
    }

    //  get all images
    const images = await this.imageRepository.find({
      where: {
        state: ImageState.REMOVING,
      },
    });

    await Promise.all(
      images.map(async (image) => {
        const countActiveImages = await this.imageRepository.count({
          where: {
            state: ImageState.ACTIVE,
            internalName: image.internalName,
          },
        });

        // Only remove image executors if no other images depend on them
        if (countActiveImages === 0) {
          await this.imageExecutorRepository.update(
            {
              imageRef: image.internalName,
            },
            {
              state: ImageExecutorState.REMOVING,
            }
          );
        }

        await this.imageRepository.remove(image);
      })
    );

    await this.redisLockProvider.unlock(lockKey);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async checkImageState() {
    //  the first time the image is created it needs to be validated and pushed to the internal registry
    //  before propagating to the executors
    //  this cron job will process the image states until the image is active (or error)

    //  get all images
    const images = await this.imageRepository.find({
      where: {
        state: Not(
          In([ImageState.ACTIVE, ImageState.ERROR, ImageState.BUILD_FAILED, ImageState.INACTIVE])
        ),
      },
    });

    await Promise.all(
      images.map(async (image) => {
        const lockKey = `check-image-state-lock-${image.id}`;
        if (!(await this.redisLockProvider.lock(lockKey, 720))) {
          return;
        }

        try {
          switch (image.state) {
            case ImageState.BUILD_PENDING:
              await this.handleImageStateBuildPending(image);
              break;
            case ImageState.BUILDING:
              await this.handleImageStateBuilding(image);
              break;
            case ImageState.PENDING:
              await this.handleImageStatePending(image);
              break;
            case ImageState.PULLING:
              await this.handleImageStatePulling(image);
              break;
            case ImageState.PENDING_VALIDATION:
              //  temp workaround to avoid race condition between api instances
              {
                let imageName = image.imageName;
                if (image.buildInfo) {
                  imageName = image.internalName;
                }
                if (!(await this.dockerProvider.imageExists(imageName))) {
                  await this.redisLockProvider.unlock(lockKey);
                  return;
                }
              }

              await this.handleImageStatePendingValidation(image);
              break;
            case ImageState.VALIDATING:
              await this.handleImageStateValidating(image);
              break;
            case ImageState.REMOVING:
              await this.handleImageStateRemoving(image);
              break;
          }
        } catch (error) {
          if (error.code === "ECONNRESET") {
            await this.redisLockProvider.unlock(lockKey);
            this.checkImageState();
            return;
          }

          const message = error.message || String(error);
          await this.updateImageState(image.id, ImageState.ERROR, message);
        }

        await this.redisLockProvider.unlock(lockKey);
      })
    );
  }

  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: "cleanup-local-images",
  })
  async cleanupLocalImages() {
    await this.dockerProvider.imagePrune();
  }

  async removeImageFromExecutor(executor: Executor, imageExecutor: ImageExecutor) {
    if (imageExecutor && !imageExecutor.imageRef) {
      //  this should never happen
      this.logger.warn(`Internal image name not found for image executor ${imageExecutor.id}`);
      return;
    }

    const executorAdapter = await this.executorAdapterFactory.create(executor);
    const exists = await executorAdapter.imageExists(imageExecutor.imageRef);
    if (exists) {
      await executorAdapter.removeImage(imageExecutor.imageRef);
    }

    imageExecutor.state = ImageExecutorState.REMOVING;
    await this.imageExecutorRepository.save(imageExecutor);
  }

  async handleImageExecutorStateRemoving(imageExecutor: ImageExecutor) {
    const executor = await this.executorRepository.findOne({
      where: {
        id: imageExecutor.executorId,
      },
    });
    if (!executor) {
      //  generally this should not happen
      //  in case the executor has been deleted from the database, delete the image executor record
      const errorMessage = `Executor not found while trying to remove image ${imageExecutor.imageRef} from executor ${imageExecutor.executorId}`;
      this.logger.warn(errorMessage);

      this.imageExecutorRepository.delete(imageExecutor.id).catch((err) => {
        this.logger.error(fromAxiosError(err));
      });
      return;
    }
    if (!imageExecutor.imageRef) {
      //  this should never happen
      //  remove the image executor record (it will be recreated again by the image propagation job)
      this.logger.warn(`Internal image name not found for image executor ${imageExecutor.id}`);
      this.imageExecutorRepository.delete(imageExecutor.id).catch((err) => {
        this.logger.error(fromAxiosError(err));
      });
      return;
    }

    const executorAdapter = await this.executorAdapterFactory.create(executor);
    const exists = await executorAdapter.imageExists(imageExecutor.imageRef);
    if (!exists) {
      await this.imageExecutorRepository.delete(imageExecutor.id);
    } else {
      //  just in case the image is still there
      executorAdapter.removeImage(imageExecutor.imageRef).catch((err) => {
        //  this should not happen, and is not critical
        //  if the executor can not remote the image, just delete the executor record
        this.imageExecutorRepository.delete(imageExecutor.id).catch((err) => {
          this.logger.error(fromAxiosError(err));
        });
        //  and log the error for tracking
        const errorMessage = `Failed to do just in case remove image ${imageExecutor.imageRef} from executor ${executor.id}: ${fromAxiosError(err)}`;
        this.logger.warn(errorMessage);
      });
    }
  }

  async handleImageStateRemoving(image: Image) {
    const imageExecutorItems = await this.imageExecutorRepository.find({
      where: {
        imageRef: image.internalName,
      },
    });

    if (imageExecutorItems.length === 0) {
      await this.imageRepository.remove(image);
    }
  }

  async handleImageStateBuildPending(image: Image) {
    await this.updateImageState(image.id, ImageState.BUILDING);
  }

  async handleImageStateBuilding(image: Image) {
    // Check if build has timed out
    const timeoutMinutes = 30;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    if (Date.now() - image.createdAt.getTime() > timeoutMs) {
      await this.updateImageState(
        image.id,
        ImageState.BUILD_FAILED,
        "Timeout while building image"
      );
      return;
    }

    // Get build info
    if (!image.buildInfo) {
      await this.updateImageState(image.id, ImageState.BUILD_FAILED, "Missing build information");
      return;
    }

    try {
      const excludedExecutorIds =
        await this.executorService.getExecutorsWithMultipleImagesBuilding();

      // Find a executor to build the image on
      const executor = await this.executorService.getRandomAvailableExecutor({
        excludedExecutorIds: excludedExecutorIds,
      });

      // TODO: get only executors where the base image is available (extract from buildInfo)

      if (!executor) {
        // No ready executors available, retry later
        return;
      }

      // Assign the executor ID to the image for tracking build progress
      image.buildExecutorId = executor.id;
      await this.imageRepository.save(image);

      const registry = await this.dockerRegistryService.getDefaultInternalRegistry();

      const executorAdapter = await this.executorAdapterFactory.create(executor);

      await executorAdapter.buildImage(image.buildInfo, image.organizationId, registry, true);

      // save imageExecutor

      const internalImageName = `${registry.url}/${registry.project}/${image.buildInfo.imageRef}`;

      image.internalName = internalImageName;
      await this.imageRepository.save(image);

      // Wait for 30 seconds because of Harbor's delay at making newly created images available
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Move to next state
      await this.updateImageState(image.id, ImageState.PENDING);
    } catch (err) {
      if (err.code === "ECONNRESET") {
        // Connection reset, retry later
        return;
      }

      this.logger.error(`Error building image ${image.name}: ${fromAxiosError(err)}`);
      await this.updateImageState(image.id, ImageState.BUILD_FAILED, fromAxiosError(err).message);
    }
  }

  async handleImageStatePending(image: Image) {
    let dockerRegistry: Registry;

    await this.updateImageState(image.id, ImageState.PULLING);

    let localImageName = image.imageName;

    if (image.buildInfo) {
      //  get the default internal registry
      dockerRegistry = await this.dockerRegistryService.getDefaultInternalRegistry();
      localImageName = image.internalName;
    } else {
      //  find docker registry based on image name and organization id
      dockerRegistry = await this.dockerRegistryService.findOneByImageImageName(
        image.imageName,
        image.organizationId
      );
    }

    // Use the dockerRegistry for pulling the image
    await this.dockerProvider.pullImage(localImageName, dockerRegistry);
  }

  async handleImageStatePulling(image: Image) {
    const localImageName = image.buildInfo ? image.internalName : image.imageName;
    // Check timeout first
    const timeoutMinutes = 15;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    if (Date.now() - image.createdAt.getTime() > timeoutMs) {
      await this.updateImageState(image.id, ImageState.ERROR, "Timeout while pulling image");
      return;
    }

    const exists = await this.dockerProvider.imageExists(localImageName);
    if (!exists) {
      //  retry until the image exists (or eventually timeout)
      return;
    }

    //  sleep for 30 seconds
    //  workaround for docker image not being ready, but exists
    await new Promise((resolve) => setTimeout(resolve, 30000));

    //  get the organization
    const organization = await this.organizationService.findOne(image.organizationId);
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${image.organizationId} not found`);
    }

    // Check image size
    const imageInfo = await this.dockerProvider.getImageInfo(localImageName);
    const MAX_SIZE_GB = organization.maxImageSize;

    if (imageInfo.sizeGB > MAX_SIZE_GB) {
      await this.updateImageState(
        image.id,
        ImageState.ERROR,
        `Image size (${imageInfo.sizeGB.toFixed(2)}GB) exceeds maximum allowed size of ${MAX_SIZE_GB}GB`
      );
      return;
    }

    image.size = imageInfo.sizeGB;
    image.state = ImageState.PENDING_VALIDATION;

    // Ensure entrypoint is set
    if (!image.entrypoint) {
      if (imageInfo.entrypoint) {
        if (Array.isArray(imageInfo.entrypoint)) {
          image.entrypoint = imageInfo.entrypoint;
        } else {
          image.entrypoint = [imageInfo.entrypoint];
        }
      } else {
        image.entrypoint = ["sleep", "infinity"];
      }
    }

    await this.imageRepository.save(image);
  }

  async handleImageStatePendingValidation(image: Image) {
    try {
      await this.updateImageState(image.id, ImageState.VALIDATING);

      await this.validateImageRuntime(image.id);

      if (!image.buildInfo) {
        // Images that have gone through the build process are already in the internal registry
        const internalImageName = await this.pushImageToInternalRegistry(image.id);
        image.internalName = internalImageName;
      }
      const executor = await this.executorRepository.findOne({
        where: {
          state: ExecutorState.READY,
          unschedulable: Not(true),
          used: Raw((alias) => `${alias} < capacity`),
        },
      });
      // Propagate image to one executor so it can be used immediately
      if (executor) {
        await this.propagateImageToExecutor(image.internalName, executor);
      }
      await this.updateImageState(image.id, ImageState.ACTIVE);

      // Best effort removal of old image from transient registry
      const registry = await this.dockerRegistryService.findOneByImageImageName(
        image.imageName,
        image.organizationId
      );
      if (registry && registry.registryType === RegistryType.TRANSIENT) {
        try {
          await this.dockerRegistryService.removeImage(image.imageName, registry.id);
        } catch (error) {
          if (error.statusCode === 404) {
            //  image not found, just return
            return;
          }
          this.logger.error("Failed to remove old image:", fromAxiosError(error));
        }
      }
    } catch (error) {
      // workaround when app executors don't use a single docker host instance
      if (error.statusCode === 404 || error.message?.toLowerCase().includes("no such image")) {
        return;
      }
      await this.updateImageState(image.id, ImageState.ERROR, error.message);
    }
  }

  async handleImageStateValidating(image: Image) {
    //  check the timeout
    const timeoutMinutes = 10;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    if (Date.now() - image.createdAt.getTime() > timeoutMs) {
      await this.updateImageState(image.id, ImageState.ERROR, "Timeout while validating image");
      return;
    }
  }

  async validateImageRuntime(imageId: string): Promise<void> {
    const image = await this.imageRepository.findOneOrFail({
      where: {
        id: imageId,
      },
    });

    let containerId: string | null = null;

    try {
      const localImageName = image.buildInfo ? image.internalName : image.imageName;

      // Create and start the container
      containerId = await this.dockerProvider.create(localImageName, image.entrypoint);

      // Wait for 1 minute while checking container state
      const startTime = Date.now();
      const checkDuration = 60 * 1000; // 1 minute in milliseconds

      while (Date.now() - startTime < checkDuration) {
        const isRunning = await this.dockerProvider.isRunning(containerId);
        if (!isRunning) {
          throw new Error("Container exited");
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      this.logger.debug("Error validating image runtime:", error);
      throw error;
    } finally {
      // Cleanup: Destroy the container
      if (containerId) {
        try {
          await this.dockerProvider.remove(containerId);
        } catch (cleanupError) {
          this.logger.error("Error cleaning up container:", fromAxiosError(cleanupError));
        }
      }
    }
  }

  async pushImageToInternalRegistry(imageId: string): Promise<string> {
    const image = await this.imageRepository.findOneOrFail({
      where: {
        id: imageId,
      },
    });

    const registry = await this.dockerRegistryService.getDefaultInternalRegistry();
    if (!registry) {
      throw new Error("No default internal registry configured");
    }

    //  get tag from image name
    const tag = image.imageName.split(":")[1];
    const internalImageName = `${registry.url.replace(/^(https?:\/\/)/, "")}/${registry.project}/${image.id}:${tag}`;

    image.internalName = internalImageName;
    await this.imageRepository.save(image);

    // Tag the image with the internal registry name
    await this.dockerProvider.tagImage(image.imageName, internalImageName);

    // Push the newly tagged image
    await this.dockerProvider.pushImage(internalImageName, registry);

    return internalImageName;
  }

  async retryImageExecutorPull(imageExecutor: ImageExecutor) {
    const executor = await this.executorRepository.findOneOrFail({
      where: {
        id: imageExecutor.executorId,
      },
    });

    const executorAdapter = await this.executorAdapterFactory.create(executor);

    const dockerRegistry = await this.dockerRegistryService.getDefaultInternalRegistry();
    //  await this.redis.setex(lockKey, 360, this.instanceId)

    await executorAdapter.pullImage(imageExecutor.imageRef, dockerRegistry);
  }

  private async updateImageState(imageId: string, state: ImageState, errorReason?: string) {
    const image = await this.imageRepository.findOneOrFail({
      where: {
        id: imageId,
      },
    });
    image.state = state;
    if (errorReason) {
      image.errorReason = errorReason;
    }
    await this.imageRepository.save(image);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldBuildInfoImageExecutors() {
    const lockKey = "cleanup-old-buildinfo-images-lock";
    if (!(await this.redisLockProvider.lock(lockKey, 300))) {
      return;
    }

    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Find all BuildInfo entities that haven't been used in over a day
      const oldBuildInfos = await this.buildInfoRepository.find({
        where: {
          lastUsedAt: LessThan(oneDayAgo),
        },
      });

      if (oldBuildInfos.length === 0) {
        return;
      }

      const imageRefs = oldBuildInfos.map((buildInfo) => buildInfo.imageRef);

      const result = await this.imageExecutorRepository.update(
        { imageRef: In(imageRefs) },
        { state: ImageExecutorState.REMOVING }
      );

      if (result.affected > 0) {
        this.logger.debug(
          `Marked ${result.affected} ImageExecutors for removal due to unused BuildInfo`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to mark old BuildInfo ImageExecutors for removal: ${fromAxiosError(error)}`
      );
    } finally {
      await this.redisLockProvider.unlock(lockKey);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async deactivateOldImages() {
    const lockKey = "deactivate-old-images-lock";
    if (!(await this.redisLockProvider.lock(lockKey, 300))) {
      return;
    }

    try {
      const twoWeeksAgo = new Date(Date.now() - 14 * 1000 * 60 * 60 * 24);

      const oldImages = await this.imageRepository
        .createQueryBuilder("image")
        .where("image.general = false")
        .andWhere("image.state = :imageState", { imageState: ImageState.ACTIVE })
        .andWhere('(image."lastUsedAt" IS NULL OR image."lastUsedAt" < :twoWeeksAgo)', {
          twoWeeksAgo,
        })
        .andWhere('image."createdAt" < :twoWeeksAgo', { twoWeeksAgo })
        .andWhere(
          () => {
            const query = this.imageRepository
              .createQueryBuilder("s")
              .select("1")
              .where('s."internalName" = image."internalName"')
              .andWhere("s.state = :activeState")
              .andWhere('(s."lastUsedAt" >= :twoWeeksAgo OR s."createdAt" >= :twoWeeksAgo)');

            return `NOT EXISTS (${query.getQuery()})`;
          },
          {
            activeState: ImageState.ACTIVE,
            twoWeeksAgo,
          }
        )
        .take(100)
        .getMany();

      if (oldImages.length === 0) {
        return;
      }

      // Deactivate the images
      const imageIds = oldImages.map((image) => image.id);
      await this.imageRepository.update({ id: In(imageIds) }, { state: ImageState.INACTIVE });

      // Get internal names of deactivated images
      const internalNames = oldImages.map((image) => image.internalName).filter((name) => name); // Filter out null/undefined values

      if (internalNames.length > 0) {
        // Set associated ImageExecutor records to REMOVING state
        const result = await this.imageExecutorRepository.update(
          { imageRef: In(internalNames) },
          { state: ImageExecutorState.REMOVING }
        );

        this.logger.debug(
          `Deactivated ${oldImages.length} images and marked ${result.affected} ImageExecutors for removal`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to deactivate old images: ${fromAxiosError(error)}`);
    } finally {
      await this.redisLockProvider.unlock(lockKey);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupInactiveImagesFromExecutors() {
    const lockKey = "cleanup-inactive-images-from-executors-lock";
    if (!(await this.redisLockProvider.lock(lockKey, 300))) {
      return;
    }

    try {
      // Only fetch inactive images that have associated image executor entries
      const queryResult = await this.imageRepository
        .createQueryBuilder("image")
        .select('image."internalName"')
        .where("image.state = :imageState", { imageState: ImageState.INACTIVE })
        .andWhere('image."internalName" IS NOT NULL')
        .andWhereExists(
          this.imageExecutorRepository
            .createQueryBuilder("image_executor")
            .select("1")
            .where('image_executor."imageRef" = image."internalName"')
            .andWhere("image_executor.state != :imageExecutorState", {
              imageExecutorState: ImageExecutorState.REMOVING,
            })
        )
        .andWhere(
          () => {
            const query = this.imageRepository
              .createQueryBuilder("s")
              .select("1")
              .where('s."internalName" = image."internalName"')
              .andWhere("s.state = :imageState");
            return `NOT EXISTS (${query.getQuery()})`;
          },
          {
            imageState: ImageState.ACTIVE,
          }
        )
        .take(100)
        .getRawMany();

      const inactiveImageInternalNames = queryResult.map((result) => result.internalName);

      if (inactiveImageInternalNames.length > 0) {
        // Set associated ImageExecutor records to REMOVING state
        const result = await this.imageExecutorRepository.update(
          { imageRef: In(inactiveImageInternalNames) },
          { state: ImageExecutorState.REMOVING }
        );

        this.logger.debug(`Marked ${result.affected} ImageExecutors for removal`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup inactive images from executors: ${fromAxiosError(error)}`
      );
    } finally {
      await this.redisLockProvider.unlock(lockKey);
    }
  }
}
