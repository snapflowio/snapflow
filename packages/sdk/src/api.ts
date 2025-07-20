import {
  Configuration,
  ImagesApi,
  SandboxApi,
  SandboxState,
  ToolboxApi,
  BucketsApi,
  SandboxBucket,
} from '@snapflow/api-client'
import axios, { AxiosError } from 'axios'
import * as dotenv from 'dotenv'
import { SandboxTsCodeToolbox } from './sandboxes/typescript'
import { SnapflowError } from './error'
import { Sandbox } from './sandbox'
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

export class Snapflow {
  private readonly sandboxApi: SandboxApi
  private readonly toolboxApi: ToolboxApi
  private readonly target?: string
  private readonly apiKey?: string
  private readonly jwtToken?: string
  private readonly organizationId?: string
  private readonly apiUrl: string

  constructor(config?: SnapflowConfig) {
    let apiUrl: string | undefined
    if (config) {
      this.apiKey = !config?.apiKey && config?.jwtToken ? undefined : config?.apiKey
      this.jwtToken = config?.jwtToken
      this.organizationId = config?.organizationId
      apiUrl = config?.apiUrl || config?.serverUrl
      this.target = config?.target
    }

    if (
      !config ||
      (!(this.apiKey && apiUrl && this.target) && !(this.jwtToken && this.organizationId && apiUrl && this.target))
    ) {
      dotenv.config({ path: '.env.local', override: true})
      this.apiKey = this.apiKey || (this.jwtToken ? undefined : process?.env['snapflow_API_KEY'])
      this.jwtToken = this.jwtToken || process?.env['snapflow_JWT_TOKEN']
      this.organizationId = this.organizationId || process?.env['snapflow_ORGANIZATION_ID']
      apiUrl =
        apiUrl || process?.env['snapflow_API_URL'] || process?.env['snapflow_SERVER_URL'] || 'https://app.snapflow.io/api'
      this.target = this.target || process?.env['snapflow_TARGET']

      if (process?.env['snapflow_SERVER_URL'] && !process?.env['snapflow_API_URL']) {
        console.warn(
          '[Deprecation Warning] Environment variable `snapflow_SERVER_URL` is deprecated and will be removed in future versions. Use `snapflow_API_URL` instead.',
        )
      }
    }

    this.apiUrl = apiUrl

    const orgHeader: Record<string, string> = {}
    if (!this.apiKey) {
      if (!this.organizationId) {
        throw new SnapflowError('Organization ID is required when using JWT token')
      }
      orgHeader['X-Snapflow-Organization-ID'] = this.organizationId
    }

    const configuration = new Configuration({
      basePath: this.apiUrl,
      baseOptions: {
        headers: {
          Authorization: `Bearer ${this.apiKey || this.jwtToken}`,
          'X-Snapflow-Source': 'typescript-sdk',
          'X-Snapflow-SDK-Version': packageJson.version,
          ...orgHeader,
        },
      },
    })

    const axiosInstance = axios.create({
      timeout: 24 * 60 * 60 * 1000,
    })
    axiosInstance.interceptors.response.use(
      (response) => {
        return response
      },
      (error) => {
        let errorMessage: string

        if (error instanceof AxiosError && error.message.includes('timeout of')) {
          errorMessage = 'Operation timed out'
        } else {
          errorMessage = error.response?.data?.message || error.response?.data || error.message || String(error)
        }

        try {
          errorMessage = JSON.stringify(errorMessage)
        } catch {
          errorMessage = String(errorMessage)
        }

        switch (error.response?.data?.statusCode) {
          case 404:
            throw new SnapflowError(errorMessage)
          default:
            throw new SnapflowError(errorMessage)
        }
      },
    )

    this.sandboxApi = new SandboxApi(configuration, '', axiosInstance)
    this.toolboxApi = new ToolboxApi(configuration, '', axiosInstance)
  }

