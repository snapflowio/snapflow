import { type InferPageType, loader } from 'fumadocs-core/source';
import type { DocData, DocMethods } from 'fumadocs-mdx/runtime/types';
import { docs } from '@/.source/server';
import { i18n } from './i18n';

export const source = loader(docs.toFumadocsSource(), {
	baseUrl: '/',
	i18n,
});

export type PageData = DocData &
	DocMethods & {
		title: string;
		description?: string;
		full?: boolean;
	};

export type Page = InferPageType<typeof source>;
