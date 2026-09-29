import { defineConfig } from 'vite';

// Relative asset paths so the build works both at a GitHub Pages project URL
// (https://<user>.github.io/RedWest/) and from any static server root.
// `vite build --mode demo` (npm run build:demo) builds the playable ad: fonts and images are inlined so
// tools/inline-demo.mjs can pack everything into one HTML file.
export default defineConfig(({ mode }) => ({
    base: './',
    // Pre-bundle the Three.js add-ons used for imported characters, so the dev server does not
    // discover them mid-session and reload the page.
    optimizeDeps: {
        include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js']
    },
    ...(mode === 'demo' ? { build: { outDir: 'dist-demo', assetsInlineLimit: 100 * 1024 * 1024, copyPublicDir: false } } : {})
}));
