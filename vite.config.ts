import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: { host: 'localhost', port: 5173, protocol: 'ws' },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover'],
          'vendor-utils': ['axios', 'jsbarcode', 'xlsx'],
          'vendor-date': ['date-fns', 'react-day-picker'],
          'vendor-charts': ['recharts'],
          // Feature chunks
          'modal-components': [
            './src/components/modals/ProductFormModal.tsx',
            './src/components/modals/CustomerFormModal.tsx',
            './src/components/modals/DeleteConfirmationModal.tsx',
            './src/components/modals/QuickAddCustomerModal.tsx',
            './src/components/modals/QuickAddProductModal.tsx',
          ],
          'ui-components': [
            './src/components/ui/SearchableSelect.tsx',
            './src/components/ui/DatePicker.tsx',
            './src/components/ui/Pagination.tsx',
            './src/components/ui/SortButton.tsx',
            './src/components/ui/ViewToggle.tsx',
          ],
        },
      },
    },
  },
})
