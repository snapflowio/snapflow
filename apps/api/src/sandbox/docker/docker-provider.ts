import path from "path";
import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import Docker from "dockerode";
import { Registry } from "../../registry/entities/registry.entity";
import { RegistryService } from "../../registry/registry.service";

@Injectable()
export class DockerProvider implements OnModuleInit {
  public docker: Docker;

  private readonly logger = new Logger(DockerProvider.name);
  private readonly SNAPFLOW_BINARY_PATH = path.join(process.cwd(), ".tmp", "binaries", "snapflow");
  private readonly snapflowBinaryUrl: string;
  private readonly TERMINAL_BINARY_PATH = path.join(process.cwd(), ".tmp", "binaries", "terminal");
  private readonly terminalBinaryUrl: string;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(RegistryService)
    private readonly registryService: RegistryService
  ) {
    if (this.configService.get<string>("DOCKER_SSH_HOST")) {
      process.env.DOCKER_HOST = `ssh://${this.configService.get<string>("DOCKER_SSH_USERNAME")}@${this.configService.get<string>("DOCKER_SSH_HOST")}`;
      this.docker = new Docker({});
    } else {
      this.docker = new Docker({ socketPath: "/var/run/docker.sock" });
    }

    this.snapflowBinaryUrl = this.configService.get<string>("SNAPFLOW_BINARY_URL");
    this.terminalBinaryUrl = this.configService.get<string>("TERMINAL_BINARY_URL");
  }

  async onModuleInit() {
    const binaryPromises = [];

    try {
      await Promise.all(binaryPromises);
    } catch (error) {
      this.logger.error("Failed to download binaries during initialization:", error);
    }
  }

  public async startTerminalProcess(container: Docker.Container, port = 22222): Promise<void> {
    try {
      const execCheckBash = await container.exec({
        Cmd: ["which", "bash"],
        AttachStdout: true,
        AttachStderr: true,
      });

      const shell = await new Promise<string>((resolve) => {
        execCheckBash.start({}, (err, stream) => {
          if (err) {
            resolve("sh");
            return;
          }

          let output = "";
          stream.on("data", (chunk) => {
            output += chunk.toString();
          });

          stream.on("end", () => {
            resolve(output.trim() ? "bash" : "sh");
          });
        });
      });

      const execTerminal = await container.exec({
        Cmd: ["terminal", "-p", port.toString(), "-W", shell],
        AttachStdout: false,
        AttachStderr: false,
        Tty: true,
      });

      await execTerminal.start({
        Detach: true,
      });
    } catch (error) {
      this.logger.error("Error starting terminal process:", error);
    }
  }

  async containerExists(containerId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.inspect();
      return true;
    } catch (error) {
      return false;
    }
  }

  async create(imageName: string, entrypoint?: string[]): Promise<string> {
    const isValidArch = await this.validateImageArchitecture(imageName);
    if (!isValidArch) throw new Error(`Image ${imageName} is not compatible with x64 architecture`);

    const container = await this.docker.createContainer({
      Image: imageName,
      Env: [
        "SNAPFLOW_SANDBOX_ID=init-image",
        "SNAPFLOW_SANDBOX_USER=root",
        `SNAPFLOW_SANDBOX_IMAGE=${imageName}`,
      ],
      Entrypoint: entrypoint,
      HostConfig: {
        Binds: [
          ...(this.snapflowBinaryUrl
            ? [`${this.SNAPFLOW_BINARY_PATH}:/usr/local/bin/snapflow`]
            : []),
          ...(this.terminalBinaryUrl
            ? [`${this.TERMINAL_BINARY_PATH}:/usr/local/bin/terminal`]
            : []),
        ],
      },
    });

    await container.start();

    if (this.terminalBinaryUrl) {
      this.startTerminalProcess(container).catch((err) =>
        this.logger.error("Failed to start terminal process:", err)
      );
    }

    return container.id;
  }

  private async deleteRepositoryWithPrefix(
    repository: string,
    prefix: string,
    registry: Registry
  ): Promise<void> {
    const registryUrl = this.registryService.getRegistryUrl(registry);
    const encodedCredentials = Buffer.from(`${registry.username}:${registry.password}`).toString(
      "base64"
    );
    const repoPath = `${registry.project}/${prefix}${repository}`;

    try {
      const tagsUrl = `${registryUrl}/v2/${repoPath}/tags/list`;

      const tagsResponse = await axios({
        method: "get",
        url: tagsUrl,
        headers: {
          Authorization: `Basic ${encodedCredentials}`,
        },
        validateStatus: (status) => status < 500,
        timeout: 30000,
      });

      if (tagsResponse.status === 404) return;

      if (tagsResponse.status >= 300) {
        this.logger.error(
          `Error listing tags in repository ${repoPath}: ${tagsResponse.statusText}`
        );
        throw new Error(
          `Failed to list tags in repository ${repoPath}: ${tagsResponse.statusText}`
        );
      }

      const tags = tagsResponse.data.tags || [];

      if (tags.length === 0) {
        this.logger.debug(`Repository ${repoPath} has no tags to delete`);
        return;
      }

      for (const tag of tags) {
        try {
          const manifestUrl = `${registryUrl}/v2/${repoPath}/manifests/${tag}`;

          const manifestResponse = await axios({
            method: "head",
            url: manifestUrl,
            headers: {
              Authorization: `Basic ${encodedCredentials}`,
              Accept: "application/vnd.docker.distribution.manifest.v2+json",
            },
            validateStatus: (status) => status < 500,
            timeout: 30000,
          });

          if (manifestResponse.status >= 300) {
            this.logger.warn(
              `Couldn't get manifest for tag ${tag}: ${manifestResponse.statusText}`
            );
            continue;
          }

          const digest = manifestResponse.headers["docker-content-digest"];
          if (!digest) {
            this.logger.warn(`Docker content digest not found for tag ${tag}`);
            continue;
          }

          const deleteUrl = `${registryUrl}/v2/${repoPath}/manifests/${digest}`;

          const deleteResponse = await axios({
            method: "delete",
            url: deleteUrl,
            headers: {
              Authorization: `Basic ${encodedCredentials}`,
            },
            validateStatus: (status) => status < 500,
            timeout: 30000,
          });

          if (deleteResponse.status < 300) {
            this.logger.debug(`Deleted tag ${tag} from repository ${repoPath}`);
          } else {
            this.logger.warn(`Failed to delete tag ${tag}: ${deleteResponse.statusText}`);
          }
        } catch (error) {
          this.logger.warn(`Exception when deleting tag ${tag}: ${error.message}`);
        }
      }

      this.logger.debug(`Repository ${repoPath} cleanup completed`);
    } catch (error) {
      this.logger.error(`Exception when deleting repository ${repoPath}: ${error.message}`);
      throw error;
    }
  }

  async deleteSandboxRepository(repository: string, registry: Registry): Promise<void> {
    try {
      await this.deleteRepositoryWithPrefix(repository, "backup-", registry);
      await this.deleteRepositoryWithPrefix(repository, "image-", registry);
    } catch (error) {
      this.logger.error(`Failed to delete repositories for ${repository}: ${error.message}`);
      throw error;
    }
  }

  async deleteBackupImageFromRegistry(imageName: string, registry: Registry): Promise<void> {
    const lastColonIndex = imageName.lastIndexOf(":");
    const fullPath = imageName.substring(0, lastColonIndex);
    const tag = imageName.substring(lastColonIndex + 1);

    const registryUrl = this.registryService.getRegistryUrl(registry);

    let projectAndRepo = fullPath;
    if (fullPath.startsWith(registryUrl)) {
      projectAndRepo = fullPath.substring(registryUrl.length + 1);
    }

    const parts = projectAndRepo.split("/");
    const repoPath = parts.slice(1).join("/");

    // First, get the digest for the tag using the manifests endpoint
    const manifestUrl = `${registryUrl}/v2/${repoPath}/manifests/${tag}`;
    const encodedCredentials = Buffer.from(`${registry.username}:${registry.password}`).toString(
      "base64"
    );

    try {
      const manifestResponse = await axios({
        method: "head",
        url: manifestUrl,
        headers: {
          Authorization: `Basic ${encodedCredentials}`,
          Accept: "application/vnd.docker.distribution.manifest.v2+json",
        },
        validateStatus: (status) => status < 500,
        timeout: 30000,
      });

      if (manifestResponse.status >= 300) {
        this.logger.error(
          `Error getting manifest for image ${imageName}: ${manifestResponse.statusText}`
        );
        throw new Error(
          `Failed to get manifest for image ${imageName}: ${manifestResponse.statusText}`
        );
      }

      const digest = manifestResponse.headers["docker-content-digest"];
      if (!digest) throw new Error(`Docker content digest not found for image ${imageName}`);

      const deleteUrl = `${registryUrl}/v2/${repoPath}/manifests/${digest}`;

      const deleteResponse = await axios({
        method: "delete",
        url: deleteUrl,
        headers: {
          Authorization: `Basic ${encodedCredentials}`,
        },
        validateStatus: (status) => status < 500,
        timeout: 30000,
      });

      if (deleteResponse.status < 300) {
        this.logger.debug(`Image ${imageName} removed from the registry`);
        return;
      }

      this.logger.error(
        `Error removing image ${imageName} from registry: ${deleteResponse.statusText}`
      );

      throw new Error(
        `Failed to remove image ${imageName} from registry: ${deleteResponse.statusText}`
      );
    } catch (error) {
      this.logger.error(`Exception when deleting image ${imageName}: ${error.message}`);
      throw error;
    }
  }

  async remove(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force: true });
    } catch (error) {
      if (error.statusCode === 404) {
        return;
      }
      this.logger.error("Error removing Docker container:", error);
      throw error;
    }
  }

  async getContainerIPAddress(containerId: string): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const data = await container.inspect();
    return data.NetworkSettings.IPAddress;
  }

  async getImageEntrypoint(image: string): Promise<undefined | string | string[]> {
    const dockerImage = await this.docker.getImage(image).inspect();
    return dockerImage.Config.Entrypoint;
  }

  async imageExists(image: string, includeLatest = false): Promise<boolean> {
    image = image.replace("docker.io/", "");
    if (image.endsWith(":latest") && !includeLatest) {
      return false;
    }
    const images = await this.docker.listImages({});
    const imageExists = images.some((imageInfo) => imageInfo.RepoTags?.includes(image));
    return imageExists;
  }

  async isRunning(containerId: string): Promise<boolean> {
    if (!containerId) {
      return false;
    }
    try {
      const container = this.docker.getContainer(containerId);
      const data = await container.inspect();
      return data.State.Running;
    } catch (error) {
      if (error.statusCode === 404) {
        return false;
      }
      this.logger.error("Error checking Docker container state:", error);
      return false; // Return false instead of throwing
    }
  }

  async isDestroyed(containerId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.inspect();
      return false;
    } catch (error) {
      return true;
    }
  }

  async validateImageArchitecture(image: string): Promise<boolean> {
    try {
      const imageUnified = image.replace("docker.io/", "");
      const dockerImage = await this.docker.getImage(imageUnified).inspect();
      const architecture = dockerImage.Architecture;

      const x64Architectures = ["amd64", "x86_64"];
      const isX64 = x64Architectures.includes(architecture.toLowerCase());

      if (!isX64) {
        this.logger.warn(`Image ${image} architecture (${architecture}) is not x64 compatible`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error validating architecture for image ${image}:`, error);
      throw new Error(`Failed to validate image architecture: ${error.message}`);
    }
  }

  async checkImageExistsInRegistry(imageName: string, registry: Registry): Promise<boolean> {
    try {
      const lastColonIndex = imageName.lastIndexOf(":");
      const fullPath = imageName.substring(0, lastColonIndex);
      const tag = imageName.substring(lastColonIndex + 1);

      const registryUrl = this.registryService.getRegistryUrl(registry);

      let projectAndRepo = fullPath;
      if (fullPath.startsWith(registryUrl)) {
        projectAndRepo = fullPath.substring(registryUrl.length + 1); // +1 for the slash
      }

      const parts = projectAndRepo.split("/");

      const apiUrl = `${registryUrl}/v2/${parts[1]}/${parts[2]}/manifests/${tag}`;
      const encodedCredentials = Buffer.from(`${registry.username}:${registry.password}`).toString(
        "base64"
      );

      const response = await axios({
        method: "get",
        url: apiUrl,
        headers: {
          Authorization: `Basic ${encodedCredentials}`,
        },
        validateStatus: (status) => status < 500,
        timeout: 30000,
      });

      if (response.status === 200) {
        this.logger.debug(`Image ${imageName} exists in registry`);
        return true;
      }

      this.logger.debug(
        `Image ${imageName} does not exist in registry (status: ${response.status})`
      );

      return false;
    } catch (error) {
      this.logger.error(
        `Error checking if image ${imageName} exists in registry: ${error.message}`
      );
      return false;
    }
  }

  private async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
    initialDelayMs = 1000
  ): Promise<T> {
    let attempt = 1;
    let delay = initialDelayMs;

    while (attempt <= maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        if (error.fatal) throw error.err;

        this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
        await new Promise((resolve) => setTimeout(resolve, delay));

        attempt++;
        delay *= 2;
      }
    }

    throw new Error("Should not reach here");
  }

  async pullImage(
    image: string,
    registry?: { url: string; username: string; password: string }
  ): Promise<void> {
    await this.retryWithExponentialBackoff(async () => {
      const options: any = {
        platform: "linux/amd64",
      };

      if (registry) {
        options.authconfig = {
          username: registry.username,
          password: registry.password,
          serveraddress: registry.url,
          auth: "",
        };
      }

      try {
        const stream = await this.docker.pull(image, options);
        const err = await new Promise<Error | null>((resolve) =>
          this.docker.modem.followProgress(stream, resolve)
        );

        if (err) throw err;
      } catch (err) {
        if (err.statusCode === 404) {
          let returnErr = err;
          if (
            err.message?.includes("pull access denied") ||
            err.message?.includes("no basic auth credentials")
          ) {
            returnErr = new Error(
              "Repository does not exist or may require container registry login credentials."
            );
          }
          throw {
            fatal: true,
            err: returnErr,
          };
        }
        throw err;
      }
    });

    const isValidArch = await this.validateImageArchitecture(image);
    if (!isValidArch) {
      throw new Error(`Image ${image} is not compatible with x64 architecture`);
    }
  }

  async start(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();

      if (this.terminalBinaryUrl) {
        this.startTerminalProcess(container).catch((err) =>
          this.logger.error("Failed to start terminal process:", err)
        );
      }
    } catch (error) {
      this.logger.error("Error starting Docker container:", error);
      throw error;
    }
  }

  async stop(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
    } catch (error) {
      this.logger.error("Error stopping Docker container:", error);
      throw error;
    }
  }

  async removeImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).remove();
    } catch (error) {
      this.logger.error("Error removing image:", error);
      throw error;
    }
  }

  async getImageInfo(
    imageName: string
  ): Promise<{ sizeGB: number; entrypoint?: string | string[] }> {
    try {
      const image = await this.docker.getImage(imageName).inspect();
      return {
        sizeGB: image.Size / (1024 * 1024 * 1024),
        entrypoint: image.Config.Entrypoint,
      };
    } catch (error) {
      this.logger.error(`Error getting size for image ${imageName}:`, error);
      throw new Error(`Failed to get image size: ${error.message}`);
    }
  }

  async pushImage(
    image: string,
    registry: { url: string; username: string; password: string }
  ): Promise<void> {
    await this.retryWithExponentialBackoff(async () => {
      return new Promise((resolve, reject) => {
        const options: any = {
          authconfig: {
            username: registry.username,
            password: registry.password,
            serveraddress: registry.url,
            auth: "",
          },
        };

        this.docker.getImage(image).push(options, (err, stream) => {
          if (err) {
            this.logger.error("Error initiating Docker push:", err);
            reject(err);
            return;
          }

          let errorEvent: Error | null = null;
          let done = false;

          this.docker.modem.followProgress(
            stream,
            (err: Error | null, output: any[]) => {
              if (done) {
                return;
              }
              done = true;

              if (err) {
                this.logger.error("Error following Docker push progress:", err);
                reject(err);
                return;
              }
              if (errorEvent) {
                reject(errorEvent);
                return;
              }
              resolve(output);
            },
            (event: any) => {
              // Optional progress callback
              if (event.error) {
                errorEvent = event.error;
                this.logger.error("Push progress error:", event.error);
              }
            }
          );
        });
      });
    });
  }

  async tagImage(sourceImage: string, targetImage: string): Promise<void> {
    try {
      const lastColonIndex = targetImage.lastIndexOf(":");
      const repo = targetImage.substring(0, lastColonIndex);
      const tag = targetImage.substring(lastColonIndex + 1);

      if (!repo || !tag) throw new Error("Invalid target image format");

      const image = this.docker.getImage(sourceImage);
      await image.tag({
        repo,
        tag,
      });
    } catch (error) {
      this.logger.error(`Error tagging image ${sourceImage} as ${targetImage}:`, error);
      throw new Error(`Failed to tag image: ${error.message}`);
    }
  }

  async imagePrune(): Promise<void> {
    try {
      await this.docker.pruneImages({
        filters: {
          dangling: { true: true },
        },
      });
    } catch (error) {
      if (error.statusCode === 409) return;
      throw error;
    }
  }
}
