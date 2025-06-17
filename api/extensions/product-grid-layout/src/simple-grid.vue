<template>
  <div class="simple-grid">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">Error: {{ error }}</div>
    <div v-else-if="!items || items.length === 0" class="empty">No products found</div>
    <div v-else>
      <h3>Products ({{ items.length }})</h3>
      <pre>{{ JSON.stringify(items[0], null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup>
import { watch } from 'vue';

const props = defineProps({
  items: Array,
  loading: Boolean,
  error: Object,
  collection: String,
});

watch(() => props.items, (newItems) => {
  console.log('[Simple Grid] Items:', newItems?.length, newItems);
}, { immediate: true });
</script>

<style scoped>
.simple-grid {
  padding: 20px;
}
.loading, .error, .empty {
  padding: 40px;
  text-align: center;
  color: var(--foreground-subdued);
}
</style>