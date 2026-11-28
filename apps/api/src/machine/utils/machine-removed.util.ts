/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { GoneException } from '@nestjs/common';
import { MACHINE_REMOVED_CODE } from '../constants/machine-connection.constants';

export function machineRemoved(message: string): GoneException {
	return new GoneException({ code: MACHINE_REMOVED_CODE, message });
}
