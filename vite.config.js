import { defineConfig } from 'vite';

// Relative asset paths so the build works both at a GitHub Pages project URL
// (https://<user>.github.io/RedWest/) and from any static server root.
export default defineConfig({
    base: './',
    // Pre-bundle the Three.js add-ons used for imported characters, so the dev server does not
    // discover them mid-session and reload the page.
    optimizeDeps: {
        include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js']
    }
});
