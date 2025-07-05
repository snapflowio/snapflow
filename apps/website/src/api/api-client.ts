import { ApiKeysApi, Configuration, UsersApi } from "@snapflow/api-client";
import axios, { AxiosError } from "axios";
import { SnapflowError } from "./errors";

export class ApiClient {
  private config: Configuration;
  private _userApi: UsersApi;
  private _apiKeyApi: ApiKeysApi;

  constructor(accessToken: string) {
    this.config = new Configuration({
      basePath: import.meta.env.VITE_API_URL,
      accessToken: accessToken,
    });

    const axiosInstance = axios.create();
    axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
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

    this._userApi = new UsersApi(this.config, undefined, axiosInstance);
    this._apiKeyApi = new ApiKeysApi(this.config, undefined, axiosInstance);
  }

  public setAccessToken(accessToken: string) {
    this.config.accessToken = accessToken;
  }

  public get userApi() {
    return this._userApi;
  }

  public get apiKeyApi() {
    return this._apiKeyApi;
  }
}
