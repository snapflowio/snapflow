/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	FUNDING_DIALOG_PARAM,
	FundingDialog,
} from '#lib/routing/funding-dialog.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import type { page } from '$app/state';

type PageUrl = typeof page.url;

const FUNDING_DIALOGS: ReadonlySet<string> = new Set(
	Object.values(FundingDialog)
);

export function isFundingDialog(value: string | null): value is FundingDialog {
	return value !== null && FUNDING_DIALOGS.has(value);
}

export function fundingDialogSearch(dialog: FundingDialog): string {
	return new URLSearchParams({ [FUNDING_DIALOG_PARAM]: dialog }).toString();
}

export function fundingDialogHref(dialog: FundingDialog): string {
	return `${resolve(Path.BILLING)}?${fundingDialogSearch(dialog)}`;
}

export function requestedFundingDialog(url: PageUrl): FundingDialog | null {
	const value = url.searchParams.get(FUNDING_DIALOG_PARAM);
	return isFundingDialog(value) ? value : null;
}

export function withoutFundingDialog(url: PageUrl): URL {
	const next = new URL(url.href);
	next.searchParams.delete(FUNDING_DIALOG_PARAM);
	return next;
}
