/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { hasModalContent } from '#lib/components/ui/modal/modal-content.svelte.ts';

const FIELD_CLASS = 'flex flex-col gap-2.25';
const MODAL_FIELD_GUTTER_CLASS = 'px-2';
export const FIELD_LABEL_CLASS = 'pl-0.5 text-(--text-muted)';

export function fieldClass(): string {
	return hasModalContent()
		? `${FIELD_CLASS} ${MODAL_FIELD_GUTTER_CLASS}`
		: FIELD_CLASS;
}
