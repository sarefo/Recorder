/**
 * Writes tune changes back to the sarefo/Recorder repository through the
 * GitHub contents API. The site is GitHub Pages served from that repo, so a
 * commit here is a deploy: every device gets the change about a minute later.
 *
 * Needs a fine-grained personal access token (repository sarefo/Recorder,
 * permission Contents: read and write), kept in this browser's localStorage.
 */
class GitHubSync {
    static REPO = 'sarefo/Recorder';
    static BRANCH = 'master';
    static TOKEN_KEY = 'githubToken';

    /** Saved tunes shown from local copy until the redeploy catches up */
    static RECENT_SAVES_KEY = 'githubRecentSaves';
    static RECENT_SAVE_MS = 15 * 60 * 1000;

    /**
     * @param {Object} player - The ABC player instance
     */
    constructor(player) {
        this.player = player;
    }

    /**
     * @returns {string} The stored token, or '' when none is set
     */
    getToken() {
        try {
            return localStorage.getItem(GitHubSync.TOKEN_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    /**
     * Stores the token, or removes it when empty
     * @param {string} token - Personal access token
     */
    setToken(token) {
        try {
            if (token) {
                localStorage.setItem(GitHubSync.TOKEN_KEY, token.trim());
            } else {
                localStorage.removeItem(GitHubSync.TOKEN_KEY);
            }
        } catch (e) {
            console.error('Could not store GitHub token:', e);
        }
    }

    /**
     * @returns {boolean} Whether a token is set
     */
    hasToken() {
        return this.getToken() !== '';
    }

    /**
     * Checks the token against the repo without changing anything
     * @returns {Promise<void>} Resolves if the token can write to the repo
     */
    async checkToken() {
        const repo = await this.request(`https://api.github.com/repos/${GitHubSync.REPO}`);
        if (!repo.permissions || !repo.permissions.push) {
            throw new Error('Token can read the repo but not write to it');
        }
    }

    /**
     * Transposes a tune file in the repo and commits it. Works from the file
     * as it is on GitHub, not from what is on screen, so the dizi offset or
     * any other on-screen change never gets saved.
     * @param {string} filePath - Path under abc/, e.g. 'occitan/adiu paure carnaval.abc'
     * @param {number} semitones - Shift to apply
     * @returns {Promise<{key: string}>} The new key
     */
    async saveTransposition(filePath, semitones) {
        const url = this.contentsUrl(filePath);
        const file = await this.request(`${url}?ref=${GitHubSync.BRANCH}`);
        const original = GitHubSync.decodeBase64Utf8(file.content);

        const transposed = this.player.transposeManager.transpose(original, semitones);
        if (transposed === original) {
            throw new Error('Transposing the file changed nothing');
        }

        const title = (original.match(/^T:\s*(.+)$/m) || [])[1] || filePath;
        const keyMatch = transposed.match(/^K:\s*(\S+)/m);
        const key = keyMatch ? keyMatch[1] : '';

        await this.request(url, {
            method: 'PUT',
            body: JSON.stringify({
                message: `Transpose ${title.trim()} to ${key || `${semitones > 0 ? '+' : ''}${semitones}`}`,
                content: GitHubSync.encodeBase64Utf8(transposed),
                sha: file.sha,
                branch: GitHubSync.BRANCH
            })
        });

        this.rememberSave(filePath, transposed);
        return { key };
    }

    /**
     * Returns a tune saved from this device in the last few minutes, while
     * GitHub Pages may still be serving the old file
     * @param {string} filePath - Path under abc/
     * @param {string} fetchedText - What the server just returned
     * @returns {string|null} The saved text to use instead, or null
     */
    recentSave(filePath, fetchedText) {
        const saves = this.readRecentSaves();
        const entry = saves[filePath];
        if (!entry) return null;

        const expired = Date.now() - entry.savedAt > GitHubSync.RECENT_SAVE_MS;
        if (expired || entry.text === fetchedText) {
            delete saves[filePath];
            this.writeRecentSaves(saves);
            return null;
        }
        return entry.text;
    }

    /**
     * @param {string} filePath - Path under abc/
     * @param {string} text - Saved file content
     * @private
     */
    rememberSave(filePath, text) {
        const saves = this.readRecentSaves();
        saves[filePath] = { text, savedAt: Date.now() };
        this.writeRecentSaves(saves);
    }

    /** @private */
    readRecentSaves() {
        try {
            return JSON.parse(localStorage.getItem(GitHubSync.RECENT_SAVES_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    /** @private */
    writeRecentSaves(saves) {
        try {
            localStorage.setItem(GitHubSync.RECENT_SAVES_KEY, JSON.stringify(saves));
        } catch (e) {
            console.warn('Could not store recent saves:', e);
        }
    }

    /**
     * @param {string} filePath - Path under abc/
     * @returns {string} Contents API URL for the file
     * @private
     */
    contentsUrl(filePath) {
        const path = ['abc', ...filePath.split('/')].map(encodeURIComponent).join('/');
        return `https://api.github.com/repos/${GitHubSync.REPO}/contents/${path}`;
    }

    /**
     * Calls the GitHub API with the token and turns failures into readable errors
     * @param {string} url - API URL
     * @param {Object} options - fetch options
     * @returns {Promise<Object>} Parsed JSON response
     * @private
     */
    async request(url, options = {}) {
        const token = this.getToken();
        if (!token) {
            throw new Error('No GitHub token set (⚙ settings)');
        }

        let response;
        try {
            response = await fetch(url, {
                ...options,
                cache: 'no-store',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${token}`,
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
        } catch (e) {
            throw new Error('Could not reach GitHub (offline?)');
        }

        if (response.ok) {
            return response.json();
        }

        const messages = {
            401: 'GitHub rejected the token (expired or mistyped?)',
            403: 'Token has no write access to the repo',
            404: 'Not found on GitHub (or the token cannot see the repo)',
            409: 'The file changed on GitHub meanwhile; reload and try again',
            422: 'GitHub refused the change'
        };
        throw new Error(messages[response.status] || `GitHub error ${response.status}`);
    }

    /**
     * @param {string} base64 - Base64 as the contents API returns it (with line breaks)
     * @returns {string} Decoded UTF-8 text
     */
    static decodeBase64Utf8(base64) {
        const binary = atob(base64.replace(/\s/g, ''));
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    /**
     * @param {string} text - UTF-8 text
     * @returns {string} Base64
     */
    static encodeBase64Utf8(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }
        return btoa(binary);
    }
}
