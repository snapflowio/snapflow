import { Configuration, UsersApi, WorkspacesApi } from "@snapflow/api-client";
import type { AxiosInstance } from "axios";
import axios, { AxiosError } from "axios";
import { SnapflowError } from "./errors";

export class ApiClient {
  public axiosInstance: AxiosInstance;
  private config: Configuration;
  private _userApi: UsersApi;
  private _workspaceApi: WorkspacesApi;

  constructor() {
    this.config = new Configuration({
      basePath: import.meta.env.VITE_API_URL,
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

    this._userApi = new UsersApi(this.config, undefined, this.axiosInstance);
    this._workspaceApi = new WorkspacesApi(this.config, undefined, this.axiosInstance);
  }

  public get userApi(): UsersApi {
    return this._userApi;
  }

  public get workspaceApi(): WorkspacesApi {
    return this._workspaceApi;
  }
}
