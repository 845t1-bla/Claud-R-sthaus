import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Pfad, unter dem die App auf dem Server erreichbar ist.
// Standard "/" (eigene Subdomain, z. B. https://ruesthaus.beispiel.de/).
// Für einen Unterordner (z. B. https://beispiel.de/ruesthaus/) beim Bauen setzen: APP_BASE=/ruesthaus/
const base = (process.env.APP_BASE || '/').replace(/\/?$/, '/');

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173 },
  // Alle Abhängigkeiten vorab bündeln (u. a. ~5000 Icon-Dateien) – verhindert langsame Neuladeschleifen im Dev-Server
  optimizeDeps: {
    include: [
      'react',
      'react-dom/client',
      'react-router-dom',
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/modals',
      '@mantine/notifications',
      '@supabase/supabase-js',
      '@tabler/icons-react',
      'exceljs',
    ],
  },
});
