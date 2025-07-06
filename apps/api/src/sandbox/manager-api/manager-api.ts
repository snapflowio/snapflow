import { Injectable } from "@nestjs/common";
import {
  Configuration,
  DefaultApi,
  SandboxApi,
  SnapshotsApi,
  ToolboxApi,
} from "@snapflow/manager-api-client";
import axios from "axios";
import axiosDebug from "axios-debug-log";
import { Runner } from "../entities/runner.entity";

const isDebugEnabled = process.env.DEBUG === "true";

if (isDebugEnabled) {
  axiosDebug({
    request: (debug, config) => {
      debug(`Request with ${JSON.stringify(config)}`);
      return config;
    },
    response: (debug, response) => {
      debug(`Response with ${response}`);
      return response;
    },
    error: (debug, error) => {
      debug(`Error with ${error}`);
      return Promise.reject(error);
    },
  });
}

@Injectable()
export class RunnerApiFactory {
  createRunnerApi(runner: Runner): DefaultApi {
    const axiosInstance = axios.create({
      baseURL: runner.apiUrl,
      headers: {
        Authorization: `Bearer ${runner.apiKey}`,
      },
      timeout: 1 * 60 * 60 * 1000,
    });

    axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        const errorMessage =
          error.response?.data?.message || error.response?.data || error.message || String(error);

        throw new Error(String(errorMessage));
      }
    );

    if (isDebugEnabled) axiosDebug.addLogger(axiosInstance);

    return new DefaultApi(new Configuration(), "", axiosInstance);
  }

  createSnapshotApi(runner: Runner): SnapshotsApi {
    const axiosInstance = axios.create({
      baseURL: runner.apiUrl,
      headers: {
        Authorization: `Bearer ${runner.apiKey}`,
      },
      timeout: 1 * 60 * 60 * 1000,
    });

    if (isDebugEnabled) axiosDebug.addLogger(axiosInstance);

    return new SnapshotsApi(new Configuration(), "", axiosInstance);
  }

  createSandboxApi(runner: Runner): SandboxApi {
    const axiosInstance = axios.create({
      baseURL: runner.apiUrl,
      headers: {
        Authorization: `Bearer ${runner.apiKey}`,
      },
      timeout: 1 * 60 * 60 * 1000,
    });

    if (isDebugEnabled) axiosDebug.addLogger(axiosInstance);

    return new SandboxApi(new Configuration(), "", axiosInstance);
  }

  createToolboxApi(runner: Runner): ToolboxApi {
    const axiosInstance = axios.create({
      baseURL: runner.apiUrl,
      headers: {
        Authorization: `Bearer ${runner.apiKey}`,
      },
      timeout: 1 * 60 * 60 * 1000,
    });

    if (isDebugEnabled) axiosDebug.addLogger(axiosInstance);

    return new ToolboxApi(new Configuration(), "", axiosInstance);
  }
}
