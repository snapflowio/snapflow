import {
  Configuration,
  ImagesApi,
  SandboxApi,
  SandboxState,
  ToolboxApi,
  BucketsApi,
  SandboxBucket,
} from '@snapflow/api-client'
import axios, { AxiosError, AxiosInstance } from 'axios'
import * as dotenv from 'dotenv'
import { SandboxTsCodeToolbox } from './sandboxes/typescript'
import { SnapflowError } from './error'
import { Sandbox, SandboxCodeToolbox } from './sandbox'
import * as packageJson from '../package.json'
import { processStreamingResponse } from './utils/stream'

export interface BucketMount extends SandboxBucket {
  volumeId: string
  mountPath: string
}

export interface SnapflowConfig {
  apiKey?: string
  jwtToken?: string
  organizationId?: string
  apiUrl?: string
  serverUrl?: string
  target?: string
}

export enum CodeLanguage {
  PYTHON = 'python',
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
}

export interface Resources {
  cpu?: number
  gpu?: number
  memory?: number
  disk?: number
}

export type CreateSandboxBaseParams = {
  user?: string
  language?: CodeLanguage | string
  envVars?: Record<string, string>
  labels?: Record<string, string>
  public?: boolean
  autoStopInterval?: number
  autoArchiveInterval?: number
  autoDeleteInterval?: number
  volumes?: BucketMount[]
}

export type CreateSandboxFromImageParams = CreateSandboxBaseParams & {
  image: string | typeof Image
  resources?: Resources
}

export type CreateSandboxFromSnapshotParams = CreateSandboxBaseParams & {
  image?: string
}

export type SandboxFilter = {
  id?: string
  labels?: Record<string, string>
}

type CreateSandboxOptions = {
  onSnapshotCreateLogs?: (chunk: string) => void
  timeout?: number
}

const DEFAULT_TIMEOUT = 60
const DEFAULT_API_URL = 'https://app.snapflow.io/api'
const AXIOS_TIMEOUT = 24 * 60 * 60 * 1000

export class Snapflow {
  private readonly sandboxApi: SandboxApi
  private readonly toolboxApi: ToolboxApi
  private readonly target?: string
  private readonly apiKey?: string
  private readonly jwtToken?: string
  private readonly organizationId?: string
  private readonly apiUrl: string
  private readonly codeToolboxCache = new Map<CodeLanguage, SandboxCodeToolbox>()

  constructor(config?: SnapflowConfig) {
    const resolvedConfig = this.resolveConfig(config)
    this.validateConfig(resolvedConfig)
    
    this.apiKey = resolvedConfig.apiKey
    this.jwtToken = resolvedConfig.jwtToken
    this.organizationId = resolvedConfig.organizationId
    this.apiUrl = resolvedConfig.apiUrl!
    this.target = resolvedConfig.target
    
    const axiosInstance = this.createAxiosInstance()
    const configuration = this.createConfiguration(axiosInstance)
    
    this.sandboxApi = new SandboxApi(configuration, '', axiosInstance)
    this.toolboxApi = new ToolboxApi(configuration, '', axiosInstance)
  }

  private resolveConfig(config?: SnapflowConfig): SnapflowConfig {
    const envConfig = this.loadEnvironmentConfig()
    
    return {
      apiKey: config?.apiKey ?? (config?.jwtToken ? undefined : envConfig.apiKey),
      jwtToken: config?.jwtToken ?? envConfig.jwtToken,
      organizationId: config?.organizationId ?? envConfig.organizationId,
      apiUrl: config?.apiUrl ?? config?.serverUrl ?? envConfig.apiUrl ?? DEFAULT_API_URL,
      target: config?.target ?? envConfig.target
    }
  }

  private loadEnvironmentConfig(): Partial<SnapflowConfig> {
    dotenv.config({ path: '.env.local', override: true })
    
    if (process?.env['snapflow_SERVER_URL'] && !process?.env['snapflow_API_URL']) {
      console.warn(
        '[Deprecation Warning] Environment variable `snapflow_SERVER_URL` is deprecated and will be removed in future versions. Use `snapflow_API_URL` instead.'
      )
    }
    
    return {
      apiKey: process?.env['snapflow_API_KEY'],
      jwtToken: process?.env['snapflow_JWT_TOKEN'],
      organizationId: process?.env['snapflow_ORGANIZATION_ID'],
      apiUrl: process?.env['snapflow_API_URL'] || process?.env['snapflow_SERVER_URL'],
      target: process?.env['snapflow_TARGET']
    }
  }

