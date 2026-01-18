/**
 * UserDataManager - Manages user's personal song metadata in localStorage
 * Handles practice status, favorites, notes, collections, and recently played songs
 */
class UserDataManager {
    constructor() {
        this.storageKey = 'abc-player-user-data';
        this.data = this.loadData();
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
                    return data;
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
     * Get default data structure
     * @returns {Object} Default user data
     */
    getDefaultData() {
        return {
            version: "1.0",
            songs: {},
            collections: {},
            recentlyPlayed: [],
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
     * @returns {boolean} True if successful
     */
    saveData() {
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
        songData.status = status;
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
            createdAt: new Date().toISOString()
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

        Object.assign(this.data.collections[id], updates);
        this.saveData();
    }

    /**
     * Delete a collection
     * @param {string} id - Collection ID
     */
    deleteCollection(id) {
        if (this.data.collections[id]) {
            delete this.data.collections[id];
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

                // Merge settings
                Object.assign(this.data.settings, importedData.settings);
            } else {
                // Replace all data
                this.data = importedData;
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
