/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import { allConditions } from '../../common/utils/pagination/filter-conditions.util';
import { uuidColumnsContaining } from '../../common/utils/pagination/uuid-search.util';
import type { Machine } from '../../machine/entities/machine.entity';
import type { ListAdminListingsQueryDto } from '../dto/admin-machine-tier.dto';
import type { ListVerificationReviewsQueryDto } from '../dto/verification-review.dto';
import type { VerificationReview } from '../entities/verification-review.entity';
import { AdminListingFlag } from '../enums/admin-listing-flag.enum';

const LISTING_SEARCH_COLUMNS = ['id', 'organizationId'] as const;
const REVIEW_SEARCH_COLUMNS = ['id', 'machineId', 'referenceId'] as const;

const LISTING_FLAG_FILTERS = {
	[AdminListingFlag.FINGERPRINT_CONFLICT]: { fingerprintConflict: true },
	[AdminListingFlag.RESTRICTED]: { restrictedAt: { $ne: null } },
	[AdminListingFlag.CLEAN]: { fingerprintConflict: false, restrictedAt: null },
} as const satisfies Record<AdminListingFlag, FilterQuery<Machine>>;

export function adminListingFilter(
	query: ListAdminListingsQueryDto
): FilterQuery<Machine> {
	const conditions: FilterQuery<Machine>[] = [];
	const search = query.query?.trim();
	if (search) {
		conditions.push(uuidColumnsContaining(LISTING_SEARCH_COLUMNS, search));
	}
	if (query.tiers?.length) {
		conditions.push({ tier: { $in: query.tiers } });
	}
	if (query.flags?.length) {
		conditions.push({
			$or: query.flags.map((flag) => LISTING_FLAG_FILTERS[flag]),
		});
	}
	return allConditions(conditions);
}

export function verificationReviewFilter(
	query: ListVerificationReviewsQueryDto
): FilterQuery<VerificationReview> {
	const conditions: FilterQuery<VerificationReview>[] = [];
	const search = query.query?.trim();
	if (search) {
		conditions.push(uuidColumnsContaining(REVIEW_SEARCH_COLUMNS, search));
	}
	if (query.state) {
		conditions.push({ state: query.state });
	}
	if (query.kinds?.length) {
		conditions.push({ kind: { $in: query.kinds } });
	}
	return allConditions(conditions);
}
