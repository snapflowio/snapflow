/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiErrorCode,
	type BillingRestriction,
	type Sandbox,
	type SandboxPlacementAlternative,
	SandboxPlacementErrorCode,
	type SandboxPrice,
	SandboxState,
} from '@snapflow/api-client';
import { billingRestrictionNotice } from '#lib/api/errors/error-catalog.ts';
import type { NoticeTone } from '#lib/components/ui/notice.svelte';
import {
	automaticPaymentsDescription,
	BILLING_FIX_LABELS,
	billingFixHref,
	PAYMENT_HOLD_COPY,
} from '#lib/features/billing/lib/billing-overview.ts';
import { MACHINE_UNAVAILABLE_REASON_LABELS } from '#lib/features/listings/lib/listing-format.ts';
import { resolvePath } from '#lib/routing/paths.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatHourlyPrice, formatMicroUsd } from '#lib/utils/usd.ts';
import {
	BILLING_RESTRICTED_KIND,
	type PlacementError,
} from './placement-errors.ts';
import { sandboxPaymentHold } from './sandbox-payment-hold.ts';
import {
	formatExpectedStart,
	MACHINE_UNAVAILABLE_NOTICE,
} from './sandbox-state.ts';
import { sandboxUnexpectedStop } from './sandbox-stop-reason.ts';

export interface SandboxAttentionAction {
	label: string;
	href: string;
}

export interface SandboxAttention {
	tone: NoticeTone;
	title: string;
	info?: string;
	action?: SandboxAttentionAction;
	alternatives?: readonly SandboxPlacementAlternative[];
}

const PAYMENT_HOLD_INFO =
	'Its host is not paid while payments do not cover it. It resumes on its own once they do.';
const PLACEMENT_TITLE = 'Waiting for a machine';
const PLACEMENT_INFO =
	'Snapflow places it on the best matching machine as soon as one has room.';

function priceIncreaseAttention(price: SandboxPrice): SandboxAttention | null {
	if (!price.priceIncreaseAt) return null;
	const nextPrice =
		price.increasedHourlyPriceMicroUsd === null
			? 'The higher price'
			: `The new price of ${formatHourlyPrice(price.increasedHourlyPriceMicroUsd)}`;
	const capNote =
		price.maxHourlyPriceMicroUsd === null
			? ''
			: ` If it is above your ${formatHourlyPrice(price.maxHourlyPriceMicroUsd)} maximum, the sandbox stops and keeps its disk.`;
	return {
		tone: 'warning',
		title: 'The machine’s price is going up',
		info: `${nextPrice} applies at the next start or on ${formatDateTime(price.priceIncreaseAt)}, whichever comes first.${capNote}`,
	};
}

export function sandboxAttention(
	sandbox: Sandbox,
	price: SandboxPrice | undefined
): SandboxAttention | null {
	const hold = sandboxPaymentHold(sandbox);
	if (hold) {
		return {
			tone: 'warning',
			title: `Paused: ${hold.cause}`,
			info: PAYMENT_HOLD_INFO,
			action: { label: hold.fixLabel, href: hold.fixHref },
		};
	}
	if (sandbox.state === SandboxState.MachineUnavailable) {
		return {
			tone: 'warning',
			title: MACHINE_UNAVAILABLE_NOTICE.title,
			info: MACHINE_UNAVAILABLE_NOTICE.description,
		};
	}
	if (sandbox.errorReason) {
		return {
			tone: sandbox.recoverable ? 'warning' : 'error',
			title: sandbox.recoverable
				? 'Sandbox can be recovered'
				: 'Sandbox failed',
			info: sandbox.errorReason,
		};
	}
	const stop = sandboxUnexpectedStop(sandbox);
	if (stop) {
		return {
			tone: 'warning',
			title: stop.title,
			info: `${stop.reason} ${stop.guidance}`,
		};
	}
	if (sandbox.state === SandboxState.PendingPlacement) {
		return {
			tone: 'info',
			title:
				sandbox.expectedStartSeconds == null
					? PLACEMENT_TITLE
					: `${PLACEMENT_TITLE} · ${formatExpectedStart(sandbox.expectedStartSeconds)}`,
			info: PLACEMENT_INFO,
		};
	}
	return price ? priceIncreaseAttention(price) : null;
}

export function placementErrorAttention(
	error: PlacementError
): SandboxAttention {
	switch (error.kind) {
		case SandboxPlacementErrorCode.PriceChanged:
			return {
				tone: 'warning',
				title: `The machine’s price changed to ${formatHourlyPrice(error.quote.hourlyPriceMicroUsd)}`,
				info: 'The new quote is shown below. Confirm again to accept the new price.',
			};
		case SandboxPlacementErrorCode.PriceAboveMaximum:
			return {
				tone: 'warning',
				title: `The price of ${formatHourlyPrice(error.hourlyPriceMicroUsd)} is above your ${formatHourlyPrice(error.maxHourlyPriceMicroUsd)} maximum`,
				info: 'Raise the maximum price or choose another machine. A stopped sandbox keeps its disk.',
			};
		case BILLING_RESTRICTED_KIND: {
			const attention = billingRestrictionAttention(error.code);
			return {
				...attention,
				info: `${attention.info} Needed ${formatMicroUsd(error.requiredMicroUsd)}, available ${formatMicroUsd(error.availableMicroUsd)}.`,
			};
		}
		case ApiErrorCode.AutomaticPaymentsRequired: {
			const copy = PAYMENT_HOLD_COPY[error.reason];
			return {
				tone: 'warning',
				title: copy.title,
				info: automaticPaymentsDescription(error),
				action: {
					label: BILLING_FIX_LABELS[copy.fix],
					href: billingFixHref(copy.fix),
				},
			};
		}
		case SandboxPlacementErrorCode.MachineUnavailable:
			return {
				tone: 'warning',
				title: `The machine is unavailable: ${MACHINE_UNAVAILABLE_REASON_LABELS[error.reason]}`,
				info:
					error.alternatives.length > 0
						? 'These matching machines can take the sandbox now.'
						: 'No matching machine can take the sandbox right now.',
				alternatives: error.alternatives,
			};
	}
}

export function billingRestrictionAttention(
	restriction: BillingRestriction
): SandboxAttention {
	const notice = billingRestrictionNotice(restriction);
	return {
		tone: 'warning',
		title: notice.title,
		info: notice.message,
		action: {
			label: notice.action.label,
			href: resolvePath(notice.action.path),
		},
	};
}
