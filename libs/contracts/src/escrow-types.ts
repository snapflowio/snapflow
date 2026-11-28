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

import type {
	ContractFunctionArgs,
	ContractFunctionName,
	ContractFunctionReturnType,
} from 'viem';
import type { snapflowEscrowAbi } from './generated/snapflow-escrow.abi.js';

type EscrowAbi = typeof snapflowEscrowAbi;

type EscrowView<Name extends ContractFunctionName<EscrowAbi, 'view'>> =
	ContractFunctionReturnType<EscrowAbi, 'view', Name>;

type EscrowWriteArgs<
	Name extends ContractFunctionName<EscrowAbi, 'nonpayable'>,
> = ContractFunctionArgs<EscrowAbi, 'nonpayable', Name>;

export type EscrowAccount = EscrowView<'accountOf'>;

export type SignerGrant = EscrowView<'signerOf'>;

export type ClaimsFreeze = EscrowView<'claimsFreeze'>;

export type SignerScope = EscrowWriteArgs<'authorizeSigner'>[1];

export type ClaimItem = EscrowWriteArgs<'claimBatch'>[0][number];
