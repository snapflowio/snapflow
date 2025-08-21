import {
  ToolboxApi,
  SandboxState,
  SandboxApi,
  Sandbox as SandboxDto,
  PortPreviewUrl,
  SandboxBucket,
  BuildInfo,
  SandboxBackupStateEnum,
} from "@snapflow/api-client";
import { FileSystem } from "./files";
import { Git } from "./git";
import { CodeRunParams, Process } from "./process";
import { LspLanguageId, LspServer } from "./lsp";
import { SnapflowError } from "./error";
import { prefixRelativePath } from "./utils/path";

export interface SandboxCodeToolbox {
  getRunCommand(code: string, params?: CodeRunParams): string;
}

interface SandboxServices {
  fs: FileSystem;
  git: Git;
  process: Process;
}

const DEFAULT_TIMEOUT = 60;
const POLL_INTERVAL = 100;

export class Sandbox implements SandboxDto {
  public readonly fs: FileSystem;
  public readonly git: Git;
  public readonly process: Process;

  public id!: string;
  public organizationId!: string;
  public image?: string;
  public user!: string;
  public env!: Record<string, string>;
  public labels!: Record<string, string>;
  public public!: boolean;
  public target!: string;
  public cpu!: number;
  public gpu!: number;
  public memory!: number;
  public disk!: number;
  public state?: SandboxState;
  public errorReason?: string;
  public backupState?: SandboxBackupStateEnum;
  public backupCreatedAt?: string;
  public autoStopInterval?: number;
  public autoArchiveInterval?: number;
  public executorDomain?: string;
  public buckets?: Array<SandboxBucket>;
  public buildInfo?: BuildInfo;
  public createdAt?: string;
  public updatedAt?: string;

  private rootDir: string = "";
  private rootDirPromise?: Promise<string>;

  constructor(
    sandboxDto: SandboxDto,
    private readonly sandboxApi: SandboxApi,
    private readonly toolboxApi: ToolboxApi,
    private readonly codeToolbox: SandboxCodeToolbox
  ) {
    this.updateFromDto(sandboxDto);
    const services = this.initializeServices();
    this.fs = services.fs;
    this.git = services.git;
    this.process = services.process;
  }

  private initializeServices(): SandboxServices {
    const getRootDir = () => this.getRootDir();

    return {
      fs: new FileSystem(this.id, this.toolboxApi, getRootDir),
      git: new Git(this.id, this.toolboxApi, getRootDir),
      process: new Process(this.id, this.codeToolbox, this.toolboxApi, getRootDir),
    };
  }

  async getUserRootDir(): Promise<string | undefined> {
    const response = await this.toolboxApi.getProjectDir(this.id);
    return response.data.dir;
  }

  async createLspServer(
    languageId: LspLanguageId | string,
    pathToProject: string
  ): Promise<LspServer> {
    const rootDir = await this.getRootDir();
    const fullPath = prefixRelativePath(rootDir, pathToProject);

    return new LspServer(languageId as LspLanguageId, fullPath, this.toolboxApi, this.id);
  }

  async setLabels(labels: Record<string, string>): Promise<Record<string, string>> {
    const response = await this.sandboxApi.replaceLabels(this.id, { labels });
    this.labels = response.data.labels;
    return this.labels;
  }

  async start(timeout = DEFAULT_TIMEOUT): Promise<void> {
    this.validateTimeout(timeout);

    const startTime = Date.now();
    const response = await this.sandboxApi.startSandbox(this.id, undefined, {
      timeout: timeout * 1000,
    });

    this.updateFromDto(response.data);

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const remainingTimeout = Math.max(0, timeout - elapsedSeconds);

    await this.waitUntilStarted(remainingTimeout);
  }

  async stop(timeout = DEFAULT_TIMEOUT): Promise<void> {
    this.validateTimeout(timeout);

    const startTime = Date.now();
    await this.sandboxApi.stopSandbox(this.id, undefined, { timeout: timeout * 1000 });

    await this.refreshData();

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const remainingTimeout = Math.max(0, timeout - elapsedSeconds);

    await this.waitUntilStopped(remainingTimeout);
  }

