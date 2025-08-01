import { Command, Session, SessionExecuteRequest, SessionExecuteResponse, ToolboxApi } from '@snapflow/api-client'
import { SandboxCodeToolbox } from './sandbox'
import { ExecuteResponse, AsyncFunction, StreamHandler } from './types'
import { processStreamingResponse } from './utils/stream'
import { ArtifactParser } from './utils/parser'
import { SnapflowError } from './error'

export interface CodeRunParams {
  readonly argv?: string[]
  readonly env?: Record<string, string>
}

export interface ProcessExecuteOptions {
  readonly cwd?: string
  readonly env?: Record<string, string>
  readonly timeout?: number
}

export class Process {
  constructor(
    private readonly sandboxId: string,
    private readonly codeToolbox: SandboxCodeToolbox,
    private readonly toolboxApi: ToolboxApi,
    private readonly getRootDir: () => Promise<string>,
  ) {}

  public async executeCommand(
    command: string,
    options: ProcessExecuteOptions = {},
  ): Promise<ExecuteResponse> {
    const { cwd, env, timeout } = options
    const processedCommand = this.prepareCommand(command, env)

    try {
      const response = await this.toolboxApi.executeCommand(this.sandboxId, {
        command: processedCommand,
        timeout,
        cwd: cwd ?? (await this.getRootDir()),
      })

      const artifacts = ArtifactParser.parseArtifacts(response.data.result)

      return {
        ...response.data,
        result: artifacts.stdout,
        artifacts,
      }
    } catch (error) {
      throw new SnapflowError(
        `Failed to execute command: ${command}`,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  public async codeRun(code: string, params?: CodeRunParams, timeout?: number): Promise<ExecuteResponse> {
    const runCommand = this.codeToolbox.getRunCommand(code, params)
    return this.executeCommand(runCommand, {
      env: params?.env,
      timeout,
    })
  }

  private prepareCommand(command: string, env?: Record<string, string>): string {
    const base64UserCmd = Buffer.from(command).toString('base64')
    let processedCommand = `echo '${base64UserCmd}' | base64 -d | sh`

    if (env && Object.keys(env).length > 0) {
      const safeEnvExports = Object.entries(env)
        .map(([key, value]) => {
          const encodedValue = Buffer.from(value).toString('base64')
          return `export ${key}=$(echo '${encodedValue}' | base64 -d)`
        })
        .join(';') + ';'
      processedCommand = `${safeEnvExports} ${processedCommand}`
    }

    return `sh -c "${processedCommand}"`
  }

  public async createSession(sessionId: string): Promise<void> {
    await this.toolboxApi.createSession(this.sandboxId, {
      sessionId,
    })
  }

  public async getSession(sessionId: string): Promise<Session> {
    const response = await this.toolboxApi.getSession(this.sandboxId, sessionId)
    return response.data
  }

  public async getSessionCommand(sessionId: string, commandId: string): Promise<Command> {
    const response = await this.toolboxApi.getSessionCommand(this.sandboxId, sessionId, commandId)
    return response.data
  }

  public async executeSessionCommand(
    sessionId: string,
    req: SessionExecuteRequest,
    timeout?: number,
  ): Promise<SessionExecuteResponse> {
    const response = await this.toolboxApi.executeSessionCommand(
      this.sandboxId,
      sessionId,
      req,
      undefined,
      timeout ? { timeout: timeout * 1000 } : {},
    )
    return response.data
  }


  public async getSessionCommandLogs(sessionId: string, commandId: string): Promise<string>
  public async getSessionCommandLogs(
    sessionId: string,
    commandId: string,
    onLogs: (chunk: string) => void,
  ): Promise<void>
  public async getSessionCommandLogs(
    sessionId: string,
    commandId: string,
    onLogs?: StreamHandler,
  ): Promise<string | void> {
    if (!onLogs) {
      const response = await this.toolboxApi.getSessionCommandLogs(this.sandboxId, sessionId, commandId)
      return response.data
    }

    await processStreamingResponse(
      () =>
        this.toolboxApi.getSessionCommandLogs(this.sandboxId, sessionId, commandId, undefined, true, {
          responseType: 'stream',
        }),
      onLogs,
      () =>
        this.getSessionCommand(sessionId, commandId).then((res) => res.exitCode !== null && res.exitCode !== undefined),
    )
  }

  public async listSessions(): Promise<Session[]> {
    const response = await this.toolboxApi.listSessions(this.sandboxId)
    return response.data
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.toolboxApi.deleteSession(this.sandboxId, sessionId)
  }
}