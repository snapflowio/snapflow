/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export type FakeMembers<T> = { readonly [Key in keyof T]?: unknown };

export function fakeInstance<T extends object>(
	type: abstract new (...args: never[]) => T,
	members: FakeMembers<T> = {}
): T {
	const instance: T = Object.create(
		type.prototype,
		Object.getOwnPropertyDescriptors(members)
	);
	return instance;
}

export function fakeValue<T extends object>(members: FakeMembers<T>): T {
	const value: T = Object.create(
		Object.prototype,
		Object.getOwnPropertyDescriptors(members)
	);
	return value;
}
