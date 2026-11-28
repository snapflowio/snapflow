/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const CHAIN_RPC_VERSION = '2.0';

export const CHAIN_RPC_READ_METHODS = [
	'eth_blockNumber',
	'eth_call',
	'eth_chainId',
	'eth_estimateGas',
	'eth_feeHistory',
	'eth_gasPrice',
	'eth_getBalance',
	'eth_getBlockByNumber',
	'eth_getCode',
	'eth_getTransactionByHash',
	'eth_getTransactionCount',
	'eth_getTransactionReceipt',
	'eth_maxPriorityFeePerGas',
] as const;

export type ChainRpcReadMethod = (typeof CHAIN_RPC_READ_METHODS)[number];
