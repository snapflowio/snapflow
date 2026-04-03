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
	type Bucket,
	BucketState,
	type BucketsApi,
	type CreateBucket,
} from '@snapflow/api-client';
import { SnapflowError, SnapflowNotFoundError } from '../errors';

export interface CreateBucketParams {
	readonly name?: string;
}

const DEFAULT_BUCKET_TIMEOUT = 60;
const DEFAULT_DELETE_TIMEOUT = 120;
const POLL_INTERVAL = 1000;

export class BucketService {
	constructor(private readonly bucketsApi: BucketsApi) {}

	public async list(includeDeleted?: boolean): Promise<Bucket[]> {
		const response = await this.bucketsApi.listBuckets(
			undefined,
			includeDeleted
		);
		return response.data;
	}

	public async get(bucketId: string): Promise<Bucket> {
		const response = await this.bucketsApi.getBucket(bucketId);
		return response.data;
	}

	public async getByName(name: string, create = false): Promise<Bucket> {
		try {
			const response = await this.bucketsApi.getBucketByName(name);
			return response.data;
		} catch (error) {
			if (error instanceof SnapflowNotFoundError && create) {
				return await this.create({ name });
			}
			throw error;
		}
	}

	public async create(params: CreateBucketParams = {}): Promise<Bucket> {
		const body = (
			params.name !== undefined ? { name: params.name } : {}
		) as CreateBucket;
		const response = await this.bucketsApi.createBucket(body);
		return response.data;
	}

	public async delete(bucket: Bucket): Promise<void> {
		await this.bucketsApi.deleteBucket(bucket.id);
	}

	public async waitUntilReady(
		bucket: Bucket | string,
		timeout = DEFAULT_BUCKET_TIMEOUT
	): Promise<Bucket> {
		const bucketId = typeof bucket === 'string' ? bucket : bucket.id;
		return this.pollUntilState(
			bucketId,
			(state) => state === BucketState.READY,
			(state) => state === BucketState.ERROR,
			timeout,
			'become ready'
		);
	}

	public async waitUntilDeleted(
		bucket: Bucket | string,
		timeout = DEFAULT_DELETE_TIMEOUT
	): Promise<void> {
		const bucketId = typeof bucket === 'string' ? bucket : bucket.id;
		await this.pollUntilState(
			bucketId,
			(state) => state === BucketState.DELETED,
			(state) => state === BucketState.ERROR,
			timeout,
			'be deleted'
		);
	}

	private async pollUntilState(
		bucketId: string,
		targetPredicate: (state: BucketState) => boolean,
		errorPredicate: (state: BucketState) => boolean,
		timeout: number,
		operation: string
	): Promise<Bucket> {
		if (timeout < 0) {
			throw new SnapflowError('Timeout must be a non-negative number');
		}

		const startTime = Date.now();
		const timeoutMs = timeout * 1000;
		let bucket: Bucket | undefined;

		do {
			const response = await this.bucketsApi.getBucket(bucketId);
			bucket = response.data;

			if (targetPredicate(bucket.state)) {
				return bucket;
			}

			if (errorPredicate(bucket.state)) {
				throw new SnapflowError(
					`Bucket ${bucketId} failed to ${operation} with state: ${bucket.state}${bucket.errorReason ? `, reason: ${bucket.errorReason}` : ''}`
				);
			}

			if (timeout !== 0 && Date.now() - startTime > timeoutMs) {
				throw new SnapflowError(
					`Bucket ${bucketId} did not ${operation} within ${timeout} seconds`
				);
			}

			await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL));
		} while (!targetPredicate(bucket.state));

		return bucket;
	}
}
