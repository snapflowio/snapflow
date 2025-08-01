import { ExecuteResponse as ClientExecuteResponse } from '@snapflow/api-client'

export interface ExecutionArtifacts {
  readonly stdout: string
}

export interface ExecuteResponse extends ClientExecuteResponse {
  readonly exitCode: number
  readonly result: string
  readonly artifacts?: ExecutionArtifacts
}

export type AsyncFunction<T = void> = () => Promise<T>
export type StreamHandler = (chunk: string) => void