/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiKeysApi,
	AuthApi,
	BillingApi,
	BucketsApi,
	Configuration,
	ImagesApi,
	OauthApi,
	OrganizationsApi,
	RegistryApi,
	SandboxApi,
} from '@snapflow/api-client';
import axios, { AxiosError, type AxiosInstance } from 'axios';
import { env } from '@/env';
import { SnapflowError } from './errors';

export class ApiClient {
	public axiosInstance: AxiosInstance;
	private config: Configuration;
	private _authApi: AuthApi;
	private _imageApi: ImagesApi;
	private _sandboxApi: SandboxApi;
	private _apiKeyApi: ApiKeysApi;
	private _registryApi: RegistryApi;
	private _organizationsApi: OrganizationsApi;
	private _bucketApi: BucketsApi;
	private _oauthApi: OauthApi;
	private _billingApi: BillingApi;

	private _refreshPromise: Promise<unknown> | null = null;
	private _onAuthFailure: (() => void) | null = null;

	constructor() {
		this.config = new Configuration({
			basePath: env.VITE_API_URL,
		});

		this.axiosInstance = axios.create({
			withCredentials: true,
		});

		this.axiosInstance.interceptors.response.use(
			(response) => response,
			async (error) => {
				const originalRequest = error.config;

				if (
					error instanceof AxiosError &&
					error.response?.status === 401 &&
					!originalRequest._retry &&
					!originalRequest.url?.includes('/auth/refresh') &&
					!originalRequest.url?.includes('/auth/sign-in') &&
					!originalRequest.url?.includes('/auth/sign-up') &&
					!originalRequest.url?.includes('/oauth/')
				) {
					originalRequest._retry = true;

					try {
						// Queue behind existing refresh or start a new one
						if (!this._refreshPromise) {
							this._refreshPromise = this.axiosInstance
								.post(`${env.VITE_API_URL}/auth/refresh`)
								.finally(() => {
									this._refreshPromise = null;
								});
						}

						await this._refreshPromise;
						return this.axiosInstance(originalRequest);
					} catch {
						this._onAuthFailure?.();
						return Promise.reject(error);
					}
				}

				if (
					error instanceof AxiosError &&
					error.response?.status === 401 &&
					(originalRequest.url?.includes('/auth/') ||
						originalRequest.url?.includes('/oauth/'))
				) {
					let errorMessage: string;

					if (
						error instanceof AxiosError &&
						error.message.includes('timeout of')
					) {
						errorMessage = 'Operation timed out';
					} else {
						errorMessage =
							error.response?.data?.message ||
							error.response?.data ||
							error.message ||
							String(error);
					}

					throw SnapflowError.fromString(String(errorMessage));
				}

				let errorMessage: string;

				if (
					error instanceof AxiosError &&
					error.message.includes('timeout of')
				) {
					errorMessage = 'Operation timed out';
				} else {
					errorMessage =
						error.response?.data?.message ||
						error.response?.data ||
						error.message ||
						String(error);
				}

				throw SnapflowError.fromString(String(errorMessage));
			}
		);

		this._authApi = new AuthApi(this.config, undefined, this.axiosInstance);
		this._imageApi = new ImagesApi(this.config, undefined, this.axiosInstance);
		this._sandboxApi = new SandboxApi(
			this.config,
			undefined,
			this.axiosInstance
		);
		this._apiKeyApi = new ApiKeysApi(
			this.config,
			undefined,
			this.axiosInstance
		);
		this._registryApi = new RegistryApi(
			this.config,
			undefined,
			this.axiosInstance
		);
		this._organizationsApi = new OrganizationsApi(
			this.config,
			undefined,
			this.axiosInstance
		);
		this._bucketApi = new BucketsApi(
			this.config,
			undefined,
			this.axiosInstance
		);
		this._oauthApi = new OauthApi(this.config, undefined, this.axiosInstance);
		this._billingApi = new BillingApi(
			this.config,
			undefined,
			this.axiosInstance
		);
	}

	public onAuthFailure(callback: () => void) {
		this._onAuthFailure = callback;
	}

	public setToken(token: string | null) {
		if (token) {
			this.axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
		} else {
			this.axiosInstance.defaults.headers.common.Authorization = null;
		}
	}

	public get authApi(): AuthApi {
		return this._authApi;
	}

	public get imageApi(): ImagesApi {
		return this._imageApi;
	}

	public get sandboxApi(): SandboxApi {
		return this._sandboxApi;
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

	public get oauthApi(): OauthApi {
		return this._oauthApi;
	}

	public get billingApi(): BillingApi {
		return this._billingApi;
	}
}

export const apiClient = new ApiClient();
