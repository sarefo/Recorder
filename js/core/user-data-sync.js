/**
 * Keeps favorites, practice status, notes, collections and recently played
 * in step across devices, through user-data.json on the user-data branch of
 * the repo. That branch is not the one GitHub Pages serves, so syncing never
 * redeploys the site, and the data survives any new version of the app.
 *
 * Every device pulls on start and when it comes back to the foreground; that
 * works without a token because the repo is public. Devices with a token
 * also push, a short while after each change and when the app is hidden.
 */
class UserDataSync {
    static BRANCH = 'user-data';
    static PATH = 'user-data.json';
    static RAW_URL = `https://raw.githubusercontent.com/${GitHubSync.REPO}/user-data/user-data.json`;
    static PUSH_DELAY_MS = 30 * 1000;
    /** Set while this device has changes the sync file does not have yet */
    static DIRTY_KEY = 'userDataDirty';

    /**
     * @param {Object} player - The ABC player instance
     */
    constructor(player) {
        this.player = player;
        this.userData = player.userDataManager;
        this.github = player.githubSync;
        this.pushTimer = null;
        this.running = null;
        this.rerun = false;

        this.userData.onChange = () => this.markDirty();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.sync();
            } else if (this.isDirty()) {
                this.sync();
            }
        });
        window.addEventListener('online', () => this.sync());
    }

    /**
     * First pull (and push, if changes were left over) after the app started
     */
    start() {
        this.sync();
    }

    /**
     * Notes a local change and schedules a push
     */
    markDirty() {
        try {
            localStorage.setItem(UserDataSync.DIRTY_KEY, '1');
        } catch (e) {
            // The push still happens this session; it just is not remembered
        }
        this.dirtyThisSession = true;
        if (!this.github.hasToken()) return;
        clearTimeout(this.pushTimer);
        this.pushTimer = setTimeout(() => this.sync(), UserDataSync.PUSH_DELAY_MS);
    }

    /**
     * @returns {boolean} Whether there are local changes not yet pushed
     */
    isDirty() {
        try {
            return localStorage.getItem(UserDataSync.DIRTY_KEY) === '1';
        } catch (e) {
            return !!this.dirtyThisSession;
        }
    }

    /** @private */
    clearDirty() {
        this.dirtyThisSession = false;
        try {
            localStorage.removeItem(UserDataSync.DIRTY_KEY);
        } catch (e) {
            // Nothing to clear
        }
    }

    /**
     * Pulls, merges and (with a token) pushes. Calls during a running sync
     * are folded into one more round afterwards.
     * @returns {Promise<void>}
     */
    async sync() {
        if (this.running) {
            this.rerun = true;
            return this.running;
        }
        clearTimeout(this.pushTimer);
        this.running = (async () => {
            try {
                await this.syncOnce();
            } catch (error) {
                // Offline or GitHub unavailable: local data stays, next sync retries
                console.warn('User data sync failed:', error.message);
            } finally {
                this.running = null;
            }
            if (this.rerun) {
                this.rerun = false;
                await this.sync();
            }
        })();
        return this.running;
    }

    /** @private */
    async syncOnce() {
        const canPush = this.github.hasToken();
        const remote = canPush ? await this.github.readFile(UserDataSync.PATH, UserDataSync.BRANCH)
                               : await this.readPublic();
        const remoteData = remote ? this.parse(remote.text) : null;

        if (remoteData && this.userData.mergeRemote(remoteData)) {
            this.refreshUi();
        }
        if (!canPush) return;

        // Settings stay per device; leaving them out keeps two devices from
        // overwriting each other's file over a setting
        const text = JSON.stringify({ ...this.userData.data, settings: {} }, null, 2) + '\n';
        if (remote && remote.text === text) {
            this.clearDirty();
            return;
        }
        // Another device may write in between; then the next round merges its version too
        const wasDirty = this.isDirty();
        this.clearDirty();
        try {
            await this.github.writeFile(UserDataSync.PATH, UserDataSync.BRANCH, text,
                remote ? remote.sha : null, 'Sync user data');
        } catch (error) {
            if (wasDirty) this.markDirty();
            if (error.status === 409) {
                this.rerun = true;
                return;
            }
            throw error;
        }
    }

    /**
     * Reads the sync file without a token
     * @returns {Promise<{text: string}|null>}
     * @private
     */
    async readPublic() {
        const response = await fetch(UserDataSync.RAW_URL, { cache: 'no-store' });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`GitHub error ${response.status}`);
        return { text: await response.text() };
    }

    /**
     * @param {string} text - Content of the sync file
     * @returns {Object|null} The data, or null if it is not valid user data
     * @private
     */
    parse(text) {
        try {
            const data = JSON.parse(text);
            return this.userData.validateData(data) ? data : null;
        } catch (e) {
            console.warn('User data sync file is not valid JSON');
            return null;
        }
    }

    /**
     * Shows merged-in changes for the open tune
     * @private
     */
    refreshUi() {
        const fileManager = this.player.fileManager;
        fileManager?.metadataUI?.updateInlineTagButton(fileManager.currentFilePath);
    }
}
