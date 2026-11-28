/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type HostMachine,
	ListingState,
	ListingVisibility,
} from '@snapflow/api-client';
import type { EarningsStatus } from '#lib/features/earnings/lib/earnings-status.ts';

export const MachineListingStatus = {
	Listed: 'listed',
	Paused: 'paused',
	Private: 'private',
	UnderReview: 'under-review',
	NotListed: 'not-listed',
} as const;

export type MachineListingStatus =
	(typeof MachineListingStatus)[keyof typeof MachineListingStatus];

export const MACHINE_LISTING_STATUS = {
	[MachineListingStatus.Listed]: {
		label: 'Listed',
		shape: 'check',
		tone: 'success',
		description: 'Renters can place sandboxes on this machine.',
	},
	[MachineListingStatus.Paused]: {
		label: 'Paused',
		shape: 'paused',
		tone: 'neutral',
		description: 'Running sandboxes keep running. No new rentals.',
	},
	[MachineListingStatus.Private]: {
		label: 'Private',
		shape: 'dashed',
		tone: 'neutral',
		description: 'Runs only this organization’s sandboxes, unbilled.',
	},
	[MachineListingStatus.UnderReview]: {
		label: 'Under review',
		shape: 'alert',
		tone: 'warning',
		description: null,
	},
	[MachineListingStatus.NotListed]: {
		label: 'Not listed',
		shape: 'empty',
		tone: 'neutral',
		description: null,
	},
} as const satisfies Record<MachineListingStatus, EarningsStatus>;

export function machineListingStatus(host: HostMachine): MachineListingStatus {
	if (host.restrictedAt) return MachineListingStatus.UnderReview;
	if (host.listing.visibility === ListingVisibility.Private) {
		return MachineListingStatus.Private;
	}
	if (host.listing.state === ListingState.Listed) {
		return MachineListingStatus.Listed;
	}
	if (host.listing.state === ListingState.Paused) {
		return MachineListingStatus.Paused;
	}
	return MachineListingStatus.NotListed;
}

export function machineListingStatusCopy(host: HostMachine): EarningsStatus {
	const status = MACHINE_LISTING_STATUS[machineListingStatus(host)];
	return status.description === null && host.restrictionReason
		? { ...status, description: host.restrictionReason }
		: status;
}

export function listsPublicly(host: HostMachine): boolean {
	return (
		host.listing.state === ListingState.Listed &&
		host.listing.visibility === ListingVisibility.Public
	);
}
