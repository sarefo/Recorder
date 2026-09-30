/**
 * Keeps Android's back gesture from closing the installed app by accident.
 *
 * In an installed web app, back on the first history entry finishes the
 * app: it drops out of the recent apps list and the next launch starts from
 * scratch. The app only ever replaces its history entry, so every back did
 * that. We keep one extra entry on top of the page instead. A back pops it,
 * and we close whatever is open (a dialog, the "…" overlay, transpose mode)
 * and put the entry back. With nothing open, back shows a hint and leaves
 * the entry off, so a second back closes the app as before.
 */
class BackGuard {
    /**
     * @param {Object} player - The ABC player instance
     */
    constructor(player) {
        this.player = player;
        this.armed = false;

        this.handlePopState = this.handlePopState.bind(this);
        window.addEventListener('popstate', this.handlePopState);

        // Chrome's back button skips entries a page pushed without a user
        // gesture, so (re)arm on a touch
        document.addEventListener('pointerdown', () => this.arm(), { capture: true });
    }

    /**
     * Pushes the guard entry, carrying the app's current URL
     */
    arm() {
        if (this.armed) return;
        this.armed = true;
        window.history.pushState({ backGuard: true }, '', window.location.href);
        // The entry below may hold an older URL than what is on screen
        try {
            this.player.shareManager.updateUrlWithCurrentContent();
        } catch (e) {
            // No tune loaded yet; the URL stays as it was
        }
    }

    /**
     * Back was pressed and the guard entry is gone
     */
    handlePopState() {
        this.armed = false;
        if (this.closeTopLayer()) {
            this.arm();
        } else {
            Utils.showFeedback('Press back again to close the app', 2500);
        }
    }

    /**
     * Closes the topmost open dialog, menu or mode
     * @returns {boolean} Whether something was closed
     */
    closeTopLayer() {
        const popup = document.querySelector('.file-context-menu, .song-status-selector');
        if (popup) {
            popup.remove();
            return true;
        }

        const tuningModal = this.player.uiControls?.tuningModal;
        if (tuningModal?.modal && tuningModal.modal.style.display !== 'none') {
            tuningModal.close();
            return true;
        }

        const settingsMenu = document.querySelector('.settings-menu-overlay');
        if (settingsMenu) {
            settingsMenu.remove();
            return true;
        }

        // These dialogs and modes clean up after themselves on Escape
        const mobileUI = this.player.mobileUI;
        if (document.querySelector('.notes-dialog-overlay, .files-dialog-overlay')
            || mobileUI?.overlayOpen || mobileUI?.transposing) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            return true;
        }

        return false;
    }
}
