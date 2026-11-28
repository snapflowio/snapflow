/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { watch } from 'runed';
import {
	requestedFundingDialog,
	withoutFundingDialog,
} from '#lib/features/billing/lib/funding-dialog-link.ts';
import type { FundingDialog } from '#lib/routing/funding-dialog.ts';
import { goto } from '$app/navigation';
import { page } from '$app/state';

const CLEAR_REQUEST_NAVIGATION = { replace: true, reset: false } as const;

export class BillingDialogs {
	readonly #ready: (dialog: FundingDialog) => boolean;
	current = $state<FundingDialog | null>(null);

	constructor(ready: (dialog: FundingDialog) => boolean) {
		this.#ready = ready;
		watch(
			() => {
				const requested = requestedFundingDialog(page.url);
				return requested && this.#ready(requested) ? requested : null;
			},
			(requested) => {
				if (!requested) return;
				this.current = requested;
				void goto(withoutFundingDialog(page.url), CLEAR_REQUEST_NAVIGATION);
			}
		);
	}

	show = (dialog: FundingDialog): void => {
		this.current = dialog;
	};

	close = (): void => {
		this.current = null;
	};

	isOpen(dialog: FundingDialog): boolean {
		return this.current === dialog;
	}

	setOpen(dialog: FundingDialog, open: boolean): void {
		if (open) this.current = dialog;
		else if (this.current === dialog) this.current = null;
	}
}
