/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PRODUCTION_ONLY } from '../../constants/deployment-environment.constants';
import { emailAddressText, text } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const receiptsEnvironment = defineEnvironment(
	{
		title: 'Receipts',
		description:
			'The company that issues the monthly customer receipts, printed in every receipt header',
	},
	{
		RECEIPT_ISSUER_NAME: environmentVariable(text().optional(), {
			description:
				'Legal name of the company that issues receipts; set it together with RECEIPT_ISSUER_ADDRESS and RECEIPT_ISSUER_EMAIL, or leave all three unset (development only) to turn receipts off.',
			requiredIn: PRODUCTION_ONLY,
		}),
		RECEIPT_ISSUER_ADDRESS: environmentVariable(text().optional(), {
			description:
				'Registered postal address of the receipt issuer on one line, such as "1 Main Street, Springfield, IL 62701, United States".',
			requiredIn: PRODUCTION_ONLY,
		}),
		RECEIPT_ISSUER_EMAIL: environmentVariable(emailAddressText().optional(), {
			description: 'Billing contact address printed on every receipt.',
			requiredIn: PRODUCTION_ONLY,
		}),
		RECEIPT_ISSUER_TAX_ID: environmentVariable(text().optional(), {
			description:
				"The issuer's tax or VAT registration number, printed on receipts when set.",
		}),
	}
);
