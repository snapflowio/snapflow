/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export interface ResourceShapeFields {
	cpu: number;
	memoryGiB: number;
	diskGiB: number;
	gpu: number;
}

export interface ResourceShapeColumns {
	cpu: number;
	memoryGib: number;
	diskGib: number;
	gpu: number;
}

export interface SandboxResourceColumns {
	cpu: number;
	mem: number;
	disk: number;
	gpu: number;
}

export class ResourceShape implements ResourceShapeFields {
	private constructor(
		readonly cpu: number,
		readonly memoryGiB: number,
		readonly diskGiB: number,
		readonly gpu: number
	) {}

	static of(fields: ResourceShapeFields): ResourceShape {
		return new ResourceShape(
			fields.cpu,
			fields.memoryGiB,
			fields.diskGiB,
			fields.gpu
		);
	}

	static wholeUnits(fields: ResourceShapeFields): ResourceShape {
		return new ResourceShape(
			Math.floor(fields.cpu),
			Math.floor(fields.memoryGiB),
			Math.floor(fields.diskGiB),
			Math.floor(fields.gpu)
		);
	}

	static fromColumns(columns: ResourceShapeColumns): ResourceShape {
		return new ResourceShape(
			columns.cpu,
			columns.memoryGib,
			columns.diskGib,
			columns.gpu
		);
	}

	static fromSandbox(columns: SandboxResourceColumns): ResourceShape {
		return new ResourceShape(
			columns.cpu,
			columns.mem,
			columns.disk,
			columns.gpu
		);
	}

	equals(other: ResourceShapeFields): boolean {
		return (
			this.cpu === other.cpu &&
			this.memoryGiB === other.memoryGiB &&
			this.diskGiB === other.diskGiB &&
			this.gpu === other.gpu
		);
	}

	toColumns(): ResourceShapeColumns {
		return {
			cpu: this.cpu,
			memoryGib: this.memoryGiB,
			diskGib: this.diskGiB,
			gpu: this.gpu,
		};
	}
}
