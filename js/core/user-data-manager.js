/**
 * UserDataManager - Manages user's personal song metadata in localStorage
 * Handles practice status, favorites, notes, collections, and recently played songs
 */
class UserDataManager {
    constructor() {
        this.storageKey = 'abc-player-user-data';
        this.data = this.loadData();
        /** Called after every local change (UserDataSync pushes from here) */
        this.onChange = null;
    }

    /**
     * Merges a copy of the data from another device into this one and stores
     * the result. Does not count as a local change.
     * @param {Object} remote - Validated data from the sync file
     * @returns {boolean} Whether the local data changed
     */
    mergeRemote(remote) {
        const before = JSON.stringify(this.data);
        this.data = UserDataManager.merge(this.data, remote);
        const changed = JSON.stringify(this.data) !== before;
        if (changed) {
            this.saveData(false);
        }
        return changed;
    }

    /**
     * Combines two copies of the user data. Per song, status, favorite and
     * notes come from the copy changed last; play counts and dates take the
     * larger value. Deleted collections stay deleted.
     * @param {Object} local - This device's data (wins ties)
     * @param {Object} remote - The other copy
     * @returns {Object} The merged data
     */
    static merge(local, remote) {
        const time = value => (value ? Date.parse(value) || 0 : 0);
        const later = (a, b) => (time(a) >= time(b) ? a : b) || null;
        const earlier = (a, b) => (!a ? b : !b ? a : time(a) <= time(b) ? a : b);
        // Entries from before sync have no updatedAt; the last play is the best guess
        const changedAt = song => time(song.updatedAt || song.lastPlayed || song.createdAt);

        const songs = {};
        for (const path of [...new Set([...Object.keys(local.songs), ...Object.keys(remote.songs)])].sort()) {
            // A song on one side only goes through the same steps, so a later
            // merge with an identical copy changes nothing
            const l = local.songs[path] || remote.songs[path];
            const r = remote.songs[path] || l;
            const newer = changedAt(r) > changedAt(l) ? r : l;
            // Fixed key order, so both devices write the same text for the same data
            songs[path] = {
                status: newer.status ?? null,
                favorite: newer.favorite === true,
                notes: newer.notes || '',
                lastPlayed: later(l.lastPlayed, r.lastPlayed),
                playCount: Math.max(l.playCount || 0, r.playCount || 0)
            };
            const createdAt = earlier(l.createdAt, r.createdAt);
            if (createdAt) songs[path].createdAt = createdAt;
            const updatedAt = later(l.updatedAt, r.updatedAt);
            if (updatedAt) songs[path].updatedAt = updatedAt;
        }

        const localDeleted = local.deletedCollections || {};
        const remoteDeleted = remote.deletedCollections || {};
        const deletedCollections = {};
        for (const id of [...new Set([...Object.keys(localDeleted), ...Object.keys(remoteDeleted)])].sort()) {
            deletedCollections[id] = later(localDeleted[id], remoteDeleted[id]);
        }
        const collectionTime = c => time(c.updatedAt || c.createdAt);
        const collections = {};
        for (const id of [...new Set([...Object.keys(local.collections), ...Object.keys(remote.collections)])].sort()) {
            const l = local.collections[id];
            const r = remote.collections[id];
            const newer = !l ? r : !r ? l : collectionTime(r) > collectionTime(l) ? r : l;
            if (deletedCollections[id] && time(deletedCollections[id]) >= collectionTime(newer)) continue;
            collections[id] = { ...newer, songPaths: [...(newer.songPaths || [])] };
        }

        const recent = new Map();
        for (const item of [...local.recentlyPlayed, ...remote.recentlyPlayed]) {
            const existing = recent.get(item.filePath);
            if (!existing || time(item.timestamp) > time(existing.timestamp)) {
                recent.set(item.filePath, item);
            }
        }
        const maxRecent = local.settings.maxRecentSongs || 20;
        const recentlyPlayed = [...recent.values()]
            .sort((a, b) => time(b.timestamp) - time(a.timestamp) || a.filePath.localeCompare(b.filePath))
            .slice(0, maxRecent);

        return {
            version: local.version,
            songs,
            collections,
            deletedCollections,
            recentlyPlayed,
            activity: UserDataManager.mergeActivity(local.activity, remote.activity),
            statusLog: UserDataManager.mergeStatusLog(local.statusLog, remote.statusLog),
            marks: UserDataManager.mergeMarks(local.marks, remote.marks),
            markStates: UserDataManager.mergeMarkStates(local.markStates, remote.markStates),
            cleanRuns: UserDataManager.mergeCleanRuns(local.cleanRuns, remote.cleanRuns),
            settings: local.settings
        };
    }

