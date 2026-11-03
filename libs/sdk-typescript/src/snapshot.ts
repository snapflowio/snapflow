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
	activateSnapshot,
	type CreateSnapshot,
	createSnapshot,
	getAllSnapshots,
	getPushAccess,
	getSnapshot,
	getSnapshotBuildLogsUrl,
	removeSnapshot,
	type SandboxClass,
	type SnapshotDto,
	type SnapshotPage as SnapshotPageDto,
	SnapshotState,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { readPresignedBuildLog } from './build-logs.js';
import {
	SnapflowError,
	SnapflowTimeoutError,
} from './errors/snapflow-error.js';
import type { Image } from './image.js';
import type { Resources } from './snapflow.types.js';
import { abortableDelay } from './utils/async.js';
import { requestSignal } from './utils/http.js';
import {
	type IdempotentOperationOptions,
	resolveIdempotencyKey,
} from './utils/idempotency.js';
import { assertNonNegativeTimeout, Deadline } from './utils/timeout.js';

export type Snapshot = SnapshotDto & { __brand: 'Snapshot' };

export interface SnapshotPage extends Omit<SnapshotPageDto, 'items'> {
	items: Snapshot[];
}

export type CreateSnapshotParams = {
	name: string;
	image: string | Image;
	resources?: Resources;
	entrypoint?: string[];
	sandboxClass?: SandboxClass;
};

export type CreateSnapshotOptions = {
	onLogs?: (chunk: string) => void;
	timeout?: number;
} & IdempotentOperationOptions;

const NO_TIMEOUT_SECONDS = 0;
const SNAPSHOT_POLL_INTERVAL_MILLISECONDS = 1000;
const FAILED_SNAPSHOT_STATES: ReadonlySet<SnapshotState> = new Set([
	SnapshotState.Error,
	SnapshotState.BuildFailed,
]);
const TERMINAL_SNAPSHOT_STATES: ReadonlySet<SnapshotState> = new Set([
	SnapshotState.Active,
	...FAILED_SNAPSHOT_STATES,
]);

function snapshotResources(
	resources: Resources | undefined
): Pick<CreateSnapshot, 'cpu' | 'gpu' | 'gpuType' | 'memory' | 'disk'> {
	if (!resources) {
		return {};
	}
	const { gpuType, ...sizes } = resources;
	return {
		...sizes,
		gpuType:
			gpuType === undefined || Array.isArray(gpuType) ? gpuType : [gpuType],
	};
}

export class SnapshotService {
	constructor(private readonly client: Client) {}

	async list(cursor?: string, limit?: number): Promise<SnapshotPage> {
		const response = await getAllSnapshots({
			client: this.client,
			query: { cursor, limit },
		});
		return {
			items: response.data.items.map(
				(snapshot: SnapshotDto) => snapshot as Snapshot
			),
			nextCursor: response.data.nextCursor,
		};
	}

	async get(name: string): Promise<Snapshot> {
		const response = await getSnapshot({
			client: this.client,
			path: { id: name },
		});
		return response.data as Snapshot;
	}

	async delete(snapshot: Snapshot): Promise<void> {
		await removeSnapshot({ client: this.client, path: { id: snapshot.id } });
	}

	public async create(
		params: CreateSnapshotParams,
		options: CreateSnapshotOptions = {}
	): Promise<Snapshot> {
		const timeout = options.timeout ?? NO_TIMEOUT_SECONDS;
		assertNonNegativeTimeout(timeout);
		const deadline = Deadline.after(timeout);
		const request = await this.createSnapshotRequest(params);

		const created = (
			await createSnapshot({
				client: this.client,
				headers: {
					'Idempotency-Key': resolveIdempotencyKey(options.idempotencyKey),
				},
				body: request,
				signal: requestSignal(deadline.remainingSeconds()),
			})
		).data;
		const snapshot = await this.waitForTerminalState(
			created,
			deadline,
			options.onLogs
		);

		if (options.onLogs) {
			await this.reportBuildResult(snapshot, request, options.onLogs);
		}
		if (FAILED_SNAPSHOT_STATES.has(snapshot.state)) {
			throw new SnapflowError(
				`Failed to create snapshot. Name: ${snapshot.name} Reason: ${snapshot.errorReason}`
			);
		}
		return snapshot as Snapshot;
	}

