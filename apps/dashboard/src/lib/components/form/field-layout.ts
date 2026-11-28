/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const FIELD_CLASS = 'flex flex-col gap-2';
const FIELD_LABEL_CLASS = 'text-(--text-primary)';
const FIELD_LABEL_INVALID_CLASS = 'text-(--text-error)';
export const FIELD_HINT_CLASS = 'text-(--text-muted) text-sm';
export const FIELD_ERROR_CLASS = 'font-medium text-(--text-error) text-sm';

export function fieldLabelClass(invalid: boolean): string {
	return invalid ? FIELD_LABEL_INVALID_CLASS : FIELD_LABEL_CLASS;
}

export function fieldClass(): string {
	return FIELD_CLASS;
}
