/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const INVALID_FIELD_SELECTOR = '[aria-invalid="true"]';

export function focusFirstInvalidField(container: HTMLElement | null): void {
	requestAnimationFrame(() => {
		const field = container?.querySelector<HTMLElement>(INVALID_FIELD_SELECTOR);
		if (!field) return;
		field.scrollIntoView({ block: 'center' });
		field.focus();
	});
}
