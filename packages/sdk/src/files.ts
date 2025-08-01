import { FileInfo, Match, ReplaceRequest, ReplaceResult, SearchFilesResponse, ToolboxApi } from '@snapflow/api-client'
import { prefixRelativePath } from './utils/path'
import * as fs from 'fs'
import { Readable } from 'stream'
import FormData from 'form-data'

export interface FilePermissionsParams {
  readonly group?: string
  readonly mode?: string
  readonly owner?: string
}

export interface FileUpload {
  readonly source: string | Buffer
  readonly destination: string
}

export interface FileOperationOptions {
  readonly timeout?: number
}

export class FileSystem {
  constructor(
    private readonly sandboxId: string,
    private readonly toolboxApi: ToolboxApi,
    private readonly getRootDir: () => Promise<string>,
  ) {}

  public async createFolder(path: string, mode: string): Promise<void> {
    const response = await this.toolboxApi.createFolder(
      this.sandboxId,
      prefixRelativePath(await this.getRootDir(), path),
      mode,
    )
    return response.data
  }

  public async deleteFile(path: string): Promise<void> {
    const response = await this.toolboxApi.deleteFile(this.sandboxId, prefixRelativePath(await this.getRootDir(), path))
    return response.data
  }

  public async downloadFile(remotePath: string, options?: FileOperationOptions): Promise<Buffer>
  public async downloadFile(remotePath: string, localPath: string, options?: FileOperationOptions): Promise<void>
  public async downloadFile(
    src: string, 
    dstOrOptions?: string | FileOperationOptions, 
    options: FileOperationOptions = {}
  ): Promise<Buffer | void> {
    const timeout = options.timeout ?? 30 * 60
    const remotePath = prefixRelativePath(await this.getRootDir(), src)

    if (typeof dstOrOptions !== 'string') {
      const actualOptions = dstOrOptions ?? {}
      const actualTimeout = actualOptions.timeout ?? 30 * 60
      const { data } = await this.toolboxApi.downloadFile(this.sandboxId, remotePath, undefined, {
        responseType: 'arraybuffer',
        timeout: actualTimeout * 1000,
      })

      if (Buffer.isBuffer(data)) {
        return data
      }

      if (data instanceof ArrayBuffer) {
        return Buffer.from(data)
      }

      return Buffer.from(await data.arrayBuffer())
    }

    const localPath = dstOrOptions as string
    const response = await this.toolboxApi.downloadFile(this.sandboxId, remotePath, undefined, {
      responseType: 'stream',
      timeout: timeout * 1000,
    })
    const writer = fs.createWriteStream(localPath)
    ;(response.data as any).pipe(writer)
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve())
      writer.on('error', (err) => reject(err))
    })
  }

  public async findFiles(path: string, pattern: string): Promise<Array<Match>> {
    const response = await this.toolboxApi.findInFiles(
      this.sandboxId,
      prefixRelativePath(await this.getRootDir(), path),
      pattern,
    )
    return response.data
  }

  public async getFileDetails(path: string): Promise<FileInfo> {
    const response = await this.toolboxApi.getFileInfo(
      this.sandboxId,
      prefixRelativePath(await this.getRootDir(), path),
    )
    return response.data
  }

  public async listFiles(path: string): Promise<FileInfo[]> {
    const response = await this.toolboxApi.listFiles(
      this.sandboxId,
      undefined,
      prefixRelativePath(await this.getRootDir(), path),
    )
    return response.data
  }

  public async moveFiles(source: string, destination: string): Promise<void> {
    const response = await this.toolboxApi.moveFile(
      this.sandboxId,
      prefixRelativePath(await this.getRootDir(), source),
      prefixRelativePath(await this.getRootDir(), destination),
    )
    return response.data
  }

  public async replaceInFiles(files: string[], pattern: string, newValue: string): Promise<Array<ReplaceResult>> {
    for (let i = 0; i < files.length; i++) {
      files[i] = prefixRelativePath(await this.getRootDir(), files[i])
    }

    const replaceRequest: ReplaceRequest = {
      files,
      newValue,
      pattern,
    }

    const response = await this.toolboxApi.replaceInFiles(this.sandboxId, replaceRequest)
    return response.data
  }

  public async searchFiles(path: string, pattern: string): Promise<SearchFilesResponse> {
    const response = await this.toolboxApi.searchFiles(
      this.sandboxId,
      prefixRelativePath(await this.getRootDir(), path),
      pattern,
    )
    return response.data
  }

  public async setFilePermissions(path: string, permissions: FilePermissionsParams): Promise<void> {
    if (!permissions.owner || !permissions.group || !permissions.mode) {
      throw new Error('owner, group, and mode are required for setting file permissions')
    }
    
    const response = await this.toolboxApi.setFilePermissions(
      this.sandboxId,
      prefixRelativePath(await this.getRootDir(), path),
      undefined,
      permissions.owner,
      permissions.group,
      permissions.mode,
    )
    return response.data
  }


  public async uploadFile(file: Buffer, remotePath: string, options?: FileOperationOptions): Promise<void>
  public async uploadFile(localPath: string, remotePath: string, options?: FileOperationOptions): Promise<void>
  public async uploadFile(src: string | Buffer, dst: string, options: FileOperationOptions = {}): Promise<void> {
    await this.uploadFiles([{ source: src, destination: dst }], options)
  }

  public async uploadFiles(files: FileUpload[], options: FileOperationOptions = {}): Promise<void> {
    const timeout = options.timeout ?? 30 * 60
    const form = new FormData()
    const rootDir = await this.getRootDir()

    files.forEach(({ source, destination }, i) => {
      const dst = prefixRelativePath(rootDir, destination)
      form.append(`files[${i}].path`, dst)
      const stream = typeof source === 'string' ? fs.createReadStream(source) : Readable.from(source)
      // the third arg sets filename in Content-Disposition
      form.append(`files[${i}].file`, stream as any, dst)
    })

    await this.toolboxApi.uploadFiles(this.sandboxId, undefined, {
      data: form,
      maxRedirects: 0,
      timeout: timeout * 1000,
    })
  }
}