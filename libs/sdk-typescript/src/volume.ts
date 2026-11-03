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

import {
	type CreateVolume,
	createVolume,
	deleteVolume,
	getVolumeByName,
	listVolumes,
	type VolumeDto,
	type VolumePageDto,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { SnapflowNotFoundError } from './errors/snapflow-error.js';
import {
	type IdempotentOperationOptions,
	resolveIdempotencyKey,
} from './utils/idempotency.js';

export type Volume = VolumeDto & { __brand: 'Volume' };

export interface VolumePage extends Omit<VolumePageDto, 'items'> {
	items: Volume[];
}

export class VolumeService {
	constructor(private readonly client: Client) {}

	async list(cursor?: string, limit?: number): Promise<VolumePage> {
		const response = await listVolumes({
			client: this.client,
			query: { cursor, limit },
		});
		return {
			items: response.data.items as Volume[],
			nextCursor: response.data.nextCursor,
		};
	}

	async get(
		name: string,
		create?: Pick<CreateVolume, 'sizeGiB'>
	): Promise<Volume> {
		try {
			const response = await getVolumeByName({
				client: this.client,
				path: { name },
			});
			return response.data as Volume;
		} catch (error) {
			if (error instanceof SnapflowNotFoundError && create) {
				return await this.create({ name, ...create });
			}
			throw error;
		}
	}

	async create(
		options: CreateVolume,
		operation: IdempotentOperationOptions = {}
	): Promise<Volume> {
		const response = await createVolume({
			client: this.client,
			headers: {
				'Idempotency-Key': resolveIdempotencyKey(operation.idempotencyKey),
			},
			body: options,
		});
		return response.data as Volume;
	}

	async delete(volume: Volume): Promise<void> {
		await deleteVolume({ client: this.client, path: { volumeId: volume.id } });
	}
}
