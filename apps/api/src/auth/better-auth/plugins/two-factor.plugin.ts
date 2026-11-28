/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { twoFactor } from 'better-auth/plugins';
import { AUTH_PRODUCT_NAME } from '../../constants/auth-product.constants';

export const createTwoFactorPlugin = () =>
	twoFactor({ issuer: AUTH_PRODUCT_NAME, allowPasswordless: true });
