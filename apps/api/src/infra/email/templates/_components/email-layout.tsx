/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ReactNode } from 'react';
import {
	Body,
	Container,
	Font,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from 'react-email';
import {
	EMAIL_COLORS,
	EMAIL_DARK_COLORS,
	EMAIL_FONT_STACK,
	EMAIL_LOGO_SIZE_PIXELS,
	EMAIL_PRODUCT_NAME,
	EMAIL_WEBSITE_PATHS,
} from '../../constants/email.constants';
import type { EmailBrand } from '../../types/email.types';

export const EMAIL_CLASS = {
	page: 'sf-page',
	card: 'sf-card',
	heading: 'sf-heading',
	body: 'sf-body',
	muted: 'sf-muted',
	surface: 'sf-surface',
} as const;

const DARK_RULES: readonly (readonly [string, string])[] = [
	[EMAIL_CLASS.page, `background-color: ${EMAIL_DARK_COLORS.page}`],
	[
		EMAIL_CLASS.card,
		`background-color: ${EMAIL_DARK_COLORS.card}; border-color: ${EMAIL_DARK_COLORS.border}`,
	],
	[EMAIL_CLASS.heading, `color: ${EMAIL_DARK_COLORS.heading}`],
	[EMAIL_CLASS.body, `color: ${EMAIL_DARK_COLORS.body}`],
	[EMAIL_CLASS.muted, `color: ${EMAIL_DARK_COLORS.muted}`],
	[
		EMAIL_CLASS.surface,
		`background-color: ${EMAIL_DARK_COLORS.codeSurface}; border-color: ${EMAIL_DARK_COLORS.border}`,
	],
];

function importantDeclarations(declarations: string): string {
	return declarations
		.split('; ')
		.map((declaration) => `${declaration} !important;`)
		.join(' ');
}

const DARK_MODE_CSS = [
	'@media (prefers-color-scheme: dark) {',
	...DARK_RULES.map(
		([className, declarations]) =>
			`.${className} { ${importantDeclarations(declarations)} }`
	),
	'}',
	...DARK_RULES.map(
		([className, declarations]) =>
			`[data-ogsc] .${className}, [data-ogsb] .${className} { ${importantDeclarations(declarations)} }`
	),
].join('\n');

export const emailStyles = {
	page: {
		margin: 0,
		padding: '40px 0',
		backgroundColor: EMAIL_COLORS.page,
		fontFamily: EMAIL_FONT_STACK,
	},
	container: {
		width: '100%',
		maxWidth: '520px',
		margin: '0 auto',
		padding: '0 16px',
	},
	header: {
		padding: '0 0 24px',
	},
	logo: {
		display: 'block',
		borderRadius: '11px',
	},
	card: {
		backgroundColor: EMAIL_COLORS.card,
		border: `1px solid ${EMAIL_COLORS.border}`,
		borderRadius: '12px',
		padding: '36px 32px',
	},
	heading: {
		margin: '0 0 16px',
		color: EMAIL_COLORS.heading,
		fontFamily: EMAIL_FONT_STACK,
		fontSize: '24px',
		fontWeight: 600,
		lineHeight: '32px',
		letterSpacing: '-0.01em',
	},
	paragraph: {
		margin: '0 0 16px',
		color: EMAIL_COLORS.body,
		fontSize: '15px',
		lineHeight: '24px',
	},
	note: {
		margin: '16px 0 0',
		color: EMAIL_COLORS.muted,
		fontSize: '13px',
		lineHeight: '20px',
	},
	button: {
		display: 'inline-block',
		padding: '12px 22px',
		backgroundColor: EMAIL_COLORS.primary,
		color: EMAIL_COLORS.onPrimary,
		borderRadius: '8px',
		fontFamily: EMAIL_FONT_STACK,
		fontSize: '15px',
		fontWeight: 600,
		lineHeight: '20px',
		textDecoration: 'none',
	},
	buttonRow: {
		margin: '8px 0 8px',
	},
	surface: {
		margin: '8px 0',
		padding: '20px 16px',
		backgroundColor: EMAIL_COLORS.codeSurface,
		border: `1px solid ${EMAIL_COLORS.border}`,
		borderRadius: '10px',
		textAlign: 'center' as const,
	},
	footer: {
		padding: '24px 4px 0',
	},
	footerText: {
		margin: '0 0 8px',
		color: EMAIL_COLORS.muted,
		fontSize: '12px',
		lineHeight: '18px',
	},
	footerLink: {
		color: EMAIL_COLORS.muted,
		textDecoration: 'underline',
	},
} as const;

const FOOTER_SEPARATOR = ' · ';

type EmailLayoutProps = {
	brand: EmailBrand;
	preview: string;
	heading: string;
	footerNote: string;
	children: ReactNode;
};

export function EmailLayout({
	brand,
	preview,
	heading,
	footerNote,
	children,
}: EmailLayoutProps) {
	const websiteUrl = (path: string) => `${brand.websiteUrl}${path}`;
	return (
		<Html lang="en" dir="ltr">
			<Head>
				<meta name="color-scheme" content="light dark" />
				<meta name="supported-color-schemes" content="light dark" />
				<Font
					fontFamily="Instrument Sans"
					fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
					webFont={{
						url: websiteUrl(EMAIL_WEBSITE_PATHS.font),
						format: 'woff2',
					}}
					fontWeight="400 700"
				/>
				<style>{DARK_MODE_CSS}</style>
			</Head>
			<Preview>{preview}</Preview>
			<Body className={EMAIL_CLASS.page} style={emailStyles.page}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.header}>
						<Link href={brand.websiteUrl} data-skip-in-text>
							<Img
								src={websiteUrl(EMAIL_WEBSITE_PATHS.logo)}
								width={EMAIL_LOGO_SIZE_PIXELS}
								height={EMAIL_LOGO_SIZE_PIXELS}
								alt={EMAIL_PRODUCT_NAME}
								style={emailStyles.logo}
							/>
						</Link>
					</Section>
					<Section className={EMAIL_CLASS.card} style={emailStyles.card}>
						<Heading
							as="h1"
							className={EMAIL_CLASS.heading}
							style={emailStyles.heading}
						>
							{heading}
						</Heading>
						{children}
					</Section>
					<Section style={emailStyles.footer}>
						<Text className={EMAIL_CLASS.muted} style={emailStyles.footerText}>
							{footerNote}
						</Text>
						<Text className={EMAIL_CLASS.muted} style={emailStyles.footerText}>
							<Link
								href={brand.websiteUrl}
								className={EMAIL_CLASS.muted}
								style={emailStyles.footerLink}
							>
								{EMAIL_PRODUCT_NAME}
							</Link>
							{FOOTER_SEPARATOR}
							<Link
								href={websiteUrl(EMAIL_WEBSITE_PATHS.terms)}
								className={EMAIL_CLASS.muted}
								style={emailStyles.footerLink}
							>
								Terms
							</Link>
							{FOOTER_SEPARATOR}
							<Link
								href={websiteUrl(EMAIL_WEBSITE_PATHS.privacy)}
								className={EMAIL_CLASS.muted}
								style={emailStyles.footerLink}
							>
								Privacy
							</Link>
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
