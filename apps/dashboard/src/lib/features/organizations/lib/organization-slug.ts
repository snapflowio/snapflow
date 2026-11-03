/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RESERVED_ORGANIZATION_SLUG_PREFIXES } from '@snapflow/organization-access';
import * as z from 'zod';

export const ORGANIZATION_NAME_MAX_LENGTH = 100;
export const ORGANIZATION_SLUG_MAX_LENGTH = 64;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMBINING_MARKS = /\p{M}/gu;
const NON_SLUG_CHARACTERS = /[^a-z0-9]+/g;
const EDGE_SEPARATORS = /^-+|-+$/g;
const SLUG_SEPARATOR = '-';

export function slugifyOrganizationName(name: string): string {
	return name
		.normalize('NFKD')
		.replace(COMBINING_MARKS, '')
		.toLowerCase()
		.replace(NON_SLUG_CHARACTERS, SLUG_SEPARATOR)
		.replace(EDGE_SEPARATORS, '')
		.slice(0, ORGANIZATION_SLUG_MAX_LENGTH)
		.replace(EDGE_SEPARATORS, '');
}

function hasReservedSlugPrefix(slug: string): boolean {
	return RESERVED_ORGANIZATION_SLUG_PREFIXES.some((prefix) =>
		slug.startsWith(prefix)
	);
}

export const organizationNameSchema = z
	.string()
	.trim()
	.min(1, 'Organization name is required')
	.max(
		ORGANIZATION_NAME_MAX_LENGTH,
		`Name must be ${ORGANIZATION_NAME_MAX_LENGTH} characters or fewer`
	);

export const organizationSlugSchema = z
	.string()
	.trim()
	.min(1, 'Slug is required')
	.max(
		ORGANIZATION_SLUG_MAX_LENGTH,
		`Slug must be ${ORGANIZATION_SLUG_MAX_LENGTH} characters or fewer`
	)
	.regex(
		SLUG_PATTERN,
		'Use lowercase letters, numbers and single hyphens between them'
	)
	.refine(
		(slug) => !hasReservedSlugPrefix(slug),
		`Slugs cannot start with ${RESERVED_ORGANIZATION_SLUG_PREFIXES.join(' or ')}`
	);
