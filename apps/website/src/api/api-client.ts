import {
  ApiKeysApi,
  Configuration,
  DockerRegistryApi,
  OrganizationsApi,
  SandboxApi,
  SnapshotsApi,
  UsersApi,
  VolumesApi,
} from "@snapflow/api-client";
import axios, { AxiosError, AxiosInstance } from "axios";
import { SnapflowError } from "./errors";

export class ApiClient {
  private config: Configuration;
  private axiosInstance: AxiosInstance;
  private _snapshotApi: SnapshotsApi;
  private _sandboxApi: SandboxApi;
  private _userApi: UsersApi;
  private _apiKeyApi: ApiKeysApi;
  private _dockerRegistryApi: DockerRegistryApi;
  private _organizationsApi: OrganizationsApi;
  private _volumeApi: VolumesApi;

  constructor(accessToken: string) {
    this.config = new Configuration({
      basePath: import.meta.env.VITE_API_URL,
      accessToken,
    });

    this.axiosInstance = axios.create();
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        let errorMessage: string;

        if (error instanceof AxiosError && error.message.includes("timeout of")) {
          errorMessage = "Operation timed out";
        } else {
          errorMessage =
            error.response?.data?.message || error.response?.data || error.message || String(error);
        }

        throw SnapflowError.fromString(String(errorMessage));
      }
    );

    this._snapshotApi = new SnapshotsApi(this.config, undefined, this.axiosInstance);
    this._sandboxApi = new SandboxApi(this.config, undefined, this.axiosInstance);
    this._userApi = new UsersApi(this.config, undefined, this.axiosInstance);
    this._apiKeyApi = new ApiKeysApi(this.config, undefined, this.axiosInstance);
    this._dockerRegistryApi = new DockerRegistryApi(this.config, undefined, this.axiosInstance);
    this._organizationsApi = new OrganizationsApi(this.config, undefined, this.axiosInstance);
    this._volumeApi = new VolumesApi(this.config, undefined, this.axiosInstance);
  }

  public setAccessToken(accessToken: string): void {
    this.config.accessToken = accessToken;
  }

  public get snapshotApi(): SnapshotsApi {
    return this._snapshotApi;
  }

  public get sandboxApi(): SandboxApi {
    return this._sandboxApi;
  }

  public get userApi(): UsersApi {
    return this._userApi;
  }

  public get apiKeyApi(): ApiKeysApi {
    return this._apiKeyApi;
  }

  public get dockerRegistryApi(): DockerRegistryApi {
    return this._dockerRegistryApi;
  }

  public get organizationsApi(): OrganizationsApi {
    return this._organizationsApi;
  }

  public get volumeApi(): VolumesApi {
    return this._volumeApi;
  }
}
