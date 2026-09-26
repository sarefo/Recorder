/**
 * Shows which build of the app is running, and whether it is the latest.
 *
 * The running build is APP_BUILD from main.js, bumped by the pre-commit hook
 * on every commit. To learn the deployed build we fetch main.js again and read
 * its APP_BUILD: the service worker serves the app shell network-first, so
 * online this returns what is currently on the server, while the running copy
 * is whatever the page loaded with. An installed PWA can sit in the
 * background for days on an old build, so we re-check whenever the app comes
 * back to the foreground.
 */
class VersionChecker {
    /**
     * @param {string} currentBuild - The build this page is running
     */
    constructor(currentBuild) {
        this.currentBuild = currentBuild;
        this.latestBuild = null;
        this.lastCheck = 0;
        this.minCheckInterval = 60 * 1000;

        this.label = this.createLabel();
        this.banner = null;
        this.render('checking...');

        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Let the tune load first; the check is not urgent.
        setTimeout(() => this.check(), 3000);
    }

    /**
     * Creates the build label at the bottom of the page
     * @returns {HTMLElement} The label element
     */
    createLabel() {
        const label = document.createElement('div');
        label.id = 'app-version';
        label.className = 'app-version';
        label.title = 'Tap to check for a newer version';
        label.addEventListener('click', () => this.check(true));
        document.body.appendChild(label);
        return label;
    }

    /**
     * Updates the label text
     * @param {string} status - Short status shown after the build
     */
    render(status) {
        this.label.textContent = `Build ${this.currentBuild} · ${status}`;
    }

    /**
     * Re-checks when the app returns to the foreground
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.check();
        }
    }

    /**
     * Fetches the deployed main.js and compares its APP_BUILD with ours
     * @param {boolean} force - Skip the rate limit (user tapped the label)
     */
    async check(force = false) {
        const now = Date.now();
        if (!force && now - this.lastCheck < this.minCheckInterval) return;
        this.lastCheck = now;

        if (!navigator.onLine) {
            this.render('offline, cannot check');
            return;
        }
        if (force) this.render('checking...');

        try {
            const response = await fetch('js/core/main.js', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const source = await response.text();
            const match = source.match(/APP_BUILD = '([^']+)'/);
            if (!match) throw new Error('APP_BUILD not found in main.js');
            this.latestBuild = match[1];
        } catch (error) {
            console.warn('[Version] check failed:', error.message);
            this.render('could not check');
            return;
        }

        if (this.latestBuild === this.currentBuild) {
            this.render('latest');
            this.hideBanner();
        } else {
            this.render(`newer build ${this.latestBuild} available`);
            this.showBanner();
        }
    }

    /**
     * Shows a tappable notice that reloads into the new build
     */
    showBanner() {
        if (!this.banner) {
            this.banner = document.createElement('button');
            this.banner.className = 'update-banner';
            this.banner.addEventListener('click', () => this.reload());
            document.body.appendChild(this.banner);
        }
        this.banner.textContent = 'New version available · tap to reload';
        this.banner.hidden = false;
    }

    hideBanner() {
        if (this.banner) this.banner.hidden = true;
    }

    /**
     * Updates the service worker, then reloads the page
     */
    async reload() {
        try {
            const registration = await navigator.serviceWorker?.getRegistration();
            await registration?.update();
        } catch (error) {
            console.warn('[Version] service worker update failed:', error.message);
        }
        window.location.reload();
    }
}
