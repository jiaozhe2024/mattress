import { defineStore } from "pinia";
import type { Product } from "@/types/product";

interface SelectionState {
  selectedProducts: Product[];
  currentSchemeId: number | null;
}

export const useSelectionStore = defineStore("selection", {
  state: (): SelectionState => ({
    selectedProducts: [],
    currentSchemeId: null,
  }),
  getters: {
    selectedCount: (state): number => state.selectedProducts.length,
  },
  actions: {
    addProduct(product: Product): void {
      // 按 id 去重，避免同一产品重复入选
      if (!this.selectedProducts.some((p) => p.id === product.id)) {
        this.selectedProducts = [...this.selectedProducts, product];
      }
    },
    removeProduct(productId: number): void {
      this.selectedProducts = this.selectedProducts.filter(
        (p) => p.id !== productId
      );
    },
    clearSelection(): void {
      this.selectedProducts = [];
      this.currentSchemeId = null;
    },
  },
});