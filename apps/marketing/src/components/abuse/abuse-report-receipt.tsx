/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AbuseReportReceipt } from '@snapflow/api-client';
import { MONO_FONT } from '@/lib/marketing-styles';

const RESPOND_BY_FORMAT = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'long',
	timeStyle: 'short',
});

export function AbuseReportReceiptPanel({
	receipt,
}: {
	receipt: AbuseReportReceipt;
}) {
	return (
		<section
			aria-live="polite"
			className="flex flex-col gap-4 border border-snapflow-border bg-snapflow-card p-8 max-md:p-5"
		>
			<h2 className="mt-0!">Report received</h2>
			<p>
				Thank you. We review every report and act on credible ones. If you left
				an email address, we will write to you there when the report is
				resolved.
			</p>
			<dl className={`${MONO_FONT} grid gap-2 text-sm`}>
				<dt className="font-pixel text-snapflow-paper-muted uppercase tracking-widest">
					Reference
				</dt>
				<dd className="text-snapflow-paper">{receipt.id}</dd>
				<dt className="mt-2 font-pixel text-snapflow-paper-muted uppercase tracking-widest">
					Response target
				</dt>
				<dd className="text-snapflow-paper">
					<time dateTime={receipt.respondBy}>
						{RESPOND_BY_FORMAT.format(new Date(receipt.respondBy))}
					</time>
				</dd>
			</dl>
		</section>
	);
}
