/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { IconComponent } from '#lib/components/icons/icon-component.ts';

export type HeaderActionKind = 'secondary' | 'delete' | 'discard' | 'primary';

interface HeaderActionBase {
	id: string;
	label: string;
	kind?: HeaderActionKind;
	icon?: IconComponent;
	disabled?: boolean;
	disabledReason?: string;
	active?: boolean;
	pending?: boolean;
	pendingLabel?: string;
	mobileIconOnly?: boolean;
	visible?: boolean;
}

interface HeaderButtonAction extends HeaderActionBase {
	onSelect: () => void;
	href?: undefined;
	type?: 'button' | 'submit';
	form?: string;
}

interface HeaderLinkAction extends HeaderActionBase {
	href: string;
	onSelect?: undefined;
	external?: boolean;
}

export type HeaderAction = HeaderButtonAction | HeaderLinkAction;

const KIND_ORDER: Record<HeaderActionKind, number> = {
	secondary: 0,
	delete: 1,
	discard: 2,
	primary: 3,
};

export function orderHeaderActions(
	actions: readonly HeaderAction[]
): HeaderAction[] {
	return actions
		.filter((action) => action.visible !== false)
		.map((action, index) => ({ action, index }))
		.sort(
			(left, right) =>
				KIND_ORDER[left.action.kind ?? 'secondary'] -
					KIND_ORDER[right.action.kind ?? 'secondary'] ||
				left.index - right.index
		)
		.map(({ action }) => action);
}

export interface SaveDiscardOptions {
	dirty: boolean;
	saving: boolean;
	onSave: () => void;
	onDiscard: () => void;
	saveLabel?: string;
	savingLabel?: string;
	form?: string;
}

export function saveDiscardActions(
	options: SaveDiscardOptions
): HeaderAction[] {
	return [
		{
			id: 'discard',
			kind: 'discard',
			label: 'Discard',
			onSelect: options.onDiscard,
			visible: options.dirty,
			disabled: options.saving,
		},
		{
			id: 'save',
			kind: 'primary',
			label: options.saveLabel ?? 'Save',
			pendingLabel: options.savingLabel ?? 'Saving...',
			pending: options.saving,
			disabled: !options.dirty || options.saving,
			onSelect: options.onSave,
			type: options.form ? 'submit' : 'button',
			form: options.form,
		},
	];
}
