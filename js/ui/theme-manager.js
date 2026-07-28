/**
 * Applies and cycles the colour theme.
 *
 * Three states: 'auto' (follow the OS), 'light' and 'dark'. The choice is
 * written to the <html> data-theme attribute, which css/tokens.css keys the
 * colour tokens off; 'auto' removes the attribute so the
 * prefers-color-scheme media query takes over again.
 *
 * The initial attribute is set by an inline script in index.html so the page
 * never paints with the wrong palette; this class keeps it in sync afterwards.
 */
class ThemeManager {
    static ORDER = ['auto', 'light', 'dark'];

    static LABELS = {
        auto:  { icon: '◑', title: 'Theme: follow system (click for light)' },
        light: { icon: '☀', title: 'Theme: light (click for dark)' },
        dark:  { icon: '☽', title: 'Theme: dark (click to follow system)' }
    };

    // Matches <meta name="theme-color"> to the painted background so the PWA
    // title bar and Android task switcher do not flash the other palette.
    static THEME_COLORS = { light: '#ffffff', dark: '#121417' };

    constructor(player) {
        this.player = player;
        this.button = null;
        this.theme = this.readSetting();

        // In 'auto' the resolved palette changes when the OS does, so the
        // meta colour has to be recomputed even though the setting is stable.
        this.systemDark = window.matchMedia('(prefers-color-scheme: dark)');
        this.systemDark.addEventListener('change', () => {
            if (this.theme === 'auto') this.apply();
        });

        this.apply();
    }

    /**
     * Reads the persisted theme, tolerating an absent or invalid value
     * @returns {string} One of 'auto', 'light', 'dark'
     */
    readSetting() {
        const stored = this.player?.settingsManager?.get('theme');
        return ThemeManager.ORDER.includes(stored) ? stored : 'auto';
    }

    /**
     * The palette actually in force, resolving 'auto' against the OS
     * @returns {string} Either 'light' or 'dark'
     */
    resolvedTheme() {
        if (this.theme !== 'auto') return this.theme;
        return this.systemDark.matches ? 'dark' : 'light';
    }

    /**
     * Writes the current theme to the document and refreshes the button
     */
    apply() {
        const root = document.documentElement;
        if (this.theme === 'auto') {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', this.theme);
        }

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', ThemeManager.THEME_COLORS[this.resolvedTheme()]);

        this.updateButton();
    }

    /**
     * Sets a theme explicitly and persists it
     * @param {string} theme - One of 'auto', 'light', 'dark'
     */
    setTheme(theme) {
        if (!ThemeManager.ORDER.includes(theme)) return;
        this.theme = theme;
        this.player?.settingsManager?.set('theme', theme);
        this.apply();
    }

    /**
     * Advances to the next theme in the auto -> light -> dark cycle
     * @returns {string} The newly selected theme
     */
    cycleTheme() {
        const next = ThemeManager.ORDER[
            (ThemeManager.ORDER.indexOf(this.theme) + 1) % ThemeManager.ORDER.length
        ];
        this.setTheme(next);
        return next;
    }

    /**
     * Registers the toggle button so its icon and tooltip track the theme
     * @param {HTMLElement} button - The theme toggle button
     */
    registerButton(button) {
        this.button = button;
        this.updateButton();
    }

    /**
     * Syncs the button icon and tooltip with the current theme
     */
    updateButton() {
        if (!this.button) return;
        const label = ThemeManager.LABELS[this.theme];
        this.button.textContent = label.icon;
        this.button.title = label.title;
        this.button.setAttribute('aria-label', label.title);
        // 'auto' is the default, so only an explicit override reads as "on"
        this.button.classList.toggle('active', this.theme !== 'auto');
    }
}
