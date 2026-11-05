/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const PROTO_ENUM_UNSPECIFIED = 0;

function specifiedProtoEnumValues(
	protoEnum: Record<string, string | number>
): number[] {
	return Object.values(protoEnum).filter(
		(value): value is number =>
			typeof value === 'number' && value !== PROTO_ENUM_UNSPECIFIED
	);
}

export function protoEnumCheckExpression(
	column: string,
	protoEnum: Record<string, string | number>,
	nullable: boolean
): string {
	const allowed = `"${column}" in (${specifiedProtoEnumValues(protoEnum).join(', ')})`;
	return nullable ? `"${column}" is null or ${allowed}` : allowed;
}
