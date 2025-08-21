import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { Sandbox } from "../../entities/sandbox.entity";
import { SandboxState } from "../../enums/sandbox-state.enum";
import { DONT_SYNC_AGAIN, SandboxAction, SYNC_AGAIN, SyncState } from "./sandbox.action";
import { ImageExecutorState } from "../../enums/image-executor-state.enum";
import { BackupState } from "../../enums/backup-state.enum";
import { ExecutorState } from "../../enums/executor-state.enum";
import { DockerProvider } from "../../docker/docker-provider";
import { BuildInfo } from "../../entities/build-info.entity";
import { ImageService } from "../../services/image.service";
import { RegistryService } from "../../../registry/registry.service";
import { Registry } from "../../../registry/entities/registry.entity";
import { ExecutorService } from "../../services/executor.service";
import { ExecutorAdapterFactory } from "../../adapter/adapter";
import { ToolboxService } from "../../services/toolbox.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Image } from "../../entities/image.entity";

@Injectable()
export class SandboxStartAction extends SandboxAction {
  protected readonly logger = new Logger(SandboxStartAction.name);
  constructor(
    protected executorService: ExecutorService,
    protected executorAdapterFactory: ExecutorAdapterFactory,
    @InjectRepository(Sandbox)
    protected sandboxRepository: Repository<Sandbox>,
    protected toolboxService: ToolboxService,
    protected readonly dockerProvider: DockerProvider,
    protected readonly imageService: ImageService,
    protected readonly dockerRegistryService: RegistryService
  ) {
    super(executorService, executorAdapterFactory, sandboxRepository, toolboxService);
  }

