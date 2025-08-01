import { ExecutionArtifacts } from '../types'

export class ArtifactParser {
  private static readonly ARTIFACT_PREFIX = 'dtn_artifact_k39fd2:'

  public static parseArtifacts(output: string): ExecutionArtifacts {
    const lines = output.split('\n')
    const artifactLines = this.extractArtifactLines(lines)
    const stdout = this.removeArtifactLines(output, artifactLines)

    return { stdout }
  }

  private static extractArtifactLines(lines: string[]): string[] {
    return lines.filter(line => line.startsWith(this.ARTIFACT_PREFIX))
  }

  private static removeArtifactLines(output: string, artifactLines: string[]): string {
    return artifactLines.reduce((result, line) => {
      return result
        .replace(line + '\n', '')
        .replace(line, '')
    }, output)
  }
}