/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type HostInventory,
	FingerprintKind as ProtoFingerprintKind,
} from '@snapflow/machine-proto';
import { FingerprintKind } from '../enums/fingerprint-kind.enum';
import { sha256 } from './nonce-stream.util';

const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const COMPONENT_SEPARATOR = ':';
const ENTRY_SEPARATOR = '\n';

const FINGERPRINT_KIND: Readonly<
	Record<ProtoFingerprintKind, FingerprintKind | null>
> = {
	[ProtoFingerprintKind.UNSPECIFIED]: null,
	[ProtoFingerprintKind.SMBIOS_UUID]: FingerprintKind.SMBIOS_UUID,
	[ProtoFingerprintKind.BOARD_SERIAL]: FingerprintKind.BOARD_SERIAL,
	[ProtoFingerprintKind.DISK_SERIAL]: FingerprintKind.DISK_SERIAL,
	[ProtoFingerprintKind.GPU_UUID]: FingerprintKind.GPU_UUID,
};

export interface FingerprintDigest {
	kind: FingerprintKind;
	valueDigest: string;
}

export function hexDigest(value: string): string {
	return sha256(Buffer.from(value, 'utf8')).toString('hex');
}

export function inventoryDigest(
	components: readonly FingerprintDigest[]
): string {
	return hexDigest(
		components
			.map(
				({ kind, valueDigest }) => `${kind}${COMPONENT_SEPARATOR}${valueDigest}`
			)
			.sort()
			.join(ENTRY_SEPARATOR)
	);
}

export function verifiedFingerprints(
	inventory: HostInventory
): FingerprintDigest[] | null {
	const components: FingerprintDigest[] = [];
	for (const component of inventory.components) {
		const kind = FINGERPRINT_KIND[component.kind];
		if (!kind || !HEX_DIGEST_PATTERN.test(component.valueDigest)) return null;
		components.push({ kind, valueDigest: component.valueDigest });
	}
	if (
		components.length === 0 ||
		inventoryDigest(components) !== inventory.inventoryDigest
	) {
		return null;
	}
	return components;
}
