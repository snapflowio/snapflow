import {
  ToolboxApi,
  SandboxState,
  SandboxApi,
  Sandbox as SandboxDto,
  PortPreviewUrl,
  SandboxBucket,
  BuildInfo,
  SandboxBackupStateEnum,
} from '@snapflow/api-client'
import { FileSystem } from './files'
import { Git } from './git'
import { CodeRunParams, Process } from './process'
import { LspLanguageId, LspServer } from './lsp'
import { SnapflowError } from './error'
import { prefixRelativePath } from './utils/path'

export interface SandboxCodeToolbox {
  getRunCommand(code: string, params?: CodeRunParams): string
}

export class Sandbox implements SandboxDto {
  public readonly fs: FileSystem
  public readonly git: Git
  public readonly process: Process

  public id!: string
  public organizationId!: string
  public image?: string
  public user!: string
  public env!: Record<string, string>
  public labels!: Record<string, string>
  public public!: boolean
  public target!: string
  public cpu!: number
  public gpu!: number
  public memory!: number
  public disk!: number
  public state?: SandboxState
  public errorReason?: string
  public backupState?: SandboxBackupStateEnum
  public backupCreatedAt?: string
  public autoStopInterval?: number
  public autoArchiveInterval?: number
  public executorDomain?: string
  public buckets?: Array<SandboxBucket>
  public buildInfo?: BuildInfo
  public createdAt?: string
  public updatedAt?: string

  private rootDir: string

  constructor(
    sandboxDto: SandboxDto,
    private readonly sandboxApi: SandboxApi,
    private readonly toolboxApi: ToolboxApi,
    private readonly codeToolbox: SandboxCodeToolbox,
  ) {
    this.processSandboxDto(sandboxDto)
    this.rootDir = ''
    this.fs = new FileSystem(this.id, this.toolboxApi, async () => await this.getRootDir())
    this.git = new Git(this.id, this.toolboxApi, async () => await this.getRootDir())
    this.process = new Process(this.id, this.codeToolbox, this.toolboxApi, async () => await this.getRootDir())
  }

  public async getUserRootDir(): Promise<string | undefined> {
    const response = await this.toolboxApi.getProjectDir(this.id)
    return response.data.dir
  }

  public async createLspServer(languageId: LspLanguageId | string, pathToProject: string): Promise<LspServer> {
    return new LspServer(
      languageId as LspLanguageId,
      prefixRelativePath(await this.getRootDir(), pathToProject),
      this.toolboxApi,
      this.id,
    )
  }

  public async setLabels(labels: Record<string, string>): Promise<Record<string, string>> {
    this.labels = (await this.sandboxApi.replaceLabels(this.id, { labels })).data.labels
    return this.labels
  }

  public async start(timeout = 60): Promise<void> {
    if (timeout < 0) throw new SnapflowError('Timeout must be a non-negative number')
    
    const startTime = Date.now()
    const response = await this.sandboxApi.startSandbox(this.id, undefined, { timeout: timeout * 1000 })
    this.processSandboxDto(response.data)
    const timeElapsed = Date.now() - startTime
    await this.waitUntilStarted(timeout ? timeout - timeElapsed / 1000 : 0)
  }

  public async stop(timeout = 60): Promise<void> {
    if (timeout < 0) throw new SnapflowError('Timeout must be a non-negative number')
    
    const startTime = Date.now()
    await this.sandboxApi.stopSandbox(this.id, undefined, { timeout: timeout * 1000 })
    await this.refreshData()
    const timeElapsed = Date.now() - startTime
    await this.waitUntilStopped(timeout ? timeout - timeElapsed / 1000 : 0)
  }

  public async delete(timeout = 60): Promise<void> {
    await this.sandboxApi.deleteSandbox(this.id, true, undefined, { timeout: timeout * 1000 })
    await this.refreshData()
  }

