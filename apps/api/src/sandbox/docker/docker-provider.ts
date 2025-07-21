import * as fsSync from "fs";
import { promises as fs } from "fs";
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

    this.terminalBinaryUrl = this.configService.get<string>("TERMINAL_BINARY_URL");
  }

  async onModuleInit() {
    const binaryPromises = [this.ensureTerminalBinary()];

    try {
      await Promise.all(binaryPromises);
    } catch (error) {
      this.logger.error("Failed to download binaries during initialization:", error);
    }
  }

  private async ensureTerminalBinary(): Promise<void> {
    this.logger.log("Starting terminal binary setup...");

    try {
      const binaryDir = path.dirname(this.TERMINAL_BINARY_PATH);
      this.logger.debug("Creating directory:", binaryDir);
      this.logger.debug("Expected binary path:", this.TERMINAL_BINARY_PATH);

      await fs.mkdir(binaryDir, { recursive: true });

      try {
        const stats = await fs.stat(this.TERMINAL_BINARY_PATH);

        if (stats.isFile()) {
          this.logger.debug("Terminal binary already exists");
          return;
        }
        if (stats.isDirectory()) {
          this.logger.warn("Path exists but is a directory, not a file. Removing directory...");
          await fs.rmdir(this.TERMINAL_BINARY_PATH, { recursive: true });
          this.logger.debug("Directory removed, proceeding with download...");
        }
      } catch (error) {
        this.logger.debug("Terminal binary not found, downloading...");
      }

      if (!this.terminalBinaryUrl) {
        this.logger.warn(
          "TERMINAL_BINARY_URL is not configured - terminal support will be disabled"
        );
        return;
      }

      this.logger.log(`Downloading terminal binary from ${this.terminalBinaryUrl}`);

      let response: axios.AxiosResponse<any, any>;
      try {
        response = await axios({
          method: "GET",
          url: this.terminalBinaryUrl,
          responseType: "stream",
          timeout: 60000,
          maxRedirects: 5,
          validateStatus: (status) => status < 400,
          headers: {
            "User-Agent": "Snapflow-Docker-Provider/1.0",
          },
        });
      } catch (downloadError) {
        if (downloadError.response) {
          this.logger.error(
            `Download failed with status ${downloadError.response.status}: ${downloadError.response.statusText}`
          );
          this.logger.error(`Response headers:`, downloadError.response.headers);
        } else if (downloadError.request) {
          this.logger.error("Download failed - no response received:", downloadError.message);
        } else {
          this.logger.error("Download failed - request setup error:", downloadError.message);
        }
        throw downloadError;
      }

      this.logger.debug("Download response received, status:", response.status);

      // Create a temporary file first
      const tempPath = `${this.TERMINAL_BINARY_PATH}.tmp`;
      const writer = fsSync.createWriteStream(tempPath);

      // Track download progress
      let downloadedBytes = 0;
      const contentLength = Number.parseInt(response.headers["content-length"] || "0", 10);

      response.data.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (contentLength > 0) {
          const progress = Math.round((downloadedBytes / contentLength) * 100);
          if (progress % 10 === 0) {
            this.logger.debug(`Download progress: ${progress}%`);
          }
        }
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", () => {
          this.logger.debug("File write completed");
          resolve(undefined);
        });
        writer.on("error", (err) => {
          this.logger.error("File write error:", err);
          // Clean up temp file on error
          fs.unlink(tempPath).catch(() => {});
          reject(err);
        });
        response.data.on("error", (err) => {
          this.logger.error("Download stream error:", err);
          writer.destroy();
          // Clean up temp file on error
          fs.unlink(tempPath).catch(() => {});
          reject(err);
        });
      });

      // Verify the downloaded file
      const tempStats = await fs.stat(tempPath);
      if (tempStats.size === 0) {
        await fs.unlink(tempPath);
        throw new Error("Downloaded file is empty");
      }

      // Move temp file to final location
      await fs.rename(tempPath, this.TERMINAL_BINARY_PATH);

      // Make executable
      await fs.chmod(this.TERMINAL_BINARY_PATH, 0o755);

      // Verify the file was created successfully
      const finalStats = await fs.stat(this.TERMINAL_BINARY_PATH);
      this.logger.debug("Final file stats:", {
        size: finalStats.size,
        isFile: finalStats.isFile(),
        mode: finalStats.mode.toString(8),
      });

      this.logger.log("Terminal binary downloaded and made executable");
    } catch (error) {
      this.logger.error("Failed to download terminal binary:", error);
      // Don't throw - just log the error and continue without terminal support
      this.logger.warn("Terminal support will be disabled for containers");
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
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
        Cmd: ["/usr/local/bin/terminal", "-p", port.toString(), "-W", shell],
        AttachStdout: false,
        AttachStderr: false,
        Tty: true,
      });

      await execTerminal.start({
        Detach: true,
      });

      this.logger.debug(`Terminal process started on port ${port} with shell ${shell}`);
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

    const binds: string[] = [];
    const terminalBinaryExists = await this.fileExists(this.TERMINAL_BINARY_PATH);

    if (terminalBinaryExists) {
      binds.push(`${this.TERMINAL_BINARY_PATH}:/usr/local/bin/terminal`);
      this.logger.debug("Terminal binary will be mounted in container");
    } else {
      this.logger.debug("Terminal binary not available, container will not have terminal support");
    }

    const container = await this.docker.createContainer({
      Image: imageName,
      Env: [
        "SNAPFLOW_SANDBOX_ID=init-image",
        "SNAPFLOW_SANDBOX_USER=root",
        `SNAPFLOW_SANDBOX_IMAGE=${imageName}`,
      ],
      Entrypoint: entrypoint,
      platform: "linux/amd64",
      HostConfig: {
        Binds: binds,
      },
    });

    await container.start();

    if (terminalBinaryExists) {
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

      // Step 2: Delete each tag
      for (const tag of tags) {
        try {
          // Get the digest for this tag
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

          // Delete the manifest
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
          // Continue with other tags
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
      // Delete both backup and snapshot repositories - necessary due to renaming
      await this.deleteRepositoryWithPrefix(repository, "backup-", registry);
      await this.deleteRepositoryWithPrefix(repository, "snapshot-", registry);
    } catch (error) {
      this.logger.error(`Failed to delete repositories for ${repository}: ${error.message}`);
      throw error;
    }
  }

  async deleteBackupImageFromRegistry(imageName: string, registry: Registry): Promise<void> {
    // Extract tag
    const lastColonIndex = imageName.lastIndexOf(":");
    const fullPath = imageName.substring(0, lastColonIndex);
    const tag = imageName.substring(lastColonIndex + 1);

    const registryUrl = this.registryService.getRegistryUrl(registry);

    // Remove registry prefix if present in the image name
    let projectAndRepo = fullPath;
    if (fullPath.startsWith(registryUrl)) {
      projectAndRepo = fullPath.substring(registryUrl.length + 1); // +1 for the slash
    }

    // For Harbor format like: harbor.host/bbox-stage/backup-sandbox-75148d5a
    const parts = projectAndRepo.split("/");

    // Construct repository path (everything after the registry host)
    const repoPath = parts.slice(1).join("/");

    // First, get the digest for the tag using the manifests endpoint
    const manifestUrl = `${registryUrl}/v2/${repoPath}/manifests/${tag}`;
    const encodedCredentials = Buffer.from(`${registry.username}:${registry.password}`).toString(
      "base64"
    );

    try {
      // Get the digest from the headers
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

      // Extract the digest from headers
      const digest = manifestResponse.headers["docker-content-digest"];
      if (!digest) throw new Error(`Docker content digest not found for image ${imageName}`);

      // Now delete the image using the digest
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
      if (error.statusCode === 404) return;
      this.logger.error("Error removing Docker container:", error);
      throw error; // Rethrow to let sandbox service handle the error state
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
    if (!containerId) return false;

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

      // Check the architecture from the image metadata
      const architecture = dockerImage.Architecture;

      // Valid x64 architectures
      const x64Architectures = ["amd64", "x86_64"];

      // Check if the architecture matches x64
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

  /**
   * Checks if an image exists in the specified registry without pulling it
   */
  async checkImageExistsInRegistry(imageName: string, registry: Registry): Promise<boolean> {
    try {
      // extract tag
      const lastColonIndex = imageName.lastIndexOf(":");
      const fullPath = imageName.substring(0, lastColonIndex);
      const tag = imageName.substring(lastColonIndex + 1);

      const registryUrl = this.registryService.getRegistryUrl(registry);

      // Remove registry prefix if present in the image name
      let projectAndRepo = fullPath;
      if (fullPath.startsWith(registryUrl)) {
        projectAndRepo = fullPath.substring(registryUrl.length + 1); // +1 for the slash
      }

      // For Harbor format like: harbor.host/bbox-stage/backup-sandbox-75148d5a
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
        if (attempt === maxAttempts) {
          throw error;
        }

        if (error.fatal) {
          throw error.err;
        }

        this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
        await new Promise((resolve) => setTimeout(resolve, delay));

        attempt++;
        delay *= 2; // Exponential backoff
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
        if (err) {
          throw err;
        }
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

    // Validate architecture after pulling
    const isValidArch = await this.validateImageArchitecture(image);
    if (!isValidArch) throw new Error(`Image ${image} is not compatible with x64 architecture`);
  }

  async start(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();

      const terminalBinaryExists = await this.fileExists(this.TERMINAL_BINARY_PATH);
      if (terminalBinaryExists) {
        this.startTerminalProcess(container).catch((err) =>
          this.logger.error("Failed to start terminal process:", err)
        );
      } else {
        this.logger.debug("Terminal binary not available, skipping terminal process start");
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
      throw error; // Rethrow or handle as needed
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
      // Size is returned in bytes, convert to GB
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

      if (!repo || !tag) {
        throw new Error("Invalid target image format");
      }

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
