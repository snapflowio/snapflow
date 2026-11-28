/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { CreateIspComplaint, IspComplaint } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	forwardIspComplaintMutationOptions,
	ispComplaintsQueryOptions,
	ispStatementMutationOptions,
} from '#lib/api/machines/isp-complaints.ts';
import type { MachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';
import { downloadFile } from '#lib/utils/download-file.ts';

export class MachineIspComplaints {
	readonly #detail: MachineDetail;
	readonly query;
	readonly forward;
	readonly statement;
	forwarding = $state(false);
	result = $state.raw<IspComplaint | null>(null);

	readonly complaints: readonly IspComplaint[] = $derived.by(
		() => this.query.data ?? []
	);
	readonly canForward = $derived.by(() => this.#detail.canWrite);

	constructor(detail: MachineDetail) {
		this.#detail = detail;
		this.query = createQuery(() =>
			ispComplaintsQueryOptions(this.#detail.machine.id)
		);
		this.forward = createMutation(() =>
			forwardIspComplaintMutationOptions(this.#detail.machine.id)
		);
		this.statement = createMutation(() =>
			ispStatementMutationOptions(this.#detail.machine.id)
		);
	}

	open = (): void => {
		this.result = null;
		this.forwarding = true;
	};

	close = (): void => {
		this.forwarding = false;
		this.result = null;
	};

	submit = async (complaint: CreateIspComplaint): Promise<void> => {
		this.result = await this.forward.mutateAsync(complaint);
	};

	download = (complaint: IspComplaint): void => {
		this.statement.mutate(complaint, {
			onSuccess: ({ data, filename }) => downloadFile(data, filename),
		});
	};

	downloadResult = (): void => {
		if (this.result) this.download(this.result);
	};
}