  public async create(params?: CreateSandboxFromSnapshotParams, options?: { timeout?: number }): Promise<Sandbox>
  public async create(
    params?: CreateSandboxFromImageParams,
    options?: { onSnapshotCreateLogs?: (chunk: string) => void; timeout?: number },
  ): Promise<Sandbox>
  public async create(
    params?: CreateSandboxFromSnapshotParams | CreateSandboxFromImageParams,
    options: { onSnapshotCreateLogs?: (chunk: string) => void; timeout?: number } = { timeout: 60 },
  ): Promise<Sandbox> {
    const startTime = Date.now()

    options = typeof options === 'number' ? { timeout: options } : { ...options }
    if (options.timeout == undefined || options.timeout == null) {
      options.timeout = 60
    }

    if (params == null) {
      params = { language: 'python' }
    }

    const labels = params.labels || {}
    if (params.language) {
      labels['code-toolbox-language'] = params.language
    }

    if (options.timeout < 0) {
      throw new SnapflowError('Timeout must be a non-negative number')
    }

    if (
      params.autoStopInterval !== undefined &&
      (!Number.isInteger(params.autoStopInterval) || params.autoStopInterval < 0)
    ) {
      throw new SnapflowError('autoStopInterval must be a non-negative integer')
    }

    if (
      params.autoArchiveInterval !== undefined &&
      (!Number.isInteger(params.autoArchiveInterval) || params.autoArchiveInterval < 0)
    ) {
      throw new SnapflowError('autoArchiveInterval must be a non-negative integer')
    }

    const codeToolbox = this.getCodeToolbox(params.language as CodeLanguage)

    try {
      let buildInfo: any | undefined
      let image: string | undefined
      let resources: Resources | undefined

      if ('resources' in params) {
        resources = params.resources
      }

      const response = await this.sandboxApi.createSandbox(
        {
          image: image,
          buildInfo,
          user: params.user,
          env: params.envVars || {},
          labels: labels,
          public: params.public,
          cpu: resources?.cpu,
          gpu: resources?.gpu,
          memory: resources?.memory,
          disk: resources?.disk,
          autoStopInterval: params.autoStopInterval,
          autoArchiveInterval: params.autoArchiveInterval,
          buckets: params.volumes,
        },
        undefined,
        {
          timeout: options.timeout * 1000,
        },
      )

      let sandboxInstance = response.data

      if (sandboxInstance.state === SandboxState.PENDING_BUILD && options.onSnapshotCreateLogs) {
        const terminalStates: SandboxState[] = [
          SandboxState.STARTED,
          SandboxState.STARTING,
          SandboxState.ERROR,
          SandboxState.BUILD_FAILED,
        ]

        while (sandboxInstance.state === SandboxState.PENDING_BUILD) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          sandboxInstance = (await this.sandboxApi.getSandbox(sandboxInstance.id)).data
        }

        await processStreamingResponse(
          () => this.sandboxApi.getBuildLogs(sandboxInstance.id, undefined, true, { responseType: 'stream' }),
          (chunk) => options.onSnapshotCreateLogs?.(chunk.trimEnd()),
          async () => {
            sandboxInstance = (await this.sandboxApi.getSandbox(sandboxInstance.id)).data
            return sandboxInstance.state !== undefined && terminalStates.includes(sandboxInstance.state)
          },
        )
      }

      const sandbox = new Sandbox(sandboxInstance, this.sandboxApi, this.toolboxApi, codeToolbox)

      if (sandbox.state !== 'started') {
        const timeElapsed = Date.now() - startTime
        await sandbox.waitUntilStarted(options.timeout ? options.timeout - timeElapsed / 1000 : 0)
      }

      return sandbox
    } catch (error) {
      if (error instanceof SnapflowError && error.message.includes('Operation timed out')) {
        const errMsg = `Failed to create and start sandbox within ${options.timeout} seconds. Operation timed out.`
        throw new SnapflowError(errMsg)
      }
      throw error
    }
  }

  public async get(sandboxId: string): Promise<Sandbox> {
    const response = await this.sandboxApi.getSandbox(sandboxId)
    const sandboxInstance = response.data
    const language = sandboxInstance.labels && sandboxInstance.labels['code-toolbox-language']
    const codeToolbox = this.getCodeToolbox(language as CodeLanguage)

    return new Sandbox(sandboxInstance, this.sandboxApi, this.toolboxApi, codeToolbox)
  }

  public async findOne(filter: SandboxFilter): Promise<Sandbox> {
    if (filter.id) {
      return this.get(filter.id)
    }

    const sandboxes = await this.list(filter.labels)
    if (sandboxes.length === 0) {
      const errMsg = `No sandbox found with labels ${JSON.stringify(filter.labels)}`
      throw new SnapflowError(errMsg)
    }
    return sandboxes[0]
  }

  public async list(labels?: Record<string, string>): Promise<Sandbox[]> {
    const response = await this.sandboxApi.listSandboxes(
      undefined,
      undefined,
      labels ? JSON.stringify(labels) : undefined,
    )
    return response.data.map((sandbox) => {
      const language = sandbox.labels?.['code-toolbox-language'] as CodeLanguage

      return new Sandbox(sandbox, this.sandboxApi, this.toolboxApi, this.getCodeToolbox(language))
    })
  }

  public async start(sandbox: Sandbox, timeout?: number) {
    await sandbox.start(timeout)
  }

  public async stop(sandbox: Sandbox) {
    await sandbox.stop()
  }

  public async delete(sandbox: Sandbox, timeout = 60) {
    await sandbox.delete(timeout)
  }

  private getCodeToolbox(language?: CodeLanguage) {
    switch (language) {
      case CodeLanguage.JAVASCRIPT:
      case CodeLanguage.TYPESCRIPT:
        return new SandboxTsCodeToolbox()
        default: {
        const errMsg = `Unsupported language: ${language}, supported languages: ${Object.values(CodeLanguage).join(', ')}`
        throw new SnapflowError(errMsg)
      }
    }
  }
}