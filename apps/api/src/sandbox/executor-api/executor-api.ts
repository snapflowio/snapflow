import { Injectable } from "@nestjs/common";
import {
  Configuration,
  DefaultApi,
  ImagesApi,
  SandboxApi,
  ToolboxApi,
} from "@snapflow/executor-api-client";
import axios from "axios";
import axiosDebug from "axios-debug-log";
import { Executor } from "../entities/executor.entity";

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
export class ExecutorApiFactory {
  createExecutorApi(executor: Executor): DefaultApi {
    const axiosInstance = axios.create({
      baseURL: executor.apiUrl,
      headers: {
        Authorization: `Bearer ${executor.apiKey}`,
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

  createImageApi(executor: Executor): ImagesApi {
    const axiosInstance = axios.create({
      baseURL: executor.apiUrl,
      headers: {
        Authorization: `Bearer ${executor.apiKey}`,
      },
      timeout: 1 * 60 * 60 * 1000,
    });

    if (isDebugEnabled) axiosDebug.addLogger(axiosInstance);

    return new ImagesApi(new Configuration(), "", axiosInstance);
  }

  createSandboxApi(executor: Executor): SandboxApi {
    const axiosInstance = axios.create({
      baseURL: executor.apiUrl,
      headers: {
        Authorization: `Bearer ${executor.apiKey}`,
      },
      timeout: 1 * 60 * 60 * 1000,
    });

    if (isDebugEnabled) axiosDebug.addLogger(axiosInstance);

    return new SandboxApi(new Configuration(), "", axiosInstance);
  }

  createToolboxApi(executor: Executor): ToolboxApi {
    const axiosInstance = axios.create({
      baseURL: executor.apiUrl,
      headers: {
        Authorization: `Bearer ${executor.apiKey}`,
      },
      timeout: 1 * 60 * 60 * 1000,
    });

    if (isDebugEnabled) axiosDebug.addLogger(axiosInstance);

    return new ToolboxApi(new Configuration(), "", axiosInstance);
  }
}
