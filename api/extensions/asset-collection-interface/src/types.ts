// Simplified type definitions for Akeneo-inspired asset management

export interface AssetFamily {
	id: string;
	code: string;
	name: string;
}

export interface Asset {
	id: string;
	code: string;
	label: string;
	media_file: string;
	asset_family: string;
	// Additional dynamic attributes can be added in Directus
	[key: string]: any;
}

export interface ProductAsset {
	id: string;
	products_id?: string;
	assets_id: string;
	sort: number;
}