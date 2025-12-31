/**
 * Main entry point for Melody Extractor
 */

import { MelodyExtractor } from './melody-extractor.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Melody Extractor starting...');

    // Create and initialize the main application
    const app = new MelodyExtractor();

    // Make app globally accessible for debugging
    window.melodyExtractor = app;

    // Initialize
    await app.init();
});
