import type { ReactNode } from 'react';
import { defineI18nUI } from 'fumadocs-ui/i18n';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Geist_Mono, Inter } from 'next/font/google';
import {
	SidebarFolder,
	SidebarItem,
	SidebarSeparator,
} from '@/components/layout/sidebar';
import { Navbar } from '@/components/navbar';
import { Logo } from '@/components/ui/logo';
import { i18n } from '@/lib/i18n';
import { source } from '@/lib/source';
import '../global.css';

const inter = Inter({
	subsets: ['latin'],
	variable: '--font-geist-sans',
	display: 'swap',
});

const geistMono = Geist_Mono({
	subsets: ['latin'],
	variable: '--font-geist-mono',
	display: 'swap',
});

const { provider } = defineI18nUI(i18n, {
	translations: {
		en: {
			displayName: 'English',
		},
	},
});

type LayoutProps = {
	children: ReactNode;
	params: Promise<{ lang: string }>;
};

const SUPPORTED_LANGUAGES: Set<string> = new Set(i18n.languages);

export default async function Layout({ children, params }: LayoutProps) {
	const { lang: rawLang } = await params;
	const lang = SUPPORTED_LANGUAGES.has(rawLang) ? rawLang : 'en';
	return (
		<html
			lang={lang}
			className={`${inter.variable} ${geistMono.variable}`}
			suppressHydrationWarning
		>
			<head />
			<body className="flex min-h-screen flex-col font-sans">
				<RootProvider i18n={provider(lang)}>
					<Navbar />
					<DocsLayout
						tree={source.pageTree[lang]}
						nav={{
							title: <Logo className="h-7 w-auto" />,
						}}
						sidebar={{
							tabs: false,
							defaultOpenLevel: 0,
							collapsible: false,
							footer: null,
							banner: null,
							components: {
								Item: SidebarItem,
								Folder: SidebarFolder,
								Separator: SidebarSeparator,
							},
						}}
						containerProps={{
							className: 'pt-0!',
						}}
					>
						{children}
					</DocsLayout>
				</RootProvider>
			</body>
		</html>
	);
}
