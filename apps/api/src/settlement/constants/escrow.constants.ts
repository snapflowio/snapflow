/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	MILLISECONDS_PER_MINUTE,
	MILLISECONDS_PER_SECOND,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import type { EscrowEventKind } from '../types/escrow.types';

export const ESCROW_EVENT_KINDS: readonly EscrowEventKind[] =
	snapflowEscrowAbi.flatMap((item) =>
		item.type === 'event' ? [item.name] : []
	);

export const CLAIMED_EVENT = 'Claimed' satisfies EscrowEventKind;

export const ESCROW_INDEXER = {
	JOB: 'index-escrow-events',
	LOCK_TTL_SECONDS: 5 * SECONDS_PER_MINUTE,
	// Hosted RPC providers cap eth_getLogs at a few thousand blocks; 1,000 Base
	// blocks are about half an hour of chain.
	MAXIMUM_BLOCK_RANGE: 1_000n,
	// Bounds one run so a long catch-up yields to the next tick and the lock
	// TTL is never reached.
	MAXIMUM_RANGES_PER_RUN: 20,
	BACKOFF: {
		baseMilliseconds: 5 * MILLISECONDS_PER_SECOND,
		capMilliseconds: 5 * MILLISECONDS_PER_MINUTE,
	},
} as const;

// The escrow's admin may lower the fee cap at any moment; re-reading it every
// minute bounds how long a lease can open at a markup the escrow would refuse.
export const ESCROW_FEE_POLICY_CACHE_MILLISECONDS = MILLISECONDS_PER_MINUTE;

export const ESCROW_EVENT_QUERY = {
	defaultLimit: 25,
	maximumLimit: 100,
} as const;

// The latest instant a JavaScript Date can hold; a session key expiry beyond
// it (customers may pick the uint64 maximum) is stored as this instant.
export const MAXIMUM_DATE_MILLISECONDS = 8_640_000_000_000_000;
