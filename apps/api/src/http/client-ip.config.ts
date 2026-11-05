/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { NextFunction, Request, Response } from 'express';
import { CLIENT_IP_HEADER } from '../common/constants/client-ip.constants';

export function resolveClientIpHeader(
	request: Request,
	_response: Response,
	next: NextFunction
): void {
	delete request.headers[CLIENT_IP_HEADER];
	if (request.ip) request.headers[CLIENT_IP_HEADER] = request.ip;
	next();
}
