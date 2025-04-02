/**
 * Adds URL parameter handling and sharing functionality
 */
class ShareManager {
    constructor(player) {
        this.player = player;

        // Add debounced update function to avoid excessive URL updates
        this.updateUrlDebounced = Utils.debounce(() => {
            this.updateUrlWithCurrentContent();
        }, 1000); // Update URL after 1 second of inactivity
    }

    updateUrlWithCurrentContent() {
        // Get current ABC notation and encode it
        const abcNotation = this.player.notationParser.currentAbc;
        const encodedAbc = btoa(abcNotation);

        // Create URL with the encoded ABC as a parameter
        const url = new URL(window.location.href.split('?')[0]);
        url.searchParams.set('abc', encodedAbc);

        // Update browser URL without reloading the page
        window.history.replaceState({}, '', url.toString());
    }

    loadFromUrlParams() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const abcParam = urlParams.get('abc');

            if (abcParam) {
                // Decode the base64 encoded ABC notation (just use atob)
                const decodedAbc = atob(abcParam);

                // Validate basic ABC structure
                if (decodedAbc.includes('X:') && decodedAbc.includes('K:')) {
                    this.player.notationParser.currentAbc = decodedAbc;
                    this.player.render();

                    // Add a small message to indicate successful loading
                    this.showLoadMessage("ABC notation loaded from URL");
                    return true;
                }
            }
        } catch (e) {
            console.error("Error decoding ABC from URL:", e);
            this.showLoadMessage("Error loading ABC from URL", true);
        }
        return false;
    }

    showLoadMessage(message, isError = false) {
        const statusEl = document.getElementById('midi-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? 'red' : '#666';
            setTimeout(() => {
                statusEl.textContent = '';
                statusEl.style.color = '#666';
            }, 3000);
        }
    }

    generateShareUrl() {
        // Get current ABC notation and encode it as base64
        const abcNotation = this.player.notationParser.currentAbc;
        // Use btoa directly without encodeURIComponent
        const encodedAbc = btoa(abcNotation);

        // Create URL with the encoded ABC as a parameter
        const url = new URL(window.location.href.split('?')[0]); // Remove existing query params
        url.searchParams.set('abc', encodedAbc);

        return url.toString();
    }

    async copyShareUrl() {
        // Update URL before copying to ensure it's current
        this.updateUrlWithCurrentContent();
        return Utils.copyToClipboard(window.location.href);
    }
}
