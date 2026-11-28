/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export type TermsAcceptanceExemption = (request: Request) => boolean;

const ALWAYS_EXEMPT: TermsAcceptanceExemption = () => true;

export const TermsAcceptanceExempt = Reflector.createDecorator<
	TermsAcceptanceExemption | undefined,
	TermsAcceptanceExemption
>({
	transform: (exemption) => exemption ?? ALWAYS_EXEMPT,
});
