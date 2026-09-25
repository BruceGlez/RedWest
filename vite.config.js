import { defineConfig } from 'vite';

// Relative asset paths so the build works both at a GitHub Pages project URL
// (https://<user>.github.io/RedWest/) and from any static server root.
export default defineConfig({
    base: './'
});
