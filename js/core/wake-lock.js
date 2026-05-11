/**
 * Keeps the device screen awake while the app is visible.
 *
 * Uses the Screen Wake Lock API where available (Chrome/Edge on Android,
 * Safari 16.4+ on iOS). The OS releases the lock automatically when the
 * tab is hidden, so we re-acquire it on `visibilitychange`.
 */
class WakeLockManager {
    constructor() {
        this.sentinel = null;
        this.supported = 'wakeLock' in navigator;
        if (!this.supported) return;

        this.acquire = this.acquire.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        this.acquire();
    }

    async acquire() {
        if (!this.supported || document.visibilityState !== 'visible') return;
        if (this.sentinel && !this.sentinel.released) return;
        try {
            this.sentinel = await navigator.wakeLock.request('screen');
            this.sentinel.addEventListener('release', () => {
                this.sentinel = null;
            });
        } catch (err) {
            // Common reasons: low battery, permissions policy, page not focused.
            // Not worth surfacing to the user — just try again on next visibility.
            console.debug('Wake lock request failed:', err?.message || err);
        }
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.acquire();
        }
    }
}
