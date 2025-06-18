<template>
	<div class="product-image">
		<v-avatar :style="{ '--v-avatar-size': `${avatarSize}px` }" color="background-subdued">
			<v-icon v-if="!imageId" name="image" color="foreground-subdued" />
			<v-image
				v-if="imageId"
				:src="`/assets/${imageId}?fit=cover&width=${imageSize}&height=${imageSize}&quality=80`"
				:alt="alt"
				@error="handleError"
			/>
		</v-avatar>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
	imageId?: string | null;
	alt?: string;
	spacing?: 'compact' | 'cozy' | 'comfortable';
	viewMode?: 'grid' | 'list';
}

const props = withDefaults(defineProps<Props>(), {
	imageId: null,
	alt: 'Product image',
	spacing: 'cozy',
	viewMode: 'list',
});

const hasError = ref(false);

const handleError = () => {
	hasError.value = true;
};

// Compute avatar size based on spacing and view mode
const avatarSize = computed(() => {
	if (props.viewMode === 'grid') {
		switch (props.spacing) {
			case 'compact':
				return 80;
			case 'cozy':
				return 120;
			case 'comfortable':
				return 160;
			default:
				return 120;
		}
	} else {
		// Table view
		switch (props.spacing) {
			case 'compact':
				return 24;
			case 'cozy':
				return 60;
			case 'comfortable':
				return 48;
			default:
				return 60;
		}
	}
});

// Compute image size for URL based on avatar size
const imageSize = computed(() => {
	return avatarSize.value * 2; // 2x for retina displays
});
</script>

<style scoped>
.product-image {
	display: flex;
	align-items: center;
	justify-content: center;
}

.product-image :deep(img) {
	border-radius: var(--border-radius);
	object-fit: cover;
}
</style>