    /**
     * Combines two practice calendars (date -> path -> plays). A play is
     * counted on one device only, so the larger count is the right one.
     * @param {Object} [a] - One calendar
     * @param {Object} [b] - The other calendar
     * @returns {Object} Merged calendar, dates and paths in sorted order
     */
    static mergeActivity(a = {}, b = {}) {
        const merged = {};
        for (const date of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
            const day = {};
            const dayA = a[date] || {};
            const dayB = b[date] || {};
            for (const path of [...new Set([...Object.keys(dayA), ...Object.keys(dayB)])].sort()) {
                day[path] = Math.max(dayA[path] || 0, dayB[path] || 0);
            }
            merged[date] = day;
        }
        return merged;
    }

    /**
     * Combines two status change logs. An entry is identified by song, status
     * and time, so merging the same entries again changes nothing.
     * @param {Array} [a] - One log
     * @param {Array} [b] - The other log
     * @returns {Array} Merged log, oldest first
     */
    static mergeStatusLog(a = [], b = []) {
        const entries = new Map();
        for (const entry of [...a, ...b]) {
            entries.set(`${entry.path}|${entry.status}|${entry.at}`, entry);
        }
        return [...entries.values()].sort((x, y) =>
            x.at.localeCompare(y.at) || x.path.localeCompare(y.path));
    }

    /**
     * Combines two logs of clean runs. A run is identified by song and time,
     * so merging the same runs again changes nothing.
     * @param {Array} [a] - One log
     * @param {Array} [b] - The other log
     * @returns {Array} Merged log, oldest first
     */
    static mergeCleanRuns(a = [], b = []) {
        const runs = new Map();
        for (const run of [...a, ...b]) {
            runs.set(`${run.path}|${run.at}`, run);
        }
        return [...runs.values()].sort((x, y) =>
            x.at.localeCompare(y.at) || x.path.localeCompare(y.path));
    }

    /**
     * How many clean runs in a row each run of a song completes. Runs chain
     * on the same day as long as none was slower than the one being counted,
     * so three runs at 70% and then one at 80% give 1 at 80%, while 80%, 80%,
     * 70% give 3 at 70%.
     * @param {Array<{at: string, bpm: number}>} runs - One song's runs, oldest first
     * @returns {number[]} Streak of each run, in the same order
     */
    static cleanStreaks(runs) {
        return runs.map((run, i) => {
            const day = UserDataManager.dayKey(new Date(run.at));
            let streak = 1;
            for (let j = i - 1; j >= 0; j--) {
                const earlier = runs[j];
                if (UserDataManager.dayKey(new Date(earlier.at)) !== day || earlier.bpm < run.bpm) break;
                streak++;
            }
            return streak;
        });
    }

    /**
     * Sums up one song's clean runs
     * @param {Array<{at: string, percent: number, bpm: number}>} runs - Oldest first
     * @param {number} target - Clean runs in a row it takes to own a tempo
     * @returns {{best: number|null, last: number, lastStreak: number}|null} The
     *   fastest owned tempo (percent), and the last run with its streak; null without runs
     */
    static cleanSpeed(runs, target) {
        if (!runs.length) return null;
        const streaks = UserDataManager.cleanStreaks(runs);
        let best = null;
        runs.forEach((run, i) => {
            if (streaks[i] >= target && (best === null || run.percent > best)) best = run.percent;
        });
        return { best, last: runs[runs.length - 1].percent, lastStreak: streaks[streaks.length - 1] };
    }

