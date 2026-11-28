/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Address, isAddressEqual } from 'viem';
import type { UserWallet } from '../../entities/user-wallet.entity';
import type { RecoveryOwnerKind } from '../../enums/recovery-owner-kind.enum';
import { RecoveryStatus } from '../../enums/recovery-status.enum';
import type { WalletCallVerdict } from './wallet-call-policy.util';

export interface RecoveryOwner {
	address: Address;
	kind: RecoveryOwnerKind | null;
}

type WalletRecovery = Pick<
	UserWallet,
	'recoveryStatus' | 'recoveryOwnerAddress' | 'recoveryOwnerKind'
>;

function includesAddress(
	addresses: readonly Address[],
	address: Address
): boolean {
	return addresses.some((candidate) => isAddressEqual(candidate, address));
}

function recoveryOwners(
	owners: readonly Address[],
	signer: Address
): Address[] {
	return owners.filter((owner) => !isAddressEqual(owner, signer));
}

export function recoveryFromOwners(
	owners: readonly Address[],
	signer: Address,
	known: readonly RecoveryOwner[]
): WalletRecovery {
	const others = recoveryOwners(owners, signer);
	const recorded = known.find(({ address }) =>
		others.some((owner) => isAddressEqual(owner, address))
	);
	const address = recorded?.address ?? others[0];
	if (!address) {
		return {
			recoveryStatus: RecoveryStatus.NONE,
			recoveryOwnerAddress: null,
			recoveryOwnerKind: null,
		};
	}
	return {
		recoveryStatus: RecoveryStatus.ACTIVE,
		recoveryOwnerAddress: address,
		recoveryOwnerKind: recorded?.kind ?? null,
	};
}

export function recoveryBlocks(
	verdict: WalletCallVerdict,
	owners: readonly Address[],
	signer: Address
): boolean {
	return (
		verdict.allowed &&
		verdict.outgoing &&
		recoveryOwners(owners, signer).length === 0
	);
}

export function ownersStillSigning(
	owners: readonly Address[],
	removed: Address,
	passkeyOwners: readonly Address[],
	livePasskeySigners: readonly Address[]
): Address[] {
	return owners.filter(
		(owner) =>
			!isAddressEqual(owner, removed) &&
			(includesAddress(livePasskeySigners, owner) ||
				!includesAddress(passkeyOwners, owner))
	);
}
