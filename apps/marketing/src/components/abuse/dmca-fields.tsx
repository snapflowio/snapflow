/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { DmcaNotice } from '@snapflow/api-client';
import { ABUSE_FORM_LIMITS } from '@/constants/abuse';
import {
	CheckboxField,
	FieldGroup,
	TextAreaField,
	TextField,
} from './form-fields';

const DMCA_FIELD = {
	copyrightedWork: 'dmca.copyrightedWork',
	infringingMaterial: 'dmca.infringingMaterial',
	address: 'dmca.address',
	phone: 'dmca.phone',
	goodFaithBelief: 'dmca.goodFaithBelief',
	accurateAndAuthorized: 'dmca.accurateAndAuthorized',
	signature: 'dmca.signature',
} as const satisfies Record<keyof DmcaNotice, string>;

export function readDmcaNotice(form: FormData): DmcaNotice {
	const text = (name: string) => String(form.get(name) ?? '').trim();
	return {
		copyrightedWork: text(DMCA_FIELD.copyrightedWork),
		infringingMaterial: text(DMCA_FIELD.infringingMaterial),
		address: text(DMCA_FIELD.address),
		phone: text(DMCA_FIELD.phone),
		goodFaithBelief: form.has(DMCA_FIELD.goodFaithBelief),
		accurateAndAuthorized: form.has(DMCA_FIELD.accurateAndAuthorized),
		signature: text(DMCA_FIELD.signature),
	};
}

export function DmcaFields() {
	return (
		<FieldGroup legend="DMCA notice (17 U.S.C. § 512(c)(3))">
			<TextAreaField
				label="Copyrighted work"
				name={DMCA_FIELD.copyrightedWork}
				hint="Identify the work you own, or a representative list if there are several."
				maxLength={ABUSE_FORM_LIMITS.TEXT}
				required
			/>
			<TextAreaField
				label="Infringing material"
				name={DMCA_FIELD.infringingMaterial}
				hint="Describe the material at the URL above so we can locate it."
				maxLength={ABUSE_FORM_LIMITS.TEXT}
				required
			/>
			<TextAreaField
				label="Postal address"
				name={DMCA_FIELD.address}
				autoComplete="street-address"
				maxLength={ABUSE_FORM_LIMITS.TEXT}
				required
			/>
			<TextField
				label="Telephone"
				name={DMCA_FIELD.phone}
				type="tel"
				autoComplete="tel"
				maxLength={ABUSE_FORM_LIMITS.SHORT_TEXT}
				required
			/>
			<CheckboxField name={DMCA_FIELD.goodFaithBelief} required>
				I have a good faith belief that use of the material in the manner
				complained of is not authorized by the copyright owner, its agent, or
				the law.
			</CheckboxField>
			<CheckboxField name={DMCA_FIELD.accurateAndAuthorized} required>
				The information in this notice is accurate, and under penalty of
				perjury, I am the owner, or authorized to act on behalf of the owner, of
				an exclusive right that is allegedly infringed.
			</CheckboxField>
			<TextField
				label="Signature"
				name={DMCA_FIELD.signature}
				hint="Type your full legal name as your electronic signature."
				autoComplete="name"
				maxLength={ABUSE_FORM_LIMITS.SHORT_TEXT}
				required
			/>
		</FieldGroup>
	);
}
