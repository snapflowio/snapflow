import {
  ApiKeysApi,
  BucketsApi,
  Configuration,
  ImagesApi,
  OrganizationsApi,
  RegistryApi,
  SandboxApi,
  ToolboxApi,
  UsersApi,
} from "@snapflow/api-client";
import axios, { AxiosError, AxiosInstance } from "axios";
import { SnapflowError } from "./errors";

export class ApiClient {
  private config: Configuration;
  private axiosInstance: AxiosInstance;
  private _imageApi: ImagesApi;
  private _sandboxApi: SandboxApi;
  private _userApi: UsersApi;
  private _apiKeyApi: ApiKeysApi;
  private _registryApi: RegistryApi;
  private _organizationsApi: OrganizationsApi;
  private _bucketApi: BucketsApi;
  private _toolboxApi: ToolboxApi;

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

    this._imageApi = new ImagesApi(this.config, undefined, this.axiosInstance);
    this._sandboxApi = new SandboxApi(this.config, undefined, this.axiosInstance);
    this._userApi = new UsersApi(this.config, undefined, this.axiosInstance);
    this._apiKeyApi = new ApiKeysApi(this.config, undefined, this.axiosInstance);
    this._registryApi = new RegistryApi(this.config, undefined, this.axiosInstance);
    this._organizationsApi = new OrganizationsApi(this.config, undefined, this.axiosInstance);
    this._bucketApi = new BucketsApi(this.config, undefined, this.axiosInstance);
    this._toolboxApi = new ToolboxApi(this.config, undefined, this.axiosInstance);
  }

  public setAccessToken(accessToken: string): void {
    this.config.accessToken = accessToken;
  }

  public get imageApi(): ImagesApi {
    return this._imageApi;
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

  public get registryApi(): RegistryApi {
    return this._registryApi;
  }

  public get organizationsApi(): OrganizationsApi {
    return this._organizationsApi;
  }

  public get bucketApi(): BucketsApi {
    return this._bucketApi;
  }

  public get toolboxApi() {
    return this._toolboxApi;
  }
}
