import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        // No security headers required for FFmpeg 0.11.x in single-threaded mode
    },
});
