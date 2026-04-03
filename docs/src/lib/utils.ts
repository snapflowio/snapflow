import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function getAssetUrl(filename: string) {
	const cdnBaseUrl = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
	if (cdnBaseUrl) {
		return `${cdnBaseUrl}/${filename}`;
	}

	return `/${filename}`;
}
