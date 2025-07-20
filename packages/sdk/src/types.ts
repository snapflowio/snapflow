import { ExecuteResponse as ClientExecuteResponse } from '@snapflow/api-client'

export interface ExecutionArtifacts {
  stdout: string
}

export interface ExecuteResponse extends ClientExecuteResponse {
  exitCode: number
  result: string
  artifacts?: ExecutionArtifacts
}