import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'clean-urls',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url) {
            const url = new URL(req.url, 'http://localhost');
            let pathname = url.pathname;
            // Strip trailing slash if present
            if (pathname.endsWith('/') && pathname.length > 1) {
              pathname = pathname.slice(0, -1);
            }
            // Rewrite extensionless page requests to their matching html files
            if (pathname !== '/' && !pathname.includes('.') && !pathname.startsWith('/api')) {
              req.url = pathname + '.html' + url.search;
            }
          }
          next();
        });
      }
    }
  ],
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
