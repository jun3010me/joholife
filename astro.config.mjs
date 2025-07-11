// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://joho.jun3010.me',
  integrations: [
    react(), 
    mdx(), 
    tailwind({
      applyBaseStyles: false, // 基本のLayout.astroのスタイルと競合を避ける
    })
  ],
  devToolbar: {
    enabled: false
  }
});