  async run(sandbox: Sandbox): Promise<SyncState> {
    switch (sandbox.state) {
      case SandboxState.PENDING_BUILD: {
        return this.handleUnassignedBuildSandbox(sandbox);
      }
      case SandboxState.BUILDING_IMAGE: {
        return this.handleExecutorSandboxBuildingImageStateOnDesiredStateStart(sandbox);
      }
      case SandboxState.UNKNOWN: {
        return this.handleExecutorSandboxUnknownStateOnDesiredStateStart(sandbox);
      }
      case SandboxState.ARCHIVED:
      case SandboxState.STOPPED: {
        return this.handleExecutorSandboxStoppedOrArchivedStateOnDesiredStateStart(sandbox);
      }
      case SandboxState.RESTORING:
      case SandboxState.CREATING: {
        return this.handleExecutorSandboxPullingImageStateCheck(sandbox);
      }
      case SandboxState.PULLING_IMAGE:
      case SandboxState.STARTING: {
        return this.handleExecutorSandboxStartedStateCheck(sandbox);
      }
      case SandboxState.ERROR: {
        const executor = await this.executorService.findOne(sandbox.executorId);
        const executorAdapter = await this.executorAdapterFactory.create(executor);

        const sandboxInfo = await executorAdapter.sandboxInfo(sandbox.id);
        if (sandboxInfo.state === SandboxState.STARTED) {
          const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
            id: sandbox.id,
          });
          sandboxToUpdate.state = SandboxState.STARTED;
          sandboxToUpdate.backupState = BackupState.NONE;

          try {
            const nodeVersion = await executorAdapter.getSandboxDaemonVersion(sandbox.id);
            sandboxToUpdate.nodeVersion = nodeVersion;
          } catch (error) {
            this.logger.error(
              `Failed to get sandbox node version for sandbox ${sandbox.id}:`,
              error
            );
          }

          await this.sandboxRepository.save(sandboxToUpdate);
        }
      }
    }

    return DONT_SYNC_AGAIN;
  }

  private async handleUnassignedBuildSandbox(sandbox: Sandbox): Promise<SyncState> {
    // Try to assign an available executor with the image build
    let executorId: string;
    try {
      const executor = await this.executorService.getRandomAvailableExecutor({
        region: sandbox.region,
        sandboxClass: sandbox.class,
        imageRef: sandbox.buildInfo.imageRef,
      });
      executorId = executor.id;
    } catch (error) {
      // Continue to next assignment method
    }

    if (executorId) {
      await this.updateSandboxState(sandbox.id, SandboxState.UNKNOWN, executorId);
      return SYNC_AGAIN;
    }

    // Try to assign an available executor that is currently building the image
    const imageExecutors = await this.executorService.getImageExecutors(sandbox.buildInfo.imageRef);

    for (const imageExecutor of imageExecutors) {
      const executor = await this.executorService.findOne(imageExecutor.executorId);
      if (executor.used < executor.capacity) {
        if (imageExecutor.state === ImageExecutorState.BUILDING_IMAGE) {
          await this.updateSandboxState(sandbox.id, SandboxState.BUILDING_IMAGE, executor.id);
          return SYNC_AGAIN;
        }
        if (imageExecutor.state === ImageExecutorState.ERROR) {
          await this.updateSandboxState(
            sandbox.id,
            SandboxState.BUILD_FAILED,
            undefined,
            imageExecutor.errorReason
          );
          return DONT_SYNC_AGAIN;
        }
      }
    }

    const excludedExecutorIds = await this.executorService.getExecutorsWithMultipleImagesBuilding();

    // Try to assign a new available executor
    const executor = await this.executorService.getRandomAvailableExecutor({
      region: sandbox.region,
      sandboxClass: sandbox.class,
      excludedExecutorIds: excludedExecutorIds,
    });
    executorId = executor.id;

    this.buildOnExecutor(sandbox.buildInfo, executorId, sandbox.organizationId);

    await this.updateSandboxState(sandbox.id, SandboxState.BUILDING_IMAGE, executorId);
    await this.executorService.recalculateExecutorUsage(executorId);
    return SYNC_AGAIN;
  }

  private async handleExecutorSandboxBuildingImageStateOnDesiredStateStart(
    sandbox: Sandbox
  ): Promise<SyncState> {
    const imageExecutor = await this.executorService.getImageExecutor(
      sandbox.executorId,
      sandbox.buildInfo.imageRef
    );
    if (imageExecutor) {
      switch (imageExecutor.state) {
        case ImageExecutorState.READY: {
          // TODO: "UNKNOWN" should probably be changed to something else
          await this.updateSandboxState(sandbox.id, SandboxState.UNKNOWN);
          return SYNC_AGAIN;
        }
        case ImageExecutorState.ERROR: {
          await this.updateSandboxState(
            sandbox.id,
            SandboxState.BUILD_FAILED,
            undefined,
            imageExecutor.errorReason
          );
          return DONT_SYNC_AGAIN;
        }
      }
    }
    if (!imageExecutor || imageExecutor.state === ImageExecutorState.BUILDING_IMAGE) {
      // Sleep for a second and go back to syncing instance state
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return SYNC_AGAIN;
    }

    return DONT_SYNC_AGAIN;
  }

  private async handleExecutorSandboxUnknownStateOnDesiredStateStart(
    sandbox: Sandbox
  ): Promise<SyncState> {
    const executor = await this.executorService.findOne(sandbox.executorId);
    if (executor.state !== ExecutorState.READY) {
      return DONT_SYNC_AGAIN;
    }

    const executorAdapter = await this.executorAdapterFactory.create(executor);

    let registry: Registry;
    let entrypoint: string[];
    if (!sandbox.buildInfo) {
      //  get internal image name
      const image = await this.imageService.getImageByName(sandbox.image, sandbox.organizationId);
      const internalImageName = image.internalName;

      registry = await this.dockerRegistryService.findOneByImageImageName(
        internalImageName,
        sandbox.organizationId
      );
      if (!registry) {
        throw new Error("No registry found for image");
      }

      sandbox.image = internalImageName;
      entrypoint = image.entrypoint;
    } else {
      sandbox.image = sandbox.buildInfo.imageRef;
      entrypoint = this.getEntrypointFromDockerfile(sandbox.buildInfo.dockerfileContent);
    }

    await executorAdapter.createSandbox(sandbox, registry, entrypoint);

    await this.updateSandboxState(sandbox.id, SandboxState.CREATING);
    //  sync states again immediately for sandbox
    return SYNC_AGAIN;
  }

  private async handleExecutorSandboxStoppedOrArchivedStateOnDesiredStateStart(
    sandbox: Sandbox
  ): Promise<SyncState> {
    //  check if sandbox is assigned to a executor and if that executor is unschedulable
    //  if it is, move sandbox to prevExecutorId, and set executorId to null
    //  this will assign a new executor to the sandbox and restore the sandbox from the latest backup
    if (sandbox.executorId) {
      const executor = await this.executorService.findOne(sandbox.executorId);
      const originalExecutorId = sandbox.executorId; // Store original value

      // if the executor is unschedulable/not ready and sandbox has a valid backup, move sandbox to a new executor
      if (
        (executor.unschedulable || executor.state !== ExecutorState.READY) &&
        sandbox.backupState === BackupState.COMPLETED
      ) {
        sandbox.prevExecutorId = originalExecutorId;
        sandbox.executorId = null;

        const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
          id: sandbox.id,
        });
        sandboxToUpdate.prevExecutorId = originalExecutorId;
        sandboxToUpdate.executorId = null;
        await this.sandboxRepository.save(sandboxToUpdate);
      }

      // If the sandbox is on a executor and its backupState is COMPLETED
      // but there are too many running sandboxes on that executor, move it to a less used executor
      if (sandbox.backupState === BackupState.COMPLETED) {
        const usageThreshold = 35;
        const runningSandboxsCount = await this.sandboxRepository.count({
          where: {
            executorId: originalExecutorId,
            state: SandboxState.STARTED,
          },
        });
        if (runningSandboxsCount > usageThreshold) {
          //  TODO: usage should be based on compute usage

          const availableExecutors = await this.executorService.findAvailableExecutors({
            region: sandbox.region,
            sandboxClass: sandbox.class,
          });
          const lessUsedExecutors = availableExecutors.filter(
            (executor) => executor.id !== originalExecutorId
          );

          //  temp workaround to move sandboxes to less used executor
          if (lessUsedExecutors.length > 0) {
            await this.sandboxRepository.update(sandbox.id, {
              executorId: null,
              prevExecutorId: originalExecutorId,
            });
            try {
              const executorAdapter = await this.executorAdapterFactory.create(executor);
              await executorAdapter.removeDestroyedSandbox(sandbox.id);
            } catch (e) {
              this.logger.error(
                `Failed to cleanup sandbox ${sandbox.id} on previous executor ${executor.id}:`,
                e
              );
            }
            sandbox.prevExecutorId = originalExecutorId;
            sandbox.executorId = null;
          }
        }
      }
    }

    if (sandbox.executorId === null) {
      //  if sandbox has no executor, check if backup is completed
      //  if not, set sandbox to error
      //  if backup is completed, get random available executor and start sandbox
      //  use the backup to start the sandbox

      if (sandbox.backupState !== BackupState.COMPLETED) {
        await this.updateSandboxState(
          sandbox.id,
          SandboxState.ERROR,
          undefined,
          "Sandbox has no executor and backup is not completed"
        );
        return DONT_SYNC_AGAIN;
      }

      const registry = await this.dockerRegistryService.findOne(sandbox.backupRegistryId);
      if (!registry) {
        throw new Error("No registry found for backup");
      }

      const existingBackups = sandbox.existingBackupImages.map(
        (existingImage) => existingImage.imageName
      );
      let validBackup;
      let exists = false;

      while (existingBackups.length > 0) {
        try {
          if (!validBackup) {
            //  last image is the current image, so we don't need to check it
            //  just in case, we'll use the value from the backupImage property
            validBackup = sandbox.backupImage;
            existingBackups.pop();
          } else {
            validBackup = existingBackups.pop();
          }
          if (await this.dockerProvider.checkImageExistsInRegistry(validBackup, registry)) {
            exists = true;
            break;
          }
        } catch (error) {
          this.logger.error(
            `Failed to check if backup image ${sandbox.backupImage} exists in registry ${registry.id}:`,
            error
          );
        }
      }

      if (!exists) {
        await this.updateSandboxState(
          sandbox.id,
          SandboxState.ERROR,
          undefined,
          "No valid backup image found"
        );
        return SYNC_AGAIN;
      }

      //  make sure we pick a executor that has the base image
      let baseImage: Image | null = null;
      try {
        baseImage = await this.imageService.getImageByName(sandbox.image, sandbox.organizationId);
      } catch (e) {
        if (e instanceof NotFoundException) {
          //  if the base image is not found, we'll use any available executor later
        } else {
          //  for all other errors, throw them
          throw e;
        }
      }

      const imageRef = baseImage ? baseImage.internalName : null;

      let availableExecutors = [];
      const executorsWithBaseImage = await this.executorService.findAvailableExecutors({
        region: sandbox.region,
        sandboxClass: sandbox.class,
        imageRef,
      });
      if (executorsWithBaseImage.length > 0) {
        availableExecutors = executorsWithBaseImage;
      } else {
        //  if no executor has the base image, get all available executors
        availableExecutors = await this.executorService.findAvailableExecutors({
          region: sandbox.region,
          sandboxClass: sandbox.class,
        });
      }

      //  check if we have any available executors after filtering
      if (availableExecutors.length === 0) {
        await this.updateSandboxState(
          sandbox.id,
          SandboxState.ERROR,
          undefined,
          "No available executors found for sandbox restoration"
        );
        return DONT_SYNC_AGAIN;
      }

      //  get random executor from available executors
      const randomExecutorIndex = (min: number, max: number) =>
        Math.floor(Math.random() * (max - min + 1) + min);
      const executorId =
        availableExecutors[randomExecutorIndex(0, availableExecutors.length - 1)].id;

      const executor = await this.executorService.findOne(executorId);

      //  verify the executor is still available and ready
      if (
        !executor ||
        executor.state !== ExecutorState.READY ||
        executor.unschedulable ||
        executor.used >= executor.capacity
      ) {
        this.logger.warn(
          `Selected executor ${executorId} is no longer available, retrying sandbox assignment`
        );
        return SYNC_AGAIN;
      }

      const executorAdapter = await this.executorAdapterFactory.create(executor);

      await this.updateSandboxState(sandbox.id, SandboxState.RESTORING, executorId);

      sandbox.image = validBackup;
      await executorAdapter.createSandbox(sandbox, registry);
    } else {
      // if sandbox has executor, start sandbox
      const executor = await this.executorService.findOne(sandbox.executorId);
      const executorAdapter = await this.executorAdapterFactory.create(executor);

      await executorAdapter.startSandbox(sandbox.id);

      await this.updateSandboxState(sandbox.id, SandboxState.STARTING);

      return SYNC_AGAIN;
    }

    return SYNC_AGAIN;
  }

  //  used to check if sandbox is pulling image on executor and update sandbox state accordingly
  private async handleExecutorSandboxPullingImageStateCheck(sandbox: Sandbox): Promise<SyncState> {
    //  edge case when sandbox is being transferred to a new executor
    if (!sandbox.executorId) {
      return SYNC_AGAIN;
    }

    const executor = await this.executorService.findOne(sandbox.executorId);
    const executorAdapter = await this.executorAdapterFactory.create(executor);
    const sandboxInfo = await executorAdapter.sandboxInfo(sandbox.id);

    if (sandboxInfo.state === SandboxState.PULLING_IMAGE) {
      await this.updateSandboxState(sandbox.id, SandboxState.PULLING_IMAGE);
    } else if (sandboxInfo.state === SandboxState.ERROR) {
      await this.updateSandboxState(sandbox.id, SandboxState.ERROR);
    } else {
      await this.updateSandboxState(sandbox.id, SandboxState.STARTING);
    }

    return SYNC_AGAIN;
  }

  //  used to check if sandbox is started on executor and update sandbox state accordingly
  //  also used to handle the case where a sandbox is started on a executor and then transferred to a new executor
  private async handleExecutorSandboxStartedStateCheck(sandbox: Sandbox): Promise<SyncState> {
    const executor = await this.executorService.findOne(sandbox.executorId);
    const executorAdapter = await this.executorAdapterFactory.create(executor);
    const sandboxInfo = await executorAdapter.sandboxInfo(sandbox.id);

    switch (sandboxInfo.state) {
      case SandboxState.STARTED: {
        let nodeVersion: string | undefined;
        try {
          nodeVersion = await executorAdapter.getSandboxDaemonVersion(sandbox.id);
        } catch (error) {
          this.logger.error(`Failed to get sandbox node version for sandbox ${sandbox.id}:`, error);
        }

        //  if previous backup state is error or completed, set backup state to none
        if ([BackupState.ERROR, BackupState.COMPLETED].includes(sandbox.backupState)) {
          sandbox.backupState = BackupState.NONE;

          const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
            id: sandbox.id,
          });
          sandboxToUpdate.state = SandboxState.STARTED;
          sandboxToUpdate.backupState = BackupState.NONE;
          if (nodeVersion) {
            sandboxToUpdate.nodeVersion = nodeVersion;
          }
          await this.sandboxRepository.save(sandboxToUpdate);
        } else {
          await this.updateSandboxState(
            sandbox.id,
            SandboxState.STARTED,
            undefined,
            undefined,
            nodeVersion
          );
        }

        //  if sandbox was transferred to a new executor, remove it from the old executor
        if (sandbox.prevExecutorId) {
          const executor = await this.executorService.findOne(sandbox.prevExecutorId);
          if (!executor) {
            this.logger.warn(
              `Previously assigned executor ${sandbox.prevExecutorId} for sandbox ${sandbox.id} not found`
            );
            //  clear prevExecutorId to avoid trying to cleanup on a non-existent executor
            sandbox.prevExecutorId = null;

            const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
              id: sandbox.id,
            });
            sandboxToUpdate.prevExecutorId = null;
            await this.sandboxRepository.save(sandboxToUpdate);
            break;
          }

          const executorAdapter = await this.executorAdapterFactory.create(executor);

          try {
            // First try to destroy the sandbox
            await executorAdapter.destroySandbox(sandbox.id);

            // Wait for sandbox to be destroyed before removing
            let retries = 0;
            while (retries < 10) {
              try {
                const sandboxInfo = await executorAdapter.sandboxInfo(sandbox.id);
                if (sandboxInfo.state === SandboxState.DESTROYED) {
                  break;
                }
              } catch (e) {
                if (e.response?.status === 404) {
                  break; // Sandbox already gone
                }
                throw e;
              }
              await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
              retries++;
            }

            // Finally remove the destroyed sandbox
            await executorAdapter.removeDestroyedSandbox(sandbox.id);

            sandbox.prevExecutorId = null;

            const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
              id: sandbox.id,
            });

            sandboxToUpdate.prevExecutorId = null;

            await this.sandboxRepository.save(sandboxToUpdate);
          } catch (error) {
            this.logger.error(
              `Failed to cleanup sandbox ${sandbox.id} on previous executor ${executor.id}:`,
              error
            );
          }
        }
        break;
      }
      case SandboxState.ERROR: {
        await this.updateSandboxState(sandbox.id, SandboxState.ERROR);
        break;
      }
    }

    return SYNC_AGAIN;
  }

  // TODO: revise/cleanup
  private getEntrypointFromDockerfile(dockerfileContent: string): string[] {
    // Match ENTRYPOINT with either a string or JSON array
    const entrypointMatch = dockerfileContent.match(/ENTRYPOINT\s+(.*)/);
    if (entrypointMatch) {
      const rawEntrypoint = entrypointMatch[1].trim();
      try {
        // Try parsing as JSON array
        const parsed = JSON.parse(rawEntrypoint);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Fallback: it's probably a plain string
        return [rawEntrypoint.replace(/["']/g, "")];
      }
    }

    // Match CMD with either a string or JSON array
    const cmdMatch = dockerfileContent.match(/CMD\s+(.*)/);
    if (cmdMatch) {
      const rawCmd = cmdMatch[1].trim();
      try {
        const parsed = JSON.parse(rawCmd);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        return [rawCmd.replace(/["']/g, "")];
      }
    }

    return ["sleep", "infinity"];
  }

  // Initiates the image build on the executor and creates an ImageExecutor depending on the result
  async buildOnExecutor(buildInfo: BuildInfo, executorId: string, organizationId: string) {
    const executor = await this.executorService.findOne(executorId);
    const executorAdapter = await this.executorAdapterFactory.create(executor);

    let retries = 0;

    while (retries < 10) {
      try {
        await executorAdapter.buildImage(buildInfo, organizationId);
        break;
      } catch (err) {
        if (err.code !== "ECONNRESET") {
          await this.executorService.createImageExecutor(
            executorId,
            buildInfo.imageRef,
            ImageExecutorState.ERROR,
            err.message
          );
          return;
        }
      }
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retries * 1000));
    }

    if (retries === 10) {
      await this.executorService.createImageExecutor(
        executorId,
        buildInfo.imageRef,
        ImageExecutorState.ERROR,
        "Timeout while building"
      );
      return;
    }

    const exists = await executorAdapter.imageExists(buildInfo.imageRef);
    let state = ImageExecutorState.BUILDING_IMAGE;
    if (exists) {
      state = ImageExecutorState.READY;
    }

    await this.executorService.createImageExecutor(executorId, buildInfo.imageRef, state);
  }
}
