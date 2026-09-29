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
        include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js', 'three/addons/utils/BufferGeometryUtils.js']
    },
    // Shown at the bottom of Settings, so a phone can tell which build it is running.
    define: {
        __RW_BUILD__: JSON.stringify(`${(process.env.GITHUB_SHA || 'local').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`)
    },
    ...(mode === 'demo' ? { build: { outDir: 'dist-demo', assetsInlineLimit: 100 * 1024 * 1024, copyPublicDir: false } } : {})
}));
