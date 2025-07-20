import { ToolboxApi, ListBranchResponse, GitStatus } from '@snapflow/api-client'
import { prefixRelativePath } from './utils/path'

export interface GitCommitResponse {
  sha: string
}

export class Git {
  constructor(
    private readonly sandboxId: string,
    private readonly toolboxApi: ToolboxApi,
    private readonly getRootDir: () => Promise<string>,
  ) {}

  public async add(path: string, files: string[]): Promise<void> {
    await this.toolboxApi.gitAddFiles(this.sandboxId, {
      path: prefixRelativePath(await this.getRootDir(), path),
      files,
    })
  }

  public async branches(path: string): Promise<ListBranchResponse> {
    const response = await this.toolboxApi.gitListBranches(
      this.sandboxId,
      prefixRelativePath(await this.getRootDir(), path),
    )
    return response.data
  }

  public async createBranch(path: string, name: string): Promise<void> {
    await this.toolboxApi.gitCreateBranch(this.sandboxId, {
      path: prefixRelativePath(await this.getRootDir(), path),
      name,
    })
    return
  }

  public async deleteBranch(path: string, name: string): Promise<void> {
    await this.toolboxApi.gitDeleteBranch(this.sandboxId, {
      path: prefixRelativePath(await this.getRootDir(), path),
      name,
    })
    return
  }

  public async checkoutBranch(path: string, branch: string): Promise<void> {
    await this.toolboxApi.gitCheckoutBranch(this.sandboxId, {
      path: prefixRelativePath(await this.getRootDir(), path),
      branch,
    })
    return
  }

  public async clone(
    url: string,
    path: string,
    branch?: string,
    commitId?: string,
    username?: string,
    password?: string,
  ): Promise<void> {
    await this.toolboxApi.gitCloneRepository(this.sandboxId, {
      url: url,
      branch: branch,
      path: prefixRelativePath(await this.getRootDir(), path),
      username,
      password,
      commit_id: commitId,
    })
  }

  public async commit(path: string, message: string, author: string, email: string): Promise<GitCommitResponse> {
    const response = await this.toolboxApi.gitCommitChanges(this.sandboxId, {
      path: prefixRelativePath(await this.getRootDir(), path),
      message,
      author,
      email,
    })
    return {
      sha: response.data.hash,
    }
  }

  public async push(path: string, username?: string, password?: string): Promise<void> {
    await this.toolboxApi.gitPushChanges(this.sandboxId, {
      path: prefixRelativePath(await this.getRootDir(), path),
      username,
      password,
    })
  }

  public async pull(path: string, username?: string, password?: string): Promise<void> {
    await this.toolboxApi.gitPullChanges(this.sandboxId, {
      path: prefixRelativePath(await this.getRootDir(), path),
      username,
      password,
    })
  }

  public async status(path: string): Promise<GitStatus> {
    const response = await this.toolboxApi.gitGetStatus(
      this.sandboxId,
      prefixRelativePath(await this.getRootDir(), path),
    )

    return response.data
  }
}