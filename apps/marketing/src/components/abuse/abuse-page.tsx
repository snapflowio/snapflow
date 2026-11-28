/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SITE_CONFIG } from '@/config/site';
import { Path } from '@/constants/paths';
import { LegalContentLayout } from '../legal/legal-content-layout';
import { AbuseReportForm } from './abuse-report-form';

export function AbusePage() {
	return (
		<LegalContentLayout title="Report Abuse">
			<p>
				{SITE_CONFIG.NAME} is a marketplace: independent hosts run the machines
				and customers run the workloads. Use this form to report content or
				traffic coming from a {SITE_CONFIG.NAME} sandbox, preview URL, or custom
				domain. Reports go to the {SITE_CONFIG.NAME} trust and safety team,
				never to the customer or the host.
			</p>
			<p>
				Give the exact URL. Do not upload, attach, or copy child sexual abuse
				material anywhere, including into this form; the URL is enough for us to
				act. Reports of child sexual abuse material and threats to life are
				handled first and may be sent without your name or email.
			</p>
			<p>
				Copyright owners must complete the DMCA notice fields shown for
				copyright reports. Knowingly false notices can carry liability under 17
				U.S.C. § 512(f). You can also reach us at{' '}
				<a href={`mailto:${SITE_CONFIG.ABUSE_EMAIL}`}>
					{SITE_CONFIG.ABUSE_EMAIL}
				</a>
				. How we handle personal information in reports is covered in our{' '}
				<a href={Path.PRIVACY}>Privacy Policy</a>.
			</p>
			<AbuseReportForm />
		</LegalContentLayout>
	);
}