    /**
     * Combines two sets of trouble-spot marks (path -> note index -> mark).
     * The copy changed last supplies the note's context; the count is the
     * larger of the two, since counts only go up.
     * @param {Object} [a] - One set (wins ties)
     * @param {Object} [b] - The other set
     * @returns {Object} Merged marks, paths and indexes in sorted order
     */
    static mergeMarks(a = {}, b = {}) {
        const time = value => (value ? Date.parse(value) || 0 : 0);
        const merged = {};
        for (const path of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
            const markA = a[path] || {};
            const markB = b[path] || {};
            merged[path] = {};
            const indexes = [...new Set([...Object.keys(markA), ...Object.keys(markB)])]
                .sort((x, y) => Number(x) - Number(y));
            for (const index of indexes) {
                const l = markA[index];
                const r = markB[index];
                if (!l || !r) {
                    merged[path][index] = l || r;
                    continue;
                }
                const newer = time(r.at) > time(l.at) ? r : l;
                merged[path][index] = { ...newer, count: Math.max(l.count || 0, r.count || 0) };
            }
        }
        return merged;
    }

    /**
     * Combines the red/green marks left on tunes (path -> {at, notes}).
     * A tune's marks are one unit: the copy changed last wins as a whole, so
     * clearing the marks on one device clears them on the other too.
     * @param {Object} [a] - One set (wins ties)
     * @param {Object} [b] - The other set
     * @returns {Object} Merged marks, paths in sorted order
     */
    static mergeMarkStates(a = {}, b = {}) {
        const time = value => (value ? Date.parse(value) || 0 : 0);
        const merged = {};
        for (const path of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
            const l = a[path];
            const r = b[path];
            merged[path] = !l ? r : !r ? l : time(r.at) > time(l.at) ? r : l;
        }
        return merged;
    }

    /**
     * Local calendar date as YYYY-MM-DD, the key of the practice calendar
     * @param {Date} [date] - Defaults to now
     * @returns {string}
     */
    static dayKey(date = new Date()) {
        const pad = n => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    /**
     * Load data from localStorage or initialize default structure
     * @returns {Object} User data object
     */
    loadData() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                // Validate data structure
                if (this.validateData(data)) {
                    return this.withHistory(data);
                }
                console.warn('Invalid user data structure, reinitializing');
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }

