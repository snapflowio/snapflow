/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { snapflowEscrowAbi } from '@snapflow/contracts';
import type {
	ContractFunctionArgs,
	ContractFunctionName,
	ContractFunctionReturnType,
} from 'viem';

type EscrowAbi = typeof snapflowEscrowAbi;

type EscrowView<name extends ContractFunctionName<EscrowAbi, 'view'>> =
	ContractFunctionReturnType<EscrowAbi, 'view', name>;

type EscrowWriteArgs<
	name extends ContractFunctionName<EscrowAbi, 'nonpayable'>,
> = ContractFunctionArgs<EscrowAbi, 'nonpayable', name>;

export type EscrowAccountState = EscrowView<'accountOf'>;

export type AutoTopUpState = EscrowView<'autoTopUpOf'>;

type SetAutoTopUpArgs = EscrowWriteArgs<'setAutoTopUp'>;

export interface EscrowAutoTopUpLimits {
	relayer: SetAutoTopUpArgs[0];
	amount: SetAutoTopUpArgs[1];
	threshold: SetAutoTopUpArgs[2];
	maxRelayFee: SetAutoTopUpArgs[3];
	minInterval: SetAutoTopUpArgs[4];
}

export type SignerGrant = EscrowView<'signerOf'>;

type AuthorizeSignerArgs = EscrowWriteArgs<'authorizeSigner'>;

export type SignerScope = AuthorizeSignerArgs[1];

type RaiseSignerLimitArgs = EscrowWriteArgs<'raiseSignerLimit'>;

export interface SignerLimitRaise {
	hourlyCap: RaiseSignerLimitArgs[1];
	expiry: RaiseSignerLimitArgs[2];
}

export interface SignerAuthorization {
	signer: AuthorizeSignerArgs[0];
	scope: SignerScope;
	proofDeadline: AuthorizeSignerArgs[2];
	proof: AuthorizeSignerArgs[3];
}
