import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        projects: resolve(__dirname, 'projects.html'),
        villas: resolve(__dirname, 'villas.html'),
        apartments: resolve(__dirname, 'apartments.html'),
        plots: resolve(__dirname, 'plots.html'),
        investments: resolve(__dirname, 'investments.html'),
        blog: resolve(__dirname, 'blog.html'),
        contact: resolve(__dirname, 'contact.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});