  public async waitUntilStarted(timeout = 60) {
    if (timeout < 0) throw new SnapflowError('Timeout must be a non-negative number')

    const checkInterval = 100
    const startTime = Date.now()

    while (this.state !== 'started') {
      await this.refreshData()

      // @ts-expect-error
      if (this.state === 'started') return

      if (this.state === 'error') {
        const errMsg = `Sandbox ${this.id} failed to start with status: ${this.state}, error reason: ${this.errorReason}`
        throw new SnapflowError(errMsg)
      }

      if (timeout !== 0 && Date.now() - startTime > timeout * 1000) throw new SnapflowError('Sandbox failed to become ready within the timeout period')

      await new Promise((resolve) => setTimeout(resolve, checkInterval))
    }
  }

  public async waitUntilStopped(timeout = 60) {
    if (timeout < 0) throw new SnapflowError('Timeout must be a non-negative number')

    const checkInterval = 100
    const startTime = Date.now()

    while (this.state !== 'stopped') {
      await this.refreshData()

	  // @ts-expect-error
      if (this.state === 'stopped') return

      if (this.state === 'error') {
        const errMsg = `Sandbox failed to stop with status: ${this.state}, error reason: ${this.errorReason}`
        throw new SnapflowError(errMsg)
      }

      if (timeout !== 0 && Date.now() - startTime > timeout * 1000) throw new SnapflowError('Sandbox failed to become stopped within the timeout period')

      await new Promise((resolve) => setTimeout(resolve, checkInterval))
    }
  }

  public async refreshData(): Promise<void> {
    const response = await this.sandboxApi.getSandbox(this.id)
    this.processSandboxDto(response.data)
  }

  public async setAutostopInterval(interval: number): Promise<void> {
    if (!Number.isInteger(interval) || interval < 0) throw new SnapflowError('autoStopInterval must be a non-negative integer')

    await this.sandboxApi.setAutostopInterval(this.id, interval)
    this.autoStopInterval = interval
  }

  public async setAutoArchiveInterval(interval: number): Promise<void> {
    if (!Number.isInteger(interval) || interval < 0) throw new SnapflowError('autoArchiveInterval must be a non-negative integer')
    await this.sandboxApi.setAutoArchiveInterval(this.id, interval)
    this.autoArchiveInterval = interval
  }

  public async getPreviewLink(port: number): Promise<PortPreviewUrl> {
    return (await this.sandboxApi.getPortPreviewUrl(this.id, port)).data
  }

  public async archive(): Promise<void> {
    await this.sandboxApi.archiveSandbox(this.id)
    await this.refreshData()
  }

  private async getRootDir(): Promise<string> {
    if (!this.rootDir) this.rootDir = (await this.getUserRootDir()) || ''
    return this.rootDir
  }

  private processSandboxDto(sandboxDto: SandboxDto) {
    this.id = sandboxDto.id
    this.organizationId = sandboxDto.organizationId
    this.image = sandboxDto.image
    this.user = sandboxDto.user
    this.env = sandboxDto.env
    this.labels = sandboxDto.labels
    this.public = sandboxDto.public
    this.target = sandboxDto.target
    this.cpu = sandboxDto.cpu
    this.gpu = sandboxDto.gpu
    this.memory = sandboxDto.memory
    this.disk = sandboxDto.disk
    this.state = sandboxDto.state
    this.errorReason = sandboxDto.errorReason
    this.backupState = sandboxDto.backupState
    this.backupCreatedAt = sandboxDto.backupCreatedAt
    this.autoStopInterval = sandboxDto.autoStopInterval
    this.autoArchiveInterval = sandboxDto.autoArchiveInterval
    this.executorDomain = sandboxDto.executorDomain
    this.buckets = sandboxDto.buckets
    this.buildInfo = sandboxDto.buildInfo
    this.createdAt = sandboxDto.createdAt
    this.updatedAt = sandboxDto.updatedAt
  }
}