/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type * as z from 'zod';
import type { OrganizationIdentityValues } from '#lib/api/organizations/settings.ts';
import {
	organizationNameSchema,
	organizationSlugSchema,
} from '#lib/features/organizations/lib/organization-slug.ts';

const EMPTY_IDENTITY: OrganizationIdentityValues = { name: '', slug: '' };

function firstIssue(schema: z.ZodType, value: string): string | undefined {
	const result = schema.safeParse(value);
	return result.success ? undefined : result.error.issues[0]?.message;
}

export class OrganizationIdentityDraft {
	name = $state('');
	slug = $state('');
	#initial = $state.raw<OrganizationIdentityValues>(EMPTY_IDENTITY);
	#validated = $state(false);

	readonly dirty = $derived(
		this.name.trim() !== this.#initial.name ||
			this.slug.trim() !== this.#initial.slug
	);
	readonly nameError = $derived(
		this.#validated ? firstIssue(organizationNameSchema, this.name) : undefined
	);
	readonly slugError = $derived(
		this.#validated ? firstIssue(organizationSlugSchema, this.slug) : undefined
	);

	reset(values: OrganizationIdentityValues): void {
		this.#initial = values;
		this.name = values.name;
		this.slug = values.slug;
		this.#validated = false;
	}

	discard = (): void => {
		this.reset(this.#initial);
	};

	validate(): OrganizationIdentityValues | null {
		this.#validated = true;
		if (this.nameError || this.slugError) return null;
		return { name: this.name.trim(), slug: this.slug.trim() };
	}
}
