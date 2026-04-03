/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Copyright 2025 Snapflow
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	type CreateImage,
	type Image,
	ImageState,
	type ImagesApi,
} from '@snapflow/api-client';
import { SnapflowError } from '../errors';
import { processStreamingResponse } from '../utils/stream';

export interface CreateImageParams {
	readonly name: string;
	readonly imageName?: string;
	readonly entrypoint?: string[];
	readonly cpu?: number;
	readonly gpu?: number;
	readonly memory?: number;
	readonly disk?: number;
}

export interface CreateImageOptions {
	readonly onBuildLogs?: (chunk: string) => void;
	readonly timeout?: number;
}

const DEFAULT_IMAGE_TIMEOUT = 300;
const POLL_INTERVAL = 1000;

export class ImageService {
	constructor(private readonly imagesApi: ImagesApi) {}

	public async list(page?: number, limit?: number): Promise<Image[]> {
		const response = await this.imagesApi.listImages(undefined, page, limit);
		return response.data.items;
	}

	public async get(id: string): Promise<Image> {
		const response = await this.imagesApi.getImage(id);
		return response.data;
	}

	public async create(
		params: CreateImageParams,
		options: CreateImageOptions = {}
	): Promise<Image> {
		const timeout = options.timeout ?? DEFAULT_IMAGE_TIMEOUT;

		const createParams: CreateImage = {
			name: params.name,
			imageName: params.imageName,
			entrypoint: params.entrypoint,
			cpu: params.cpu,
			gpu: params.gpu,
			memory: params.memory,
			disk: params.disk,
		};

		const response = await this.imagesApi.createImage(createParams);
		let image = response.data;

		if (options.onBuildLogs) {
			image = await this.streamBuildLogs(image, options.onBuildLogs);
		}

		return this.waitUntilActive(image.id, timeout);
	}

	public async delete(image: Image): Promise<void> {
		await this.imagesApi.deleteImage(image.id);
	}

	public async activate(image: Image): Promise<void> {
		await this.imagesApi.activateImage(image.id);
	}

	public async deactivate(image: Image): Promise<void> {
		await this.imagesApi.deactivateImage(image.id);
	}

	private async waitUntilActive(
		imageId: string,
		timeout: number
	): Promise<Image> {
		const terminalStates: ImageState[] = [
			ImageState.ACTIVE,
			ImageState.INACTIVE,
			ImageState.ERROR,
			ImageState.BUILD_FAILED,
		];

		const startTime = Date.now();
		const timeoutMs = timeout * 1000;
		let image: Image | undefined;

		do {
			const response = await this.imagesApi.getImage(imageId);
			image = response.data;

			if (terminalStates.includes(image.state)) {
				if (
					image.state === ImageState.ERROR ||
					image.state === ImageState.BUILD_FAILED
				) {
					throw new SnapflowError(
						`Image failed with state: ${image.state}${image.errorReason ? `, reason: ${image.errorReason}` : ''}`
					);
				}
				return image;
			}

			if (timeout !== 0 && Date.now() - startTime > timeoutMs) {
				throw new SnapflowError(
					`Image did not become active within ${timeout} seconds`
				);
			}

			await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL));
		} while (!terminalStates.includes(image.state));

		return image;
	}

	private async streamBuildLogs(
		image: Image,
		onBuildLogs: (chunk: string) => void
	): Promise<Image> {
		const terminalStates: ImageState[] = [
			ImageState.ACTIVE,
			ImageState.INACTIVE,
			ImageState.ERROR,
			ImageState.BUILD_FAILED,
		];

		while (
			image.state === ImageState.BUILD_PENDING ||
			image.state === ImageState.PENDING
		) {
			await new Promise<void>((resolve) => setTimeout(resolve, 1000));
			image = (await this.imagesApi.getImage(image.id)).data;
		}

		await processStreamingResponse(
			() =>
				this.imagesApi.getImageBuildLogs(image.id, undefined, true, {
					responseType: 'stream',
				}),
			(chunk) => onBuildLogs(chunk.trimEnd()),
			async () => {
				image = (await this.imagesApi.getImage(image.id)).data;
				return terminalStates.includes(image.state);
			}
		);

		return image;
	}
}
