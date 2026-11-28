/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	AbuseReportCategory,
	type AbuseReportReceipt,
	type CreateAbuseReport,
	getPublicConfig,
	submitAbuseReport,
} from '@snapflow/api-client';
import { type SubmitEvent, useEffect, useState } from 'react';
import {
	ABUSE_CATEGORY_LABEL,
	ABUSE_FORM_LIMITS,
	ABUSE_FORM_MESSAGE,
	ABUSE_REPORT_VERIFICATION_ACTION,
	ABUSE_URL_QUERY_PARAMETER,
	ANONYMOUS_CATEGORIES,
	API_BASE_PATH,
} from '@/constants/abuse';
import { useTurnstile } from '@/hooks/use-turnstile';
import { apiErrorMessage } from '@/lib/api-error';
import { HERO_BUTTON } from '@/lib/marketing-styles';
import { AbuseReportReceiptPanel } from './abuse-report-receipt';
import { DmcaFields, readDmcaNotice } from './dmca-fields';
import {
	CheckboxField,
	SelectField,
	TextAreaField,
	TextField,
} from './form-fields';

const CATEGORY_OPTIONS = Object.entries(ABUSE_CATEGORY_LABEL).map(
	([value, label]) => ({ value, label })
);

const FIELD = {
	url: 'url',
	description: 'description',
	reporterName: 'reporterName',
	reporterEmail: 'reporterEmail',
	goodFaith: 'goodFaith',
} as const satisfies Partial<Record<keyof CreateAbuseReport, string>>;

function isCategory(value: string): value is AbuseReportCategory {
	return Object.hasOwn(ABUSE_CATEGORY_LABEL, value);
}

function optionalText(form: FormData, name: string): string | undefined {
	const value = String(form.get(name) ?? '').trim();
	return value || undefined;
}

function readReport(
	form: FormData,
	category: AbuseReportCategory,
	humanVerificationToken: string
): CreateAbuseReport {
	return {
		category,
		url: String(form.get(FIELD.url) ?? '').trim(),
		description: String(form.get(FIELD.description) ?? '').trim(),
		reporterName: optionalText(form, FIELD.reporterName),
		reporterEmail: optionalText(form, FIELD.reporterEmail),
		goodFaith: form.has(FIELD.goodFaith),
		dmca:
			category === AbuseReportCategory.Copyright
				? readDmcaNotice(form)
				: undefined,
		humanVerificationToken,
	};
}

export function AbuseReportForm() {
	const [category, setCategory] = useState<AbuseReportCategory>(
		AbuseReportCategory.Phishing
	);
	const [siteKey, setSiteKey] = useState<string | null>(null);
	const [prefilledUrl, setPrefilledUrl] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [receipt, setReceipt] = useState<AbuseReportReceipt | null>(null);
	const verification = useTurnstile(siteKey, ABUSE_REPORT_VERIFICATION_ACTION);
	const contactOptional = ANONYMOUS_CATEGORIES.has(category);

	useEffect(() => {
		setPrefilledUrl(
			new URLSearchParams(window.location.search).get(
				ABUSE_URL_QUERY_PARAMETER
			) ?? ''
		);
		getPublicConfig({ baseUrl: API_BASE_PATH }).then(
			({ data }) => setSiteKey(data.humanVerification.siteKey),
			() => setError(ABUSE_FORM_MESSAGE.CONFIG_UNAVAILABLE)
		);
	}, []);

	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!verification.token) {
			setError(verification.failure ?? ABUSE_FORM_MESSAGE.VERIFICATION_PENDING);
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			const { data } = await submitAbuseReport({
				baseUrl: API_BASE_PATH,
				body: readReport(
					new FormData(event.currentTarget),
					category,
					verification.token
				),
			});
			setReceipt(data);
		} catch (failure) {
			setError(apiErrorMessage(failure, ABUSE_FORM_MESSAGE.SUBMIT_FAILED));
			verification.reset();
		} finally {
			setSubmitting(false);
		}
	}

	if (receipt) return <AbuseReportReceiptPanel receipt={receipt} />;

	return (
		<form onSubmit={submit} className="flex flex-col gap-8">
			<SelectField
				label="What are you reporting?"
				name="category"
				value={category}
				options={CATEGORY_OPTIONS}
				onChange={(event) => {
					if (isCategory(event.target.value)) setCategory(event.target.value);
				}}
			/>
			<TextField
				key={prefilledUrl}
				label="Exact URL"
				name={FIELD.url}
				type="url"
				inputMode="url"
				defaultValue={prefilledUrl}
				placeholder="https://"
				hint="Link to the content. Never upload or attach files, including for CSAM reports."
				maxLength={ABUSE_FORM_LIMITS.URL}
				required
			/>
			<TextAreaField
				label="What is wrong with it?"
				name={FIELD.description}
				maxLength={ABUSE_FORM_LIMITS.TEXT}
				required
			/>
			<div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
				<TextField
					label={contactOptional ? 'Name (optional)' : 'Name'}
					name={FIELD.reporterName}
					autoComplete="name"
					maxLength={ABUSE_FORM_LIMITS.SHORT_TEXT}
					required={!contactOptional}
				/>
				<TextField
					label={contactOptional ? 'Email (optional)' : 'Email'}
					name={FIELD.reporterEmail}
					type="email"
					autoComplete="email"
					maxLength={ABUSE_FORM_LIMITS.EMAIL}
					required={!contactOptional}
				/>
			</div>
			{category === AbuseReportCategory.Copyright ? <DmcaFields /> : null}
			<CheckboxField name={FIELD.goodFaith} required>
				I believe in good faith that the information in this report is accurate.
			</CheckboxField>
			<div ref={verification.containerRef} className="min-h-16.25" />
			{error ? (
				<p
					role="alert"
					className="border-snapflow-red border-l-2 pl-3 text-[15px] text-snapflow-paper"
				>
					{error}
				</p>
			) : null}
			<button
				type="submit"
				disabled={submitting}
				className={`${HERO_BUTTON} w-fit bg-snapflow-purple text-snapflow-ink disabled:cursor-wait disabled:opacity-60`}
			>
				{submitting ? 'Sending report' : 'Send report'}
			</button>
		</form>
	);
}
