/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SystemExposureService } from '@snapflow/api-client';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { requestSandboxSystemAccess } from '#lib/api/sandboxes/exposure.ts';
import { desktopViewerUrl } from '#lib/features/sandboxes/lib/sandbox-desktop.ts';
import { isSandboxInteractive } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { ComputerUse } from '#lib/features/sandboxes/state/computer-use.svelte.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { SandboxSystemSession } from '#lib/features/sandboxes/state/sandbox-system-session.svelte.ts';
import { SandboxToolbox } from '#lib/features/sandboxes/state/sandbox-toolbox.svelte.ts';
import { openResolvedUrlInNewTab } from '#lib/utils/open-new-tab.ts';

export class SandboxDesktop {
	readonly detail = getSandboxDetail();
	readonly interactive = $derived(
		this.detail.canWrite && isSandboxInteractive(this.detail.sandbox)
	);
	readonly toolbox = new SandboxToolbox(() => ({
		enabled: this.interactive,
		sandbox: this.detail.sandbox,
	}));
	readonly computerUse = new ComputerUse(() => ({
		enabled: this.interactive,
		sandboxId: this.detail.sandbox.id,
		toolbox: this.toolbox.client,
	}));
	readonly session = new SandboxSystemSession(() => ({
		enabled: this.interactive && this.computerUse.active,
		sandbox: this.detail.sandbox,
		service: SystemExposureService.Desktop,
	}));

	openDesktop = (): Promise<void> =>
		openResolvedUrlInNewTab(
			async () => {
				const access = await requestSandboxSystemAccess(
					this.detail.sandbox,
					SystemExposureService.Desktop
				);
				return desktopViewerUrl(access.url);
			},
			(error) => showApiError(error, 'Failed to open sandbox desktop')
		);

	retry = async (): Promise<void> => {
		await Promise.all([this.toolbox.refresh(), this.computerUse.retry()]);
	};
}
