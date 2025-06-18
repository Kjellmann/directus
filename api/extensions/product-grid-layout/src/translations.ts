/**
 * Translation messages for the Product Grid Layout extension
 *
 * Since Directus doesn't currently support bundling translation files with extensions,
 * we define our translations in a central file that can be imported by components.
 *
 * @see https://github.com/directus/directus/discussions/19229
 */

export const translations = {
	en: {
		// Extension-specific translations only
		// Most common strings are already in Directus core

		// Column management (specific to our product grid)
		select_columns: 'Select Columns',
		manage_columns: 'Manage Columns',
		standard_fields: 'Standard Fields',
		view_mode: 'View Mode',
		list: 'List',
		grid: 'Grid',

		// Missing from Directus core
		attributes: 'Attributes',
		apply: 'Apply',

		// Grid layout specific
		items_per_row: 'Items per Row',
		show_product_info: 'Show Product Info',
	},
	no: {
		// Norwegian translations

		// Column management (specific to our product grid)
		select_columns: 'Velg kolonner',
		manage_columns: 'Administrer kolonner',
		standard_fields: 'Standardfelt',
		view_mode: 'Visning',
		list: 'Liste',
		grid: 'Rutenett',

		// Missing from Directus core
		attributes: 'Attributter',
		apply: 'Bruk',

		// Grid layout specific
		items_per_row: 'Elementer per rad',
		show_product_info: 'Vis produktinformasjon',
	},
};

/**
 * Resolve locale to a simplified format
 * Converts 'en-US' to 'en', 'fr-FR' to 'fr', etc.
 */
export function resolveLocale(locale: string): string {
	if (locale) {
		if (locale.includes('-')) {
			return locale.split('-')[0].toLowerCase();
		}
		return locale.toLowerCase();
	}
	return 'en';
}

/**
 * Helper to create i18n options with our translations
 * @param locale - The current locale from Directus settings
 */
export function createI18nOptions(locale?: string) {
	return {
		locale: locale ? resolveLocale(locale) : 'en',
		messages: translations,
	};
}