	async activate(snapshot: Snapshot): Promise<Snapshot> {
		const response = await activateSnapshot({
			client: this.client,
			path: { id: snapshot.id },
		});
		return response.data as Snapshot;
	}

	private async createSnapshotRequest(
		params: CreateSnapshotParams
	): Promise<CreateSnapshot> {
		const request: CreateSnapshot = {
			name: params.name,
			sandboxClass: params.sandboxClass,
			...snapshotResources(params.resources),
		};
		if (typeof params.image === 'string') {
			request.imageName = params.image;
			request.entrypoint = params.entrypoint;
			return request;
		}
		request.buildInfo = {
			contextHashes: await SnapshotService.processImageContext(
				this.client,
				params.image
			),
			dockerfileContent: params.entrypoint
				? params.image.entrypoint(params.entrypoint).dockerfile
				: params.image.dockerfile,
		};
		return request;
	}

	private async waitForTerminalState(
		snapshot: SnapshotDto,
		deadline: Deadline,
		onLogs: ((chunk: string) => void) | undefined
	): Promise<SnapshotDto> {
		onLogs?.(`Creating snapshot ${snapshot.name} (${snapshot.state})`);
		let current = snapshot;
		while (!TERMINAL_SNAPSHOT_STATES.has(current.state)) {
			if (deadline.isExpired()) {
				throw new SnapflowTimeoutError(
					`Timed out waiting for snapshot ${current.name} to finish building`
				);
			}
			await abortableDelay(
				Math.min(
					SNAPSHOT_POLL_INTERVAL_MILLISECONDS,
					deadline.remainingMilliseconds() ??
						SNAPSHOT_POLL_INTERVAL_MILLISECONDS
				)
			);
			const next = (
				await getSnapshot({
					client: this.client,
					path: { id: current.name },
					signal: requestSignal(deadline.remainingSeconds()),
				})
			).data;
			if (next.state !== current.state) {
				onLogs?.(`Creating snapshot ${next.name} (${next.state})`);
			}
			current = next;
		}
		return current;
	}

	private async reportBuildResult(
		snapshot: SnapshotDto,
		request: CreateSnapshot,
		onLogs: (chunk: string) => void
	): Promise<void> {
		if (request.buildInfo) {
			const response = await getSnapshotBuildLogsUrl({
				client: this.client,
				path: { id: snapshot.id },
			});
			await readPresignedBuildLog(response.data.url, onLogs);
		}
		if (snapshot.state === SnapshotState.Active) {
			onLogs(`Created snapshot ${snapshot.name} (${snapshot.state})`);
		}
	}

	static async processImageContext(
		client: Client,
		image: Image
	): Promise<string[]> {
		if (!image.contextList?.length) {
			return [];
		}

		const { ObjectStorage } = await import('./object-storage.js');
		const pushAccessCreds = (await getPushAccess({ client })).data;
		const objectStorage = new ObjectStorage({
			endpointUrl: pushAccessCreds.storageUrl,
			accessKeyId: pushAccessCreds.accessKey,
			secretAccessKey: pushAccessCreds.secret,
			sessionToken: pushAccessCreds.sessionToken,
			bucketName: pushAccessCreds.bucket,
		});

		const contextHashes = [];
		for (const context of image.contextList) {
			const contextHash = await objectStorage.upload(
				context.sourcePath,
				pushAccessCreds.organizationId,
				context.archivePath
			);
			contextHashes.push(contextHash);
		}

		return contextHashes;
	}
}
