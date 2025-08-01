import { CompletionList, LspSymbol, ToolboxApi } from '@snapflow/api-client'
import { prefixRelativePath } from './utils/path'

export enum LspLanguageId {
  PYTHON = 'python',
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
}

export interface Position {
  readonly line: number
  readonly character: number
}

export class LspServer {
  constructor(
    private readonly languageId: LspLanguageId,
    private readonly pathToProject: string,
    private readonly toolboxApi: ToolboxApi,
    private readonly sandboxId: string,
  ) {
    this.validateLanguageId()
  }

  private validateLanguageId(): void {
    if (!Object.values(LspLanguageId).includes(this.languageId)) {
      throw new Error(
        `Invalid languageId: ${this.languageId}. Supported values are: ${Object.values(LspLanguageId).join(', ')}`,
      )
    }
  }

  public async start(): Promise<void> {
    await this.toolboxApi.lspStart(this.sandboxId, {
      languageId: this.languageId,
      pathToProject: this.pathToProject,
    })
  }

  public async stop(): Promise<void> {
    await this.toolboxApi.lspStop(this.sandboxId, {
      languageId: this.languageId,
      pathToProject: this.pathToProject,
    })
  }

  public async didOpen(path: string): Promise<void> {
    await this.toolboxApi.lspDidOpen(this.sandboxId, {
      languageId: this.languageId,
      pathToProject: this.pathToProject,
      uri: this.createFileUri(path),
    })
  }

  public async didClose(path: string): Promise<void> {
    await this.toolboxApi.lspDidClose(this.sandboxId, {
      languageId: this.languageId,
      pathToProject: this.pathToProject,
      uri: this.createFileUri(path),
    })
  }

  private createFileUri(path: string): string {
    return 'file://' + prefixRelativePath(this.pathToProject, path)
  }

  public async documentSymbols(path: string): Promise<LspSymbol[]> {
    const response = await this.toolboxApi.lspDocumentSymbols(
      this.sandboxId,
      this.languageId,
      this.pathToProject,
      this.createFileUri(path),
    )
    return response.data
  }

  public async workspaceSymbols(query: string): Promise<LspSymbol[]> {
    return this.sandboxSymbols(query)
  }

  public async sandboxSymbols(query: string): Promise<LspSymbol[]> {
    const response = await this.toolboxApi.lspWorkspaceSymbols(
      this.sandboxId,
      this.languageId,
      this.pathToProject,
      query,
    )
    return response.data
  }

  public async completions(path: string, position: Position): Promise<CompletionList> {
    const response = await this.toolboxApi.lspCompletions(this.sandboxId, {
      languageId: this.languageId,
      pathToProject: this.pathToProject,
      uri: this.createFileUri(path),
      position,
    })
    return response.data
  }
}