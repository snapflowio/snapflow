/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import { SettlementErrorCode } from '../constants/payment-channel.constants';
import {
	AutomaticPaymentsGapDto,
	type AutomaticPaymentsRequiredErrorDto,
} from '../dto/automatic-payments.dto';
import type { AutomaticPaymentsGap } from '../types/automatic-payments.types';
import { automaticPaymentsMessage } from '../utils/vouchers/automatic-payments.util';

export class AutomaticPaymentsRequiredException extends HttpException {
	constructor(gap: AutomaticPaymentsGap) {
		const body: AutomaticPaymentsRequiredErrorDto = {
			code: SettlementErrorCode.AUTOMATIC_PAYMENTS_REQUIRED,
			message: automaticPaymentsMessage(gap),
			...AutomaticPaymentsGapDto.from(gap),
		};
		super(body, HttpStatus.PAYMENT_REQUIRED);
	}
}
