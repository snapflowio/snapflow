/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { TypedConfigService } from '../../config/services/typed-config.service';
import type { EscrowIdentity } from '../types/escrow.types';

export function configuredEscrow(config: TypedConfigService): EscrowIdentity {
	return {
		chainId: config.get('settlement.chainId'),
		contractAddress: config.get('settlement.escrowAddress'),
	};
}
