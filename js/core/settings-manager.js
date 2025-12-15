class SettingsManager {
    constructor() {
        this.storageKey = 'abc-player-settings';
        this.defaults = {
            fingeringVisible: true,
            fingeringStyle: 'baroque',
            voicesOn: true,
            chordsOn: false,
            metronomeOn: true,
            loopEnabled: false,
            autoScrollEnabled: true
        };
        this.settings = {};
        this.urlParams = {};
        this.callbacks = {};
        
        this.loadSettings();
    }
    
    loadSettings() {
        // Start with defaults
        this.settings = { ...this.defaults };
        
        // Override with localStorage if available
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load settings from localStorage:', e);
        }
        
        // Parse URL parameters
        this.parseUrlParams();
        
        // Override with URL parameters (highest priority)
        this.settings = { ...this.settings, ...this.urlParams };
    }
    
    parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        this.urlParams = {};
        
        // Parse fingering visibility
        const fingering = params.get('fingering');
        if (fingering === 'visible' || fingering === 'hidden') {
            this.urlParams.fingeringVisible = fingering === 'visible';
        }
        
        // Parse fingering style
        const style = params.get('style');
        if (style === 'baroque' || style === 'german') {
            this.urlParams.fingeringStyle = style;
        }
        
        // Parse voices setting
        const voices = params.get('voices');
        if (voices === 'on' || voices === 'off') {
            this.urlParams.voicesOn = voices === 'on';
        }
        
        // Parse chords setting
        const chords = params.get('chords');
        if (chords === 'on' || chords === 'off') {
            this.urlParams.chordsOn = chords === 'on';
        }
        
        // Parse metronome setting
        const metronome = params.get('metronome');
        if (metronome === 'on' || metronome === 'off') {
            this.urlParams.metronomeOn = metronome === 'on';
        }
    }
    
    get(key) {
        return this.settings[key];
    }
    
    set(key, value) {
        // Don't save to localStorage if value is overridden by URL
        const shouldSave = !(key in this.urlParams);
        
        this.settings[key] = value;
        
        if (shouldSave) {
            this.saveToStorage();
        }
        
        // Notify listeners
        if (this.callbacks[key]) {
            this.callbacks[key].forEach(callback => callback(value));
        }
    }
    
    saveToStorage() {
        try {
            // Only save settings that aren't overridden by URL
            const toSave = {};
            Object.keys(this.settings).forEach(key => {
                if (!(key in this.urlParams)) {
                    toSave[key] = this.settings[key];
                }
            });
            localStorage.setItem(this.storageKey, JSON.stringify(toSave));
        } catch (e) {
            console.warn('Failed to save settings to localStorage:', e);
        }
    }
    
    onChange(key, callback) {
        if (!this.callbacks[key]) {
            this.callbacks[key] = [];
        }
        this.callbacks[key].push(callback);
    }
    
    isUrlOverridden(key) {
        return key in this.urlParams;
    }
    
    getAll() {
        return { ...this.settings };
    }
    
    reset() {
        this.settings = { ...this.defaults };
        this.saveToStorage();
        
        // Notify all listeners
        Object.keys(this.callbacks).forEach(key => {
            if (this.callbacks[key]) {
                this.callbacks[key].forEach(callback => callback(this.settings[key]));
            }
        });
    }
}