  private validateConfig(config: SnapflowConfig): void {
    const hasApiKeyAuth = config.apiKey && config.apiUrl
    const hasJwtAuth = config.jwtToken && config.organizationId && config.apiUrl
    
    if (!hasApiKeyAuth && !hasJwtAuth) {
      throw new SnapflowError('Invalid configuration: missing required authentication parameters')
    }
    
    if (!config.apiKey && !config.organizationId) {
      throw new SnapflowError('Organization ID is required when using JWT token')
    }
  }

  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({ timeout: AXIOS_TIMEOUT })
    
    instance.interceptors.response.use(
      response => response,
      error => this.handleAxiosError(error)
    )
    
    return instance
  }

  private handleAxiosError(error: AxiosError): never {
    const isTimeout = error.message.includes('timeout of')
    const errorData = error.response?.data as any
    
    const errorMessage = isTimeout 
      ? 'Operation timed out'
      : errorData?.message || errorData || error.message || String(error)
    
    throw new SnapflowError(this.formatErrorMessage(errorMessage))
  }

  private formatErrorMessage(message: unknown): string {
    try {
      return typeof message === 'string' ? message : JSON.stringify(message)
    } catch {
      return String(message)
    }
  }

  private createConfiguration(axiosInstance: AxiosInstance): Configuration {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey || this.jwtToken}`,
      'X-Snapflow-Source': 'typescript-sdk',
      'X-Snapflow-SDK-Version': packageJson.version,
    }
    
    if (!this.apiKey && this.organizationId) {
      headers['X-Snapflow-Organization-ID'] = this.organizationId
    }
    
    return new Configuration({
      basePath: this.apiUrl,
      baseOptions: { headers }
    })
  }

  async create(params?: CreateSandboxFromSnapshotParams, options?: { timeout?: number }): Promise<Sandbox>
  async create(params?: CreateSandboxFromImageParams, options?: CreateSandboxOptions): Promise<Sandbox>
  async create(
    params?: CreateSandboxFromSnapshotParams | CreateSandboxFromImageParams,
    options: CreateSandboxOptions = {}
  ): Promise<Sandbox> {
    const startTime = Date.now()
    const timeout = options.timeout ?? DEFAULT_TIMEOUT
    
    this.validateTimeout(timeout)
    
    const normalizedParams = this.normalizeCreateParams(params)
    this.validateCreateParams(normalizedParams)
    
    const codeToolbox = this.getCodeToolbox(normalizedParams.language as CodeLanguage)
    
    try {
      let sandboxData = await this.createSandboxData(normalizedParams, timeout)
      if (sandboxData.state === SandboxState.PENDING_BUILD && options.onSnapshotCreateLogs) {
        sandboxData = await this.handleBuildLogs(sandboxData, options.onSnapshotCreateLogs)
      }
      
      const sandbox = new Sandbox(sandboxData, this.sandboxApi, this.toolboxApi, codeToolbox)
      
      if (sandbox.state !== 'started') {
        const remainingTimeout = timeout - (Date.now() - startTime) / 1000
        await sandbox.waitUntilStarted(Math.max(0, remainingTimeout))
      }
      
      return sandbox
    } catch (error) {
      if (error instanceof SnapflowError && error.message.includes('Operation timed out')) {
        throw new SnapflowError(`Failed to create and start sandbox within ${timeout} seconds. Operation timed out.`)
      }
      throw error
    }
  }

  private normalizeCreateParams(params?: CreateSandboxFromSnapshotParams | CreateSandboxFromImageParams) {
    const defaultParams = { language: CodeLanguage.TYPESCRIPT }
    return { ...defaultParams, ...params }
  }

  private validateTimeout(timeout: number): void {
    if (timeout < 0) {
      throw new SnapflowError('Timeout must be a non-negative number')
    }
  }

  private validateCreateParams(params: any): void {
    const { autoStopInterval, autoArchiveInterval } = params
    
    if (autoStopInterval !== undefined && (!Number.isInteger(autoStopInterval) || autoStopInterval < 0)) {
      throw new SnapflowError('autoStopInterval must be a non-negative integer')
    }
    
    if (autoArchiveInterval !== undefined && (!Number.isInteger(autoArchiveInterval) || autoArchiveInterval < 0)) {
      throw new SnapflowError('autoArchiveInterval must be a non-negative integer')
    }
  }

  private async createSandboxData(params: any, timeout: number) {
    const labels = { ...params.labels }
    if (params.language) {
      labels['code-toolbox-language'] = params.language
    }
    
    const createParams = {
      image: params.image,
      buildInfo: undefined,
      user: params.user,
      env: params.envVars || {},
      labels,
      public: params.public,
      cpu: params.resources?.cpu,
      gpu: params.resources?.gpu,
      memory: params.resources?.memory,
      disk: params.resources?.disk,
      autoStopInterval: params.autoStopInterval,
      autoArchiveInterval: params.autoArchiveInterval,
      buckets: params.volumes,
    }
    
    const response = await this.sandboxApi.createSandbox(
      createParams,
      undefined,
      { timeout: timeout * 1000 }
    )
    
    return response.data
  }

  private async handleBuildLogs(sandboxInstance: any, onSnapshotCreateLogs: (chunk: string) => void) {
    const terminalStates = [
      SandboxState.STARTED,
      SandboxState.STARTING,
      SandboxState.ERROR,
      SandboxState.BUILD_FAILED,
    ]
    
    while (sandboxInstance.state === SandboxState.PENDING_BUILD) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      sandboxInstance = (await this.sandboxApi.getSandbox(sandboxInstance.id)).data
    }
    
    await processStreamingResponse(
      () => this.sandboxApi.getBuildLogs(sandboxInstance.id, undefined, true, { responseType: 'stream' }),
      chunk => onSnapshotCreateLogs(chunk.trimEnd()),
      async () => {
        sandboxInstance = (await this.sandboxApi.getSandbox(sandboxInstance.id)).data
        return sandboxInstance.state !== undefined && terminalStates.includes(sandboxInstance.state)
      }
    )
    
    return sandboxInstance
  }

  async get(sandboxId: string): Promise<Sandbox> {
    const response = await this.sandboxApi.getSandbox(sandboxId)
    const sandboxInstance = response.data
    const language = sandboxInstance.labels?.['code-toolbox-language'] as CodeLanguage
    const codeToolbox = this.getCodeToolbox(language)
    
    return new Sandbox(sandboxInstance, this.sandboxApi, this.toolboxApi, codeToolbox)
  }

  async findOne(filter: SandboxFilter): Promise<Sandbox> {
    if (filter.id) {
      return this.get(filter.id)
    }
    
    const sandboxes = await this.list(filter.labels)
    if (sandboxes.length === 0) {
      throw new SnapflowError(`No sandbox found with labels ${JSON.stringify(filter.labels)}`)
    }
    
    return sandboxes[0]
  }

  async list(labels?: Record<string, string>): Promise<Sandbox[]> {
    const response = await this.sandboxApi.listSandboxes(
      undefined,
      undefined,
      labels ? JSON.stringify(labels) : undefined
    )
    
    return response.data.map((sandbox: any) => {
      const language = sandbox.labels?.['code-toolbox-language'] as CodeLanguage
      return new Sandbox(sandbox, this.sandboxApi, this.toolboxApi, this.getCodeToolbox(language))
    })
  }

  async start(sandbox: Sandbox, timeout?: number): Promise<void> {
    await sandbox.start(timeout)
  }

  async stop(sandbox: Sandbox): Promise<void> {
    await sandbox.stop()
  }

  async delete(sandbox: Sandbox, timeout = DEFAULT_TIMEOUT): Promise<void> {
    await sandbox.delete(timeout)
  }

  private getCodeToolbox(language?: CodeLanguage): SandboxCodeToolbox {
    if (!language) {
      language = CodeLanguage.TYPESCRIPT
    }
    
    if (!this.codeToolboxCache.has(language)) {
      const toolbox = this.createCodeToolbox(language)
      this.codeToolboxCache.set(language, toolbox)
    }
    
    return this.codeToolboxCache.get(language)!
  }

  private createCodeToolbox(language: CodeLanguage): SandboxCodeToolbox {
    switch (language) {
      case CodeLanguage.JAVASCRIPT:
      case CodeLanguage.TYPESCRIPT:
        return new SandboxTsCodeToolbox()
      default:
        throw new SnapflowError(
          `Unsupported language: ${language}, supported languages: ${Object.values(CodeLanguage).join(', ')}`
        )
    }
  }
}