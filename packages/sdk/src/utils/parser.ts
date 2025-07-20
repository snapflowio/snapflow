import { ExecutionArtifacts } from '../types'

export class ArtifactParser {
  public static parseArtifacts(output: string): ExecutionArtifacts {
    let stdout = output

    const lines = output.split('\n')
    const artifactLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('dtn_artifact_k39fd2:')) {
        artifactLines.push(line)
      }
    }

    for (const line of artifactLines) {
      stdout = stdout.replace(line + '\n', '')
      stdout = stdout.replace(line, '')
    }

    return {
      stdout
    }
  }
}