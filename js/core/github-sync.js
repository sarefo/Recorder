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
     * The tempo abcjs plays a tune at, written as a Q: beat and count. For a
     * tune without a Q: line this is abcjs's default (180 beats, 120 in
     * compound meters), so saving it keeps the speed the tune was heard at.
     * @param {Object} visualObj - Rendered abcjs tune
     * @returns {{beat: string, bpm: number}|null} e.g. {beat: '1/2', bpm: 180}
     */
    static tempoOf(visualObj) {
        if (!visualObj || typeof visualObj.getBpm !== 'function' ||
            typeof visualObj.getMeterFraction !== 'function') return null;
        const meter = visualObj.getMeterFraction();
        if (!meter || !meter.den) return null;
        // Same beat abcjs uses (getBeatLength): compound meters beat in dotted notes
        const compound = [6, 9, 12].includes(meter.num) || (meter.num === 3 && meter.den === 8);
        return { beat: `${compound ? 3 : 1}/${meter.den}`, bpm: visualObj.getBpm() };
    }

    /**
     * Rewrites the first Q: line so the tune plays at a percentage of its
     * current tempo. Without a Q: line, adds one before K: from the fallback.
     * @param {string} abc - ABC text
     * @param {number} percent - Tempo percentage (100 = unchanged)
     * @param {{beat: string, bpm: number}|null} [fallback] - Tempo the tune
     *     plays at when it has no Q: line (see tempoOf)
     * @returns {{abc: string, bpm: number}|null} The new text and tempo, or
     *     null when there is nothing to scale
     */
    static scaleTempo(abc, percent, fallback = null) {
        const scale = value => Math.max(1, Math.round(value * percent / 100));
        const line = /^(Q:[^\n]*?)(\d+)(\s*)$/m;
        const match = abc.match(line);
        if (match) {
            const bpm = scale(parseInt(match[2], 10));
            return { abc: abc.replace(line, `$1${bpm}$3`), bpm };
        }
        if (/^Q:/m.test(abc) || !fallback || !/^K:/m.test(abc)) return null;
        const bpm = scale(fallback.bpm);
        return { abc: abc.replace(/^K:/m, `Q:${fallback.beat}=${bpm}\nK:`), bpm };
    }

    /**
     * Transposes a tune file in the repo and/or scales its tempo, in one
     * commit. Works from the file as it is on GitHub, not from what is on
     * screen, so the dizi offset or any other on-screen change never gets saved.
     * @param {string} filePath - Path under abc/, e.g. 'occitan/adiu paure carnaval.abc'
     * @param {Object} changes - What to save
     * @param {number} [changes.semitones=0] - Shift to apply
     * @param {number} [changes.tempoPercent=100] - Tempo to bake into the Q: line
     * @param {Object} [changes.tempoFallback] - Tempo for a file without Q: (see tempoOf)
     * @returns {Promise<{key: string, bpm: number|null}>} The new key and tempo
     */
    async saveChanges(filePath, { semitones = 0, tempoPercent = 100, tempoFallback = null } = {}) {
        const url = this.contentsUrl(filePath);
        const file = await this.request(`${url}?ref=${GitHubSync.BRANCH}`);
        const original = GitHubSync.decodeBase64Utf8(file.content);

        let text = original;
        let bpm = null;
        const parts = [];

        if (semitones !== 0) {
            text = this.player.transposeManager.transpose(text, semitones);
            if (text === original) {
                throw new Error('Transposing the file changed nothing');
            }
        }

        if (tempoPercent !== 100) {
            const scaled = GitHubSync.scaleTempo(text, tempoPercent, tempoFallback);
            if (!scaled) {
                throw new Error('Could not read the tune\'s Q: tempo line');
            }
            text = scaled.abc;
            bpm = scaled.bpm;
        }

        const title = ((original.match(/^T:\s*(.+)$/m) || [])[1] || filePath).trim();
        const keyMatch = text.match(/^K:\s*(\S+)/m);
        const key = keyMatch ? keyMatch[1] : '';

        if (semitones !== 0) {
            parts.push(`to ${key || `${semitones > 0 ? '+' : ''}${semitones}`}`);
        }
        if (bpm !== null) {
            parts.push(`tempo ${bpm}`);
        }

        await this.request(url, {
            method: 'PUT',
            body: JSON.stringify({
                message: `${semitones !== 0 ? 'Transpose' : 'Set'} ${title} ${parts.join(', ')}`,
                content: GitHubSync.encodeBase64Utf8(text),
                sha: file.sha,
                branch: GitHubSync.BRANCH
            })
        });

        this.rememberSave(filePath, text);
        return { key, bpm };
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
