/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Document,
	Page,
	renderToBuffer,
	StyleSheet,
	Text,
	View,
} from '@react-pdf/renderer';
import type { BillingReceiptIssuer } from '../../billing/types/billing-receipt.types';
import {
	PDF_BOLD_WEIGHT,
	PDF_FONT_FAMILY,
	PDF_MONO_FONT_FAMILY,
} from '../../common/pdf/pdf-fonts';
import { SnapflowLogo } from '../../common/pdf/snapflow-logo';
import type { IspStatementContent } from '../utils/isp-statement.util';

const PAGE_SIZE = 'A4';
const LANGUAGE = 'en';
const LOGO_SIZE = 40;

const COLOR = {
	TEXT: '#111111',
	MUTED: '#6b6b6b',
	RULE: '#d9d9d9',
} as const;

const STATEMENT_COPY = {
	TITLE: 'Statement on a network abuse complaint',
	REFERENCE: 'Reference',
	ISSUED: 'Issued',
	FINDING: 'Finding',
	PRIVACY:
		'This statement names no Snapflow customer. Customer details are disclosed only to law enforcement with valid legal process.',
	VERIFY: 'To verify this statement, email',
	QUOTING: 'quoting the reference above.',
} as const;

const styles = StyleSheet.create({
	page: {
		fontFamily: PDF_FONT_FAMILY,
		fontSize: 10,
		color: COLOR.TEXT,
		padding: 48,
		lineHeight: 1.5,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 28,
	},
	title: { fontSize: 18, fontWeight: PDF_BOLD_WEIGHT, marginBottom: 6 },
	issuerName: { fontWeight: PDF_BOLD_WEIGHT },
	muted: { color: COLOR.MUTED },
	row: {
		flexDirection: 'row',
		paddingVertical: 5,
		borderBottomWidth: 0.5,
		borderBottomColor: COLOR.RULE,
	},
	label: { width: 130, color: COLOR.MUTED },
	value: { flex: 1, fontFamily: PDF_MONO_FONT_FAMILY, fontSize: 9 },
	sectionTitle: {
		fontWeight: PDF_BOLD_WEIGHT,
		marginTop: 22,
		marginBottom: 6,
	},
	paragraph: { marginBottom: 8 },
	footer: { marginTop: 28, color: COLOR.MUTED },
});

function IspStatementDocument({
	statement,
	issuer,
}: {
	statement: IspStatementContent;
	issuer: BillingReceiptIssuer;
}) {
	return (
		<Document
			title={STATEMENT_COPY.TITLE}
			author={issuer.name}
			language={LANGUAGE}
		>
			<Page size={PAGE_SIZE} style={styles.page}>
				<View style={styles.header}>
					<View>
						<Text style={styles.title}>{STATEMENT_COPY.TITLE}</Text>
						<Text style={styles.issuerName}>{issuer.name}</Text>
						<Text style={styles.muted}>{issuer.address}</Text>
						<Text style={styles.muted}>{issuer.email}</Text>
					</View>
					<SnapflowLogo size={LOGO_SIZE} />
				</View>
				<View style={styles.row}>
					<Text style={styles.label}>{STATEMENT_COPY.REFERENCE}</Text>
					<Text style={styles.value}>{statement.reference}</Text>
				</View>
				<View style={styles.row}>
					<Text style={styles.label}>{STATEMENT_COPY.ISSUED}</Text>
					<Text style={styles.value}>{statement.issuedAt}</Text>
				</View>
				{statement.facts.map((fact) => (
					<View key={fact.label} style={styles.row}>
						<Text style={styles.label}>{fact.label}</Text>
						<Text style={styles.value}>{fact.value}</Text>
					</View>
				))}
				<Text style={styles.sectionTitle}>{STATEMENT_COPY.FINDING}</Text>
				{statement.conclusion.map((paragraph) => (
					<Text key={paragraph} style={styles.paragraph}>
						{paragraph}
					</Text>
				))}
				<View style={styles.footer}>
					<Text style={styles.paragraph}>{STATEMENT_COPY.PRIVACY}</Text>
					<Text>
						{STATEMENT_COPY.VERIFY} {issuer.email} {STATEMENT_COPY.QUOTING}
					</Text>
				</View>
			</Page>
		</Document>
	);
}

export function renderIspStatementPdf(
	statement: IspStatementContent,
	issuer: BillingReceiptIssuer
): Promise<Buffer> {
	return renderToBuffer(
		<IspStatementDocument statement={statement} issuer={issuer} />
	);
}