  async delete(timeout = DEFAULT_TIMEOUT): Promise<void> {
    await this.sandboxApi.deleteSandbox(this.id, undefined, { timeout: timeout * 1000 });
    await this.refreshData();
  }

  async waitUntilStarted(timeout = DEFAULT_TIMEOUT): Promise<void> {
    await this.waitForState(
      (state) => state === "started",
      (state) => state === "error",
      timeout,
      "start"
    );
  }

  async waitUntilStopped(timeout = DEFAULT_TIMEOUT): Promise<void> {
    await this.waitForState(
      (state) => state === "stopped",
      (state) => state === "error",
      timeout,
      "stop"
    );
  }

  async refreshData(): Promise<void> {
    const response = await this.sandboxApi.getSandbox(this.id);
    this.updateFromDto(response.data);
  }

  async setAutostopInterval(interval: number): Promise<void> {
    this.validateInterval(interval, "autoStopInterval");
    await this.sandboxApi.setAutostopInterval(this.id, interval);
    this.autoStopInterval = interval;
  }

  async setAutoArchiveInterval(interval: number): Promise<void> {
    this.validateInterval(interval, "autoArchiveInterval");
    await this.sandboxApi.setAutoArchiveInterval(this.id, interval);
    this.autoArchiveInterval = interval;
  }

  async getPreviewLink(port: number): Promise<PortPreviewUrl> {
    const response = await this.sandboxApi.getPortPreviewUrl(this.id, port);
    return response.data;
  }

  async archive(): Promise<void> {
    await this.sandboxApi.archiveSandbox(this.id);
    await this.refreshData();
  }

  private async getRootDir(): Promise<string> {
    if (this.rootDir) {
      return this.rootDir;
    }

    if (!this.rootDirPromise) {
      this.rootDirPromise = this.fetchRootDir();
    }

    return this.rootDirPromise;
  }

  private async fetchRootDir(): Promise<string> {
    const dir = await this.getUserRootDir();
    this.rootDir = dir || "";
    return this.rootDir;
  }

  private async waitForState(
    targetStatePredicate: (state?: SandboxState) => boolean,
    errorStatePredicate: (state?: SandboxState) => boolean,
    timeout: number,
    operation: string
  ): Promise<void> {
    this.validateTimeout(timeout);

    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    while (!targetStatePredicate(this.state)) {
      await this.refreshData();

      if (targetStatePredicate(this.state)) {
        return;
      }

      if (errorStatePredicate(this.state)) {
        throw new SnapflowError(
          `Sandbox ${this.id} failed to ${operation} with status: ${this.state}, error reason: ${this.errorReason}`
        );
      }

      if (timeout !== 0 && Date.now() - startTime > timeoutMs) {
        throw new SnapflowError(`Sandbox failed to ${operation} within the timeout period`);
      }

      await this.delay(POLL_INTERVAL);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private validateTimeout(timeout: number): void {
    if (timeout < 0) {
      throw new SnapflowError("Timeout must be a non-negative number");
    }
  }

  private validateInterval(interval: number, name: string): void {
    if (!Number.isInteger(interval) || interval < 0) {
      throw new SnapflowError(`${name} must be a non-negative integer`);
    }
  }

  private updateFromDto(dto: SandboxDto): void {
    this.id = dto.id;
    this.organizationId = dto.organizationId;
    this.image = dto.image;
    this.user = dto.user;
    this.env = dto.env;
    this.labels = dto.labels;
    this.public = dto.public;
    this.target = dto.target;
    this.cpu = dto.cpu;
    this.gpu = dto.gpu;
    this.memory = dto.memory;
    this.disk = dto.disk;
    this.state = dto.state;
    this.errorReason = dto.errorReason;
    this.backupState = dto.backupState;
    this.backupCreatedAt = dto.backupCreatedAt;
    this.autoStopInterval = dto.autoStopInterval;
    this.autoArchiveInterval = dto.autoArchiveInterval;
    this.executorDomain = dto.executorDomain;
    this.buckets = dto.buckets;
    this.buildInfo = dto.buildInfo;
    this.createdAt = dto.createdAt;
    this.updatedAt = dto.updatedAt;
  }
}
