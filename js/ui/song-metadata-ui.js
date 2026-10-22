/**
 * SongMetadataUI - Handles UI components for song metadata (stars, status, notes)
 */
class SongMetadataUI {
    static STATUS_COLORS = {
        'needs-practice': '#f44336',
        'practicing': '#ff9800',
        'good': '#4caf50',
        'mastered': '#9c27b0'
    };

    constructor(userDataManager, fileManager) {
        this.userDataManager = userDataManager;
        this.fileManager = fileManager;
    }

    /**
     * Create a star button for favoriting songs
     * @param {string} filePath - Path to the song file
     * @param {HTMLElement} fileItem - The file item element
     * @returns {HTMLElement} Star button
     */
    createStarButton(filePath, fileItem) {
        const songData = this.userDataManager.getSongData(filePath);

        const starButton = document.createElement('button');
        starButton.className = 'song-favorite-star';
        starButton.innerHTML = songData.favorite ? '⭐' : '☆';
        starButton.title = songData.favorite ? 'Remove from favorites' : 'Add to favorites';

        // Removing a favorite takes a second tap: the first one arms the star
        let disarmTimer = null;
        const disarm = () => {
            clearTimeout(disarmTimer);
            disarmTimer = null;
            starButton.classList.remove('confirming');
            starButton.innerHTML = '⭐';
            starButton.title = 'Remove from favorites';
        };

        starButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent file from loading

            const isFavorite = this.userDataManager.getSongData(filePath).favorite === true;
            if (isFavorite && !disarmTimer) {
                starButton.classList.add('confirming');
                starButton.innerHTML = '✕';
                starButton.title = 'Tap again to remove from favorites';
                disarmTimer = setTimeout(disarm, 3000);
                if (navigator.vibrate) {
                    navigator.vibrate(15);
                }
                return;
            }
            if (disarmTimer) {
                clearTimeout(disarmTimer);
                disarmTimer = null;
                starButton.classList.remove('confirming');
            }

            const newState = this.userDataManager.toggleFavorite(filePath);
            starButton.innerHTML = newState ? '⭐' : '☆';
            starButton.title = newState ? 'Remove from favorites' : 'Add to favorites';

            // Add animation
            starButton.classList.add('toggling');
            setTimeout(() => starButton.classList.remove('toggling'), 400);

            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(30);
            }