        // Return default structure
        return this.getDefaultData();
    }

    /**
     * Adds the practice history fields to data saved before they existed
     * @param {Object} data - Valid user data
     * @returns {Object} The same object
     */
    withHistory(data) {
        data.activity = data.activity || {};
        data.statusLog = data.statusLog || [];
        data.marks = data.marks || {};
        data.markStates = data.markStates || {};
        data.cleanRuns = data.cleanRuns || [];
        return data;
    }

    /**
     * Get default data structure
     * @returns {Object} Default user data
     */
    getDefaultData() {
        return {
            version: "1.0",
            songs: {},
            collections: {},
            recentlyPlayed: [],
            activity: {},
            statusLog: [],
            marks: {},
            markStates: {},
            cleanRuns: [],
            settings: {
                maxRecentSongs: 20,
                defaultView: "all"
            }
        };
    }

    /**
     * Validate data structure
     * @param {Object} data - Data to validate
     * @returns {boolean} True if valid
     */
    validateData(data) {
        return data &&
               data.version &&
               typeof data.songs === 'object' &&
               typeof data.collections === 'object' &&
               Array.isArray(data.recentlyPlayed) &&
               typeof data.settings === 'object';
    }

    /**
     * Save data to localStorage
     * @param {boolean} [isLocalChange=true] - false when the data came from sync
     * @returns {boolean} True if successful
     */
    saveData(isLocalChange = true) {
        if (isLocalChange && this.onChange) {
            this.onChange();
        }
        try {
            const json = JSON.stringify(this.data);
            localStorage.setItem(this.storageKey, json);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded');
                this.handleQuotaExceeded();
            } else {
                console.error('Error saving user data:', error);
            }
            return false;
        }
    }

    /**
     * Handle localStorage quota exceeded
     */
    handleQuotaExceeded() {
        // Trim old recently played entries
        if (this.data.recentlyPlayed.length > 10) {
            this.data.recentlyPlayed = this.data.recentlyPlayed.slice(0, 10);
            this.saveData();
        }

        alert('Storage quota exceeded. Some old data has been removed. Consider exporting your data as a backup.');
    }

    /**
     * Get song metadata
     * @param {string} filePath - Path to the song file
     * @returns {Object} Song metadata
     */
    getSongData(filePath) {
        if (!this.data.songs[filePath]) {
            this.data.songs[filePath] = {
                status: null,
                favorite: false,
                notes: "",
                lastPlayed: null,
                playCount: 0,
                createdAt: new Date().toISOString()
            };
        }
        return this.data.songs[filePath];
    }

    /**
     * Set song practice status
     * @param {string} filePath - Path to the song file
     * @param {string|null} status - Status: null, "needs-practice", "practicing", "good", "mastered"
     */
    setSongStatus(filePath, status) {
        const validStatuses = [null, "needs-practice", "practicing", "good", "mastered"];
        if (!validStatuses.includes(status)) {
            console.error('Invalid status:', status);
            return;
        }

        const songData = this.getSongData(filePath);
        const now = new Date().toISOString();
        if (songData.status !== status) {
            this.data.statusLog.push({ path: filePath, status, at: now });
        }
        songData.status = status;
        songData.updatedAt = now;
        this.saveData();
    }

    /**
     * Counts one play of a song on today's practice calendar. Called when
     * playback actually starts, not when a tune is merely opened.
     * @param {string} filePath - Path to the song file
     */
    recordPractice(filePath) {
        const day = UserDataManager.dayKey();
        const plays = this.data.activity[day] = this.data.activity[day] || {};
        plays[filePath] = (plays[filePath] || 0) + 1;
        this.saveData();
    }

    /**
     * Toggle favorite status
     * @param {string} filePath - Path to the song file
     * @returns {boolean} New favorite state
     */
    toggleFavorite(filePath) {
        const songData = this.getSongData(filePath);
        songData.favorite = !songData.favorite;
        songData.updatedAt = new Date().toISOString();
        this.saveData();
        return songData.favorite;
    }

    /**
     * Set song notes
     * @param {string} filePath - Path to the song file
     * @param {string} notes - Practice notes
     */
    setSongNotes(filePath, notes) {
        const songData = this.getSongData(filePath);
        songData.notes = notes || "";
        songData.updatedAt = new Date().toISOString();
        this.saveData();
    }

    /**
     * Record song playback
     * @param {string} filePath - Path to the song file
     */
    recordPlayback(filePath) {
        const songData = this.getSongData(filePath);
        songData.lastPlayed = new Date().toISOString();
        songData.playCount = (songData.playCount || 0) + 1;

        // Update recently played list
        this.data.recentlyPlayed = this.data.recentlyPlayed.filter(
            item => item.filePath !== filePath
        );
        this.data.recentlyPlayed.unshift({
            filePath: filePath,
            timestamp: songData.lastPlayed
        });

        // Trim to max recent songs
        const maxRecent = this.data.settings.maxRecentSongs || 20;
        if (this.data.recentlyPlayed.length > maxRecent) {
            this.data.recentlyPlayed = this.data.recentlyPlayed.slice(0, maxRecent);
        }

        this.saveData();
    }

    /**
     * Counts one more red mark on a note of a tune, replacing the context
     * stored with it (the latest key and fingering are the ones that matter)
     * @param {string} filePath - Path to the song file
     * @param {string|number} noteIndex - Index of the note in the rendered tune
     * @param {{pitch: string, prev: string|null, pitchSeen: number, transSeen: number}} context
     */
    recordMark(filePath, noteIndex, context) {
        const marks = this.data.marks[filePath] = this.data.marks[filePath] || {};
        const previous = marks[noteIndex];
        marks[noteIndex] = {
            pitch: context.pitch,
            prev: context.prev,
            pitchSeen: context.pitchSeen,
            transSeen: context.transSeen,
            count: (previous?.count || 0) + 1,
            at: new Date().toISOString()
        };
        this.saveData();
    }

    /**
     * Remembers the red or green mark of one note, so it is still there when
     * the tune is opened again. Neutral forgets it.
     * @param {string} filePath - Path to the song file
     * @param {string|number} noteIndex - Index of the note in the rendered tune
     * @param {string} state - 'red', 'green' or 'neutral'
     * @param {string} pitch - The note's pitch when marked, to recognize it later
     */
    setMarkState(filePath, noteIndex, state, pitch) {
        const entry = this.data.markStates[filePath] = this.data.markStates[filePath] || { at: null, notes: {} };
        if (state === 'neutral') {
            delete entry.notes[noteIndex];
        } else {
            entry.notes[noteIndex] = { state, pitch };
        }
        entry.at = new Date().toISOString();
        this.saveData();
    }

    /**
     * Forgets every remembered mark of a tune. The entry stays, empty and
     * dated, so syncing does not bring the old marks back from another device.
     * @param {string} filePath - Path to the song file
     */
    clearMarkStates(filePath) {
        this.data.markStates[filePath] = { at: new Date().toISOString(), notes: {} };
        this.saveData();
    }

    /**
     * Logs one run through a tune played without a mistake
     * @param {string} filePath - Path to the song file
     * @param {number} percent - Tempo control setting, 100 = the tune's own tempo
     * @param {number} bpm - Tempo actually played, in the tune's beat unit
     * @returns {number} How many clean runs in a row this one completes
     */
    recordCleanRun(filePath, percent, bpm) {
        this.data.cleanRuns.push({ path: filePath, at: new Date().toISOString(), percent, bpm });
        this.saveData();
        const runs = this.data.cleanRuns.filter(run => run.path === filePath);
        return UserDataManager.cleanStreaks(runs).pop();
    }

    /**
     * @param {string} filePath - Path to the song file
     * @param {number} target - Clean runs in a row it takes to own a tempo
     * @returns {Object|null} See UserDataManager.cleanSpeed
     */
    getCleanSpeed(filePath, target) {
        return UserDataManager.cleanSpeed(this.data.cleanRuns.filter(run => run.path === filePath), target);
    }

    /**
     * Get all favorite songs
     * @returns {Array} Array of file paths
     */
    getFavoriteSongs() {
        return Object.keys(this.data.songs).filter(
            filePath => this.data.songs[filePath].favorite
        );
    }

    /**
     * Get songs by practice status
     * @param {string} status - Status to filter by
     * @returns {Array} Array of file paths
     */
    getSongsByStatus(status) {
        return Object.keys(this.data.songs).filter(
            filePath => this.data.songs[filePath].status === status
        );
    }

    /**
     * Get recently played songs
     * @param {number} limit - Maximum number of songs to return
     * @returns {Array} Array of objects with filePath and timestamp
     */
    getRecentSongs(limit = 20) {
        return this.data.recentlyPlayed.slice(0, limit);
    }

    /**
     * Create a new collection
     * @param {string} name - Collection name
     * @param {Array} songPaths - Array of song file paths
     * @returns {string} Collection ID
     */
    createCollection(name, songPaths = []) {
        const id = this.generateUUID();
        this.data.collections[id] = {
            id: id,
            name: name,
            songPaths: songPaths,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.saveData();
        return id;
    }

    /**
     * Update a collection
     * @param {string} id - Collection ID
     * @param {Object} updates - Updates to apply
     */
    updateCollection(id, updates) {
        if (!this.data.collections[id]) {
            console.error('Collection not found:', id);
            return;
        }

        Object.assign(this.data.collections[id], updates, { updatedAt: new Date().toISOString() });
        this.saveData();
    }

    /**
     * Delete a collection
     * @param {string} id - Collection ID
     */
    deleteCollection(id) {
        if (this.data.collections[id]) {
            delete this.data.collections[id];
            // Remembered so syncing does not bring it back from another device
            this.data.deletedCollections = this.data.deletedCollections || {};
            this.data.deletedCollections[id] = new Date().toISOString();
            this.saveData();
        }
    }

    /**
     * Get all collections
     * @returns {Array} Array of collection objects
     */
    getCollections() {
        return Object.values(this.data.collections);
    }

    /**
     * Get a specific collection
     * @param {string} id - Collection ID
     * @returns {Object|null} Collection object or null
     */
    getCollection(id) {
        return this.data.collections[id] || null;
    }

    /**
     * Add song to collection
     * @param {string} collectionId - Collection ID
     * @param {string} filePath - Song file path
     */
    addToCollection(collectionId, filePath) {
        const collection = this.data.collections[collectionId];
        if (collection && !collection.songPaths.includes(filePath)) {
            collection.songPaths.push(filePath);
            collection.updatedAt = new Date().toISOString();
            this.saveData();
        }
    }

    /**
     * Remove song from collection
     * @param {string} collectionId - Collection ID
     * @param {string} filePath - Song file path
     */
    removeFromCollection(collectionId, filePath) {
        const collection = this.data.collections[collectionId];
        if (collection) {
            collection.songPaths = collection.songPaths.filter(
                path => path !== filePath
            );
            collection.updatedAt = new Date().toISOString();
            this.saveData();
        }
    }

    /**
     * Export all user data as JSON
     * @returns {string} JSON string
     */
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    /**
     * Import user data from JSON
     * @param {string} jsonString - JSON data to import
     * @param {boolean} merge - If true, merge with existing data; if false, replace
     * @returns {boolean} True if successful
     */
    importData(jsonString, merge = false) {
        try {
            const importedData = JSON.parse(jsonString);

            if (!this.validateData(importedData)) {
                throw new Error('Invalid data structure');
            }

            if (merge) {
                // Merge songs
                Object.assign(this.data.songs, importedData.songs);

                // Merge collections
                Object.assign(this.data.collections, importedData.collections);

                // Merge recently played (remove duplicates, keep most recent)
                const recentMap = new Map();
                [...this.data.recentlyPlayed, ...importedData.recentlyPlayed].forEach(item => {
                    const existing = recentMap.get(item.filePath);
                    if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
                        recentMap.set(item.filePath, item);
                    }
                });
                this.data.recentlyPlayed = Array.from(recentMap.values())
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, this.data.settings.maxRecentSongs);

                this.data.activity = UserDataManager.mergeActivity(this.data.activity, importedData.activity);
                this.data.statusLog = UserDataManager.mergeStatusLog(this.data.statusLog, importedData.statusLog);
                this.data.marks = UserDataManager.mergeMarks(this.data.marks, importedData.marks);
                this.data.markStates = UserDataManager.mergeMarkStates(this.data.markStates, importedData.markStates);
                this.data.cleanRuns = UserDataManager.mergeCleanRuns(this.data.cleanRuns, importedData.cleanRuns);

                // Merge settings
                Object.assign(this.data.settings, importedData.settings);
            } else {
                // Replace all data
                this.data = this.withHistory(importedData);
            }

            this.saveData();
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            alert('Failed to import data: ' + error.message);
            return false;
        }
    }

    /**
     * Clear all user data
     */
    clearAllData() {
        this.data = this.getDefaultData();
        this.saveData();
    }

    /**
     * Generate a simple UUID
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Get statistics about stored data
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return {
            totalSongs: Object.keys(this.data.songs).length,
            favoriteSongs: this.getFavoriteSongs().length,
            needsPractice: this.getSongsByStatus('needs-practice').length,
            practicing: this.getSongsByStatus('practicing').length,
            good: this.getSongsByStatus('good').length,
            mastered: this.getSongsByStatus('mastered').length,
            totalCollections: Object.keys(this.data.collections).length,
            recentlyPlayed: this.data.recentlyPlayed.length,
            storageUsed: new Blob([JSON.stringify(this.data)]).size
        };
    }
}