            // Only refresh if we're in favorites filter (item should disappear)
            // For other filters, the star just updates in place
            if (this.fileManager.currentFilter === 'favorites') {
                const filesList = document.querySelector('.files-list');
                if (filesList) {
                    // Save folder expansion states before refresh
                    const expandedFolders = this.saveExpandedFolders();

                    const dummyHandler = () => {};
                    this.fileManager.populateFilesList(filesList, dummyHandler);

                    // Restore folder expansion states after refresh
                    this.restoreExpandedFolders(expandedFolders);
                }
            }
        });

        return starButton;
    }

    /**
     * Create a status badge for a song
     * @param {string} filePath - Path to the song file
     * @returns {HTMLElement|null} Status badge or null if no status
     */
    createStatusBadge(filePath) {
        const songData = this.userDataManager.getSongData(filePath);

        if (!songData.status) {
            return null;
        }

        const badge = document.createElement('div');
        badge.className = `song-status-badge status-${songData.status}`;
        badge.title = this.getStatusLabel(songData.status);

        return badge;
    }

    /**
     * Create notes indicator icon
     * @param {string} filePath - Path to the song file
     * @returns {HTMLElement|null} Notes icon or null if no notes
     */
    createNotesIndicator(filePath) {
        const songData = this.userDataManager.getSongData(filePath);

        if (!songData.notes || songData.notes.trim() === '') {
            return null;
        }

        const icon = document.createElement('button');
        icon.className = 'song-notes-indicator';
        icon.innerHTML = '📝';
        icon.title = 'View notes';

        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showNotesDialog(filePath);
        });

        return icon;
    }

    /**
     * Create status selector menu
     * @param {string} filePath - Path to the song file
     * @param {HTMLElement} fileItem - The file item element
     * @returns {HTMLElement} Status selector
     */
    createStatusSelector(filePath, fileItem) {
        const songData = this.userDataManager.getSongData(filePath);

        const selector = document.createElement('div');
        selector.className = 'song-status-selector';

        const statuses = [
            { value: null, label: 'No Status', color: '' },
            { value: 'needs-practice', label: 'Needs Practice', color: '#f44336' },
            { value: 'practicing', label: 'Practicing', color: '#ff9800' },
            { value: 'good', label: 'Good', color: '#4caf50' },
            { value: 'mastered', label: 'Mastered', color: '#9c27b0' }
        ];

        statuses.forEach(status => {
            const option = document.createElement('button');
            option.className = 'status-option';
            option.textContent = status.label;
            if (status.color) {
                option.style.borderLeft = `4px solid ${status.color}`;
            }
            if (songData.status === status.value) {
                option.classList.add('active');
            }

            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.userDataManager.setSongStatus(filePath, status.value);

                // Close selector
                selector.remove();

                // Refresh the file list to update filtering
                const filesList = document.querySelector('.files-list');
                const filesDialog = document.querySelector('.files-dialog-overlay');
                if (filesList && filesDialog) {
                    // Save folder expansion states before refresh
                    const expandedFolders = this.saveExpandedFolders();

                    // Find the escape handler from the dialog's event listeners
                    // We'll just pass a dummy handler since we're not closing the dialog
                    const dummyHandler = () => {};
                    this.fileManager.populateFilesList(filesList, dummyHandler);

                    // Restore folder expansion states after refresh
                    this.restoreExpandedFolders(expandedFolders);
                }
            });

            selector.appendChild(option);
        });

        return selector;
    }

    /**
     * Show status selector menu at a specific position
     * @param {string} filePath - Path to the song file
     * @param {HTMLElement} fileItem - The file item element
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    showStatusSelector(filePath, fileItem, x, y) {
        // Remove any existing selector
        const existing = document.querySelector('.song-status-selector');
        if (existing) {
            existing.remove();
        }

        const selector = this.createStatusSelector(filePath, fileItem);
        selector.style.left = `${x}px`;
        selector.style.top = `${y}px`;
        document.body.appendChild(selector);

        // Close on outside click
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!selector.contains(e.target)) {
                    selector.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);

        // Close on escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                selector.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * Show notes dialog for a song
     * @param {string} filePath - Path to the song file
     */
    showNotesDialog(filePath) {
        const songData = this.userDataManager.getSongData(filePath);
        const filename = filePath.split('/').pop();

        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'notes-dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'notes-dialog';

        // Header
        const header = document.createElement('div');
        header.className = 'notes-dialog-header';

        const title = document.createElement('h3');
        title.textContent = `Notes: ${filename}`;
        header.appendChild(title);

        const closeButton = document.createElement('button');
        closeButton.className = 'notes-dialog-close';
        closeButton.innerHTML = '×';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        header.appendChild(closeButton);

        // Textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'notes-dialog-textarea';
        textarea.placeholder = 'Add practice notes here...';
        textarea.value = songData.notes || '';

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'notes-dialog-buttons';

        const saveButton = document.createElement('button');
        saveButton.className = 'notes-dialog-save';
        saveButton.textContent = 'Save';
        saveButton.addEventListener('click', () => {
            this.userDataManager.setSongNotes(filePath, textarea.value);

            // Update notes indicator in file list
            const fileItem = document.querySelector(`.file-item[data-file="${filePath}"]`);
            if (fileItem) {
                const existingIndicator = fileItem.querySelector('.song-notes-indicator');
                if (textarea.value.trim() !== '') {
                    if (!existingIndicator) {
                        const newIndicator = this.createNotesIndicator(filePath);
                        if (newIndicator) {
                            fileItem.appendChild(newIndicator);
                        }
                    }
                } else {
                    if (existingIndicator) {
                        existingIndicator.remove();
                    }
                }
            }

            document.body.removeChild(overlay);
            Utils.showFeedback('Notes saved');
        });

        const cancelButton = document.createElement('button');
        cancelButton.className = 'notes-dialog-cancel';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        buttonContainer.appendChild(saveButton);
        buttonContainer.appendChild(cancelButton);

        // Assemble dialog
        dialog.appendChild(header);
        dialog.appendChild(textarea);
        dialog.appendChild(buttonContainer);
        overlay.appendChild(dialog);

        // Add to body
        document.body.appendChild(overlay);

        // Focus textarea
        setTimeout(() => textarea.focus(), 100);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Create filter tabs for the files dialog
     * @param {HTMLElement} container - Container to add tabs to
     * @param {Function} onFilterChange - Callback when filter changes
     */
    createFilterTabs(container, onFilterChange) {
        const tabBar = document.createElement('div');
        tabBar.className = 'filter-tabs';

        const stats = this.userDataManager.getStatistics();

        const tabs = [
            { id: 'all', label: 'All', icon: '📁', count: null },
            { id: 'favorites', label: 'Favorites', icon: '⭐', count: stats.favoriteSongs },
            { id: 'needs-practice', label: 'Needs Practice', icon: '🔴', count: stats.needsPractice },
            { id: 'practicing', label: 'Practicing', icon: '🟠', count: stats.practicing },
            { id: 'good', label: 'Good', icon: '🟢', count: stats.good },
            { id: 'mastered', label: 'Mastered', icon: '🟣', count: stats.mastered },
            { id: 'recent', label: 'Recent', icon: '🕐', count: stats.recentlyPlayed }
        ];

        tabs.forEach(tab => {
            const button = document.createElement('button');
            button.className = 'filter-tab';
            button.dataset.filter = tab.id;

            if (this.fileManager.currentFilter === tab.id) {
                button.classList.add('active');
            }

            const iconSpan = document.createElement('span');
            iconSpan.className = 'filter-tab-icon';
            iconSpan.textContent = tab.icon;
            button.appendChild(iconSpan);

            const labelSpan = document.createElement('span');
            labelSpan.className = 'filter-tab-label';
            labelSpan.textContent = tab.label;
            button.appendChild(labelSpan);

            if (tab.count !== null && tab.count > 0) {
                const countSpan = document.createElement('span');
                countSpan.className = 'filter-tab-count';
                countSpan.textContent = `(${tab.count})`;
                button.appendChild(countSpan);
            }

            button.addEventListener('click', () => {
                // Update active state
                tabBar.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                button.classList.add('active');

                // Call callback
                onFilterChange(tab.id);
            });

            tabBar.appendChild(button);
        });

        container.appendChild(tabBar);
    }

    /**
     * Show settings menu with export/import options
     */
    showSettingsMenu() {
        const overlay = document.createElement('div');
        overlay.className = 'settings-menu-overlay';

        const menu = document.createElement('div');
        menu.className = 'settings-menu';

        const title = document.createElement('h3');
        title.textContent = 'User Data Management';
        menu.appendChild(title);

        // Export button
        const exportButton = document.createElement('button');
        exportButton.className = 'settings-menu-button';
        exportButton.textContent = '📥 Export Data';
        exportButton.addEventListener('click', () => {
            this.exportUserData();
            document.body.removeChild(overlay);
        });
        menu.appendChild(exportButton);

        // Import button
        const importButton = document.createElement('button');
        importButton.className = 'settings-menu-button';
        importButton.textContent = '📤 Import Data';
        importButton.addEventListener('click', () => {
            this.importUserData();
            document.body.removeChild(overlay);
        });
        menu.appendChild(importButton);

        // Clear data button
        const clearButton = document.createElement('button');
        clearButton.className = 'settings-menu-button danger';
        clearButton.textContent = '🗑️ Clear All Data';
        clearButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all user data? This cannot be undone.')) {
                this.userDataManager.clearAllData();
                document.body.removeChild(overlay);
                Utils.showFeedback('User data cleared');

                // Refresh files dialog if open
                const filesDialog = document.querySelector('.files-dialog');
                if (filesDialog) {
                    location.reload(); // Simple refresh to update UI
                }
            }
        });
        menu.appendChild(clearButton);

        // Statistics
        const stats = this.userDataManager.getStatistics();
        const statsDiv = document.createElement('div');
        statsDiv.className = 'settings-stats';
        statsDiv.innerHTML = `
            <p><strong>Statistics:</strong></p>
            <ul>
                <li>Total songs tracked: ${stats.totalSongs}</li>
                <li>Favorites: ${stats.favoriteSongs}</li>
                <li>Collections: ${stats.totalCollections}</li>
                <li>Storage used: ${(stats.storageUsed / 1024).toFixed(2)} KB</li>
            </ul>
        `;
        menu.appendChild(statsDiv);

        menu.appendChild(this.createGitHubSection());

        // Close button
        const closeButton = document.createElement('button');
        closeButton.className = 'settings-menu-close';
        closeButton.innerHTML = '×';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        menu.appendChild(closeButton);

        overlay.appendChild(menu);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }

    /**
     * Builds the settings section for the GitHub token that lets transpose
     * mode save a new key to the tune file in the repo
     * @returns {HTMLElement} The section
     */
    createGitHubSection() {
        const githubSync = this.fileManager.player.githubSync;

        const section = document.createElement('div');
        section.className = 'settings-github';

        const heading = document.createElement('p');
        heading.innerHTML = '<strong>GitHub token</strong>';
        section.appendChild(heading);

        const help = document.createElement('p');
        help.className = 'settings-github-help';
        help.innerHTML = 'Lets transpose mode save a new key and tempo to the tune file, and ' +
            'syncs favorites, practice status and notes to your other devices. ' +
            '<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Create a fine-grained token</a> ' +
            'for sarefo/Recorder with Contents: read and write. It stays in this browser.';
        section.appendChild(help);

        const status = document.createElement('p');
        status.className = 'settings-github-status';
        const showStatus = (text) => {
            status.textContent = text || (githubSync.hasToken() ? 'Token set on this device.' : 'No token set.');
        };
        showStatus();
        section.appendChild(status);

        const input = document.createElement('input');
        input.type = 'password';
        input.className = 'settings-github-input';
        input.placeholder = 'github_pat_…';
        input.autocomplete = 'off';
        input.spellcheck = false;
        section.appendChild(input);

        const row = document.createElement('div');
        row.className = 'settings-github-row';

        const saveButton = document.createElement('button');
        saveButton.className = 'settings-menu-button';
        saveButton.textContent = 'Save token';
        saveButton.addEventListener('click', async () => {
            const token = input.value.trim();
            if (!token) {
                showStatus('Paste a token first.');
                return;
            }
            const previous = githubSync.getToken();
            githubSync.setToken(token);
            showStatus('Checking…');
            try {
                await githubSync.checkToken();
                input.value = '';
                showStatus('Token works and is saved.');
            } catch (error) {
                githubSync.setToken(previous);
                showStatus(`Not saved: ${error.message}`);
            }
        });
        row.appendChild(saveButton);

        const removeButton = document.createElement('button');
        removeButton.className = 'settings-menu-button danger';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => {
            githubSync.setToken('');
            showStatus('Token removed.');
        });
        row.appendChild(removeButton);

        section.appendChild(row);
        return section;
    }

    /**
     * Export user data as JSON file
     */
    exportUserData() {
        const jsonData = this.userDataManager.exportData();
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `abc-player-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showFeedback('Data exported successfully');
    }

    /**
     * Import user data from JSON file
     */
    importUserData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const merge = confirm('Merge with existing data? Click OK to merge, Cancel to replace.');
                const success = this.userDataManager.importData(event.target.result, merge);

                if (success) {
                    Utils.showFeedback('Data imported successfully');

                    // Refresh files dialog if open
                    const filesDialog = document.querySelector('.files-dialog');
                    if (filesDialog) {
                        location.reload(); // Simple refresh to update UI
                    }
                }
            };
            reader.readAsText(file);
        });

        input.click();
    }

    /**
     * Get human-readable status label
     * @param {string} status - Status value
     * @returns {string} Label
     */
    getStatusLabel(status) {
        const labels = {
            'needs-practice': 'Needs Practice',
            'practicing': 'Practicing',
            'good': 'Good',
            'mastered': 'Mastered'
        };
        return labels[status] || '';
    }

    /**
     * Create context menu for file item (mobile long-press or right-click)
     * @param {string} filePath - Path to the song file
     * @param {HTMLElement} fileItem - The file item element
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    showContextMenu(filePath, fileItem, x, y) {
        // Remove existing context menu if any
        const existing = document.querySelector('.file-context-menu');
        if (existing) {
            existing.remove();
        }

        const menu = document.createElement('div');
        menu.className = 'file-context-menu';

        const songData = this.userDataManager.getSongData(filePath);

        // Favorite toggle
        const favoriteOption = document.createElement('button');
        favoriteOption.className = 'context-menu-option';
        favoriteOption.innerHTML = songData.favorite ? '☆ Remove from Favorites' : '⭐ Add to Favorites';
        favoriteOption.addEventListener('click', () => {
            this.userDataManager.toggleFavorite(filePath);
            menu.remove();
            this.updateInlineTagButton(filePath);

            // Only refresh if we're in favorites filter
            if (this.fileManager.currentFilter === 'favorites') {
                const filesList = document.querySelector('.files-list');
                if (filesList) {
                    // Save folder expansion states before refresh
                    const expandedFolders = this.saveExpandedFolders();

                    const dummyHandler = () => {};
                    this.fileManager.populateFilesList(filesList, dummyHandler);

                    // Restore folder expansion states after refresh
                    this.restoreExpandedFolders(expandedFolders);
                }
            }
        });
        menu.appendChild(favoriteOption);

        // Status section header
        const statusHeader = document.createElement('div');
        statusHeader.className = 'context-menu-section-header';
        statusHeader.textContent = 'Status';
        menu.appendChild(statusHeader);

        // Status options inline
        const statusContainer = document.createElement('div');
        statusContainer.className = 'context-menu-status-container';

        const statuses = [
            { value: null, label: 'None', color: '#ccc' },
            { value: 'needs-practice', label: 'Needs Practice', color: '#f44336' },
            { value: 'practicing', label: 'Practicing', color: '#ff9800' },
            { value: 'good', label: 'Good', color: '#4caf50' },
            { value: 'mastered', label: 'Mastered', color: '#9c27b0' }
        ];

        statuses.forEach(status => {
            const option = document.createElement('button');
            option.className = 'context-menu-status-option';
            option.textContent = status.label;
            option.style.borderLeft = `4px solid ${status.color}`;

            if (songData.status === status.value) {
                option.classList.add('active');
            }

            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.userDataManager.setSongStatus(filePath, status.value);
                menu.remove();
                this.updateInlineTagButton(filePath);

                // Refresh the file list to update filtering
                const filesList = document.querySelector('.files-list');
                const filesDialog = document.querySelector('.files-dialog-overlay');
                if (filesList && filesDialog) {
                    // Save folder expansion states before refresh
                    const expandedFolders = this.saveExpandedFolders();

                    const dummyHandler = () => {};
                    this.fileManager.populateFilesList(filesList, dummyHandler);

                    // Restore folder expansion states after refresh
                    this.restoreExpandedFolders(expandedFolders);
                }
            });

            statusContainer.appendChild(option);
        });

        menu.appendChild(statusContainer);

        // Notes
        const notesOption = document.createElement('button');
        notesOption.className = 'context-menu-option';
        notesOption.innerHTML = '📝 Edit Notes';
        notesOption.addEventListener('click', () => {
            menu.remove();
            this.showNotesDialog(filePath);
        });
        menu.appendChild(notesOption);

        document.body.appendChild(menu);

        // Adjust position to keep menu within viewport
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let finalX = x;
        let finalY = y;

        // Horizontal bounds check
        if (finalX + menuRect.width > viewportWidth) {
            finalX = viewportWidth - menuRect.width - 8; // 8px margin
        }
        if (finalX < 8) {
            finalX = 8;
        }

        // Vertical bounds check - center if would overflow
        if (finalY + menuRect.height > viewportHeight) {
            // Center vertically in viewport
            finalY = (viewportHeight - menuRect.height) / 2;
        }
        if (finalY < 8) {
            finalY = 8;
        }

        menu.style.left = `${finalX}px`;
        menu.style.top = `${finalY}px`;

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 100);
    }

    /**
     * Create the inline tag button for the control bar
     * @returns {HTMLElement} The tag button element
     */
    createInlineTagButton() {
        const button = document.createElement('button');
        button.id = 'inline-tag-button';
        button.className = 'inline-tag-button hidden';
        button.title = 'Song tags';

        // Star indicator (shown when favorited)
        const star = document.createElement('span');
        star.className = 'inline-tag-star';
        button.appendChild(star);

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const filePath = this.fileManager.currentFilePath;
            if (filePath) {
                const rect = button.getBoundingClientRect();
                this.showContextMenu(filePath, null, rect.right, rect.bottom + 5);
            }
        });

        this._inlineTagButton = button;
        return button;
    }

    /**
     * Update the inline tag button appearance based on current metadata
     * @param {string} filePath - Path to the song file, or null to hide
     */
    updateInlineTagButton(filePath) {
        const button = this._inlineTagButton || document.getElementById('inline-tag-button');
        if (!button) return;

        if (!filePath) {
            button.classList.add('hidden');
            return;
        }

        button.classList.remove('hidden');

        const songData = this.userDataManager.getSongData(filePath);

        // Update dot color based on status
        const statusColors = {
            'needs-practice': '#f44336',
            'practicing': '#ff9800',
            'good': '#4caf50',
            'mastered': '#9c27b0'
        };
        const color = statusColors[songData.status] || '#ccc';
        button.style.backgroundColor = color;

        // Update star indicator
        const star = button.querySelector('.inline-tag-star');
        if (star) {
            star.textContent = songData.favorite ? '★' : '';
        }

        // The mark beside the score title shows the same tags
        this.updateScoreTitleMark();
    }

    /**
     * Makes the engraved title in the score the handle for the open tune's
     * tags: tap, long-press or right-click it to open the tag menu. Call after
     * every render; the SVG is rebuilt each time, so listeners never stack.
     */
    setupScoreTitle() {
        const title = document.querySelector('#abc-notation .abcjs-title');
        const filePath = this.fileManager.currentFilePath;
        if (!title || !filePath) return;

        title.classList.add('score-title-taggable');
        this.bindScoreTagMenu(title);

        this.updateScoreTitleMark();
    }

    /**
     * Draws the open tune's status (colored dot) and favorite (star) just
     * right of the score title. An untagged tune gets a hollow dot, so the
     * title always shows that it can be tagged.
     */
    updateScoreTitleMark() {
        const title = document.querySelector('#abc-notation .abcjs-title.score-title-taggable');
        document.querySelectorAll('#abc-notation .score-title-mark').forEach(m => m.remove());
        const filePath = this.fileManager.currentFilePath;
        if (!title || !filePath) return;

        let bbox;
        try {
            bbox = title.getBBox();
        } catch (error) {
            // getBBox throws on detached/hidden SVG; skip the mark
            return;
        }

        const songData = this.userDataManager.getSongData(filePath);
        const color = SongMetadataUI.STATUS_COLORS[songData.status];
        const svgNs = 'http://www.w3.org/2000/svg';
        const radius = Math.max(5, bbox.height * 0.22);
        const cx = bbox.x + bbox.width + radius * 3;
        const cy = bbox.y + bbox.height / 2;

        const mark = document.createElementNS(svgNs, 'g');
        mark.setAttribute('class', 'score-title-mark');

        const dot = document.createElementNS(svgNs, 'circle');
        dot.setAttribute('cx', cx);
        dot.setAttribute('cy', cy);
        dot.setAttribute('r', radius);
        dot.setAttribute('class', color ? 'score-title-dot' : 'score-title-dot untagged');
        if (color) dot.setAttribute('fill', color);
        mark.appendChild(dot);

        if (songData.favorite) {
            const star = document.createElementNS(svgNs, 'text');
            star.setAttribute('x', cx + radius * 1.4);
            star.setAttribute('y', cy);
            star.setAttribute('class', 'score-title-star');
            star.setAttribute('font-size', radius * 2.6);
            star.setAttribute('dominant-baseline', 'central');
            star.setAttribute('stroke', 'none');
            star.textContent = '★';
            mark.appendChild(star);
        }

        // Padded transparent rect so a finger tap lands reliably
        const hit = document.createElementNS(svgNs, 'rect');
        hit.setAttribute('x', cx - radius * 2.5);
        hit.setAttribute('y', bbox.y - 4);
        hit.setAttribute('width', radius * (songData.favorite ? 7.5 : 4.5));
        hit.setAttribute('height', bbox.height + 8);
        hit.setAttribute('fill', 'transparent');
        hit.setAttribute('stroke', 'none');
        mark.appendChild(hit);

        this.bindScoreTagMenu(mark);
        title.parentNode.insertBefore(mark, title.nextSibling);
    }

    /**
     * Opens the tag menu for the open tune on tap, long-press or right-click
     * @param {Element} element - Score title or its status mark
     */
    bindScoreTagMenu(element) {
        // Android long-press and desktop right-click both arrive as
        // contextmenu; a plain tap arrives as click
        let openedAt = 0;
        const open = () => {
            const filePath = this.fileManager.currentFilePath;
            if (!filePath) return;
            const title = document.querySelector('#abc-notation .abcjs-title') || element;
            const rect = title.getBoundingClientRect();
            this.showContextMenu(filePath, null, rect.left, rect.bottom + 5);
        };
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openedAt = Date.now();
            open();
        });
        element.addEventListener('click', (e) => {
            // Keep the menu's own outside-click handler from seeing this
            e.stopPropagation();
            // The release after a long-press can still produce a click
            if (Date.now() - openedAt < 1000) return;
            open();
        });
    }

    /**
     * Refresh a file item with updated metadata
     * @param {string} filePath - Path to the song file
     * @param {HTMLElement} fileItem - The file item element
     */
    refreshFileItem(filePath, fileItem) {
        // Remove existing metadata elements
        const star = fileItem.querySelector('.song-favorite-star');
        const badge = fileItem.querySelector('.song-status-badge');
        const notes = fileItem.querySelector('.song-notes-indicator');

        if (star) star.remove();
        if (badge) badge.remove();
        if (notes) notes.remove();

        // Re-add metadata
        const newStar = this.createStarButton(filePath, fileItem);
        fileItem.appendChild(newStar);

        const newBadge = this.createStatusBadge(filePath);
        if (newBadge) {
            fileItem.appendChild(newBadge);
        }

        const newNotes = this.createNotesIndicator(filePath);
        if (newNotes) {
            fileItem.appendChild(newNotes);
        }
    }

    /**
     * Save the current expansion state of all folders
     * @returns {Array} Array of expanded folder categories
     */
    saveExpandedFolders() {
        const expandedFolders = [];
        const categories = document.querySelectorAll('.files-category');

        categories.forEach(category => {
            const button = category.querySelector('.folder-button');
            if (button && button.getAttribute('aria-expanded') === 'true') {
                expandedFolders.push(category.dataset.category);
            }
        });

        return expandedFolders;
    }

    /**
     * Restore the expansion state of folders
     * @param {Array} expandedFolders - Array of category names that should be expanded
     */
    restoreExpandedFolders(expandedFolders) {
        if (!expandedFolders || expandedFolders.length === 0) {
            return;
        }

        // Wait for DOM to update
        setTimeout(() => {
            expandedFolders.forEach(categoryName => {
                const category = document.querySelector(`.files-category[data-category="${categoryName}"]`);
                if (category) {
                    const button = category.querySelector('.folder-button');
                    const items = category.querySelector('.files-items');

                    if (button && items) {
                        items.classList.remove('collapsed');
                        button.setAttribute('aria-expanded', 'true');
                    }
                }
            });
        }, 50);
    }
}
