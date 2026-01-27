/**
 * SongMetadataUI - Handles UI components for song metadata (stars, status, notes)
 */
class SongMetadataUI {
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

        starButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent file from loading
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
     * Create settings menu button
     * @returns {HTMLElement} Settings button
     */
    createSettingsButton() {
        const button = document.createElement('button');
        button.className = 'settings-button';
        button.innerHTML = '⚙️';
        button.title = 'Settings & Export/Import';

        button.addEventListener('click', () => {
            this.showSettingsMenu();
        });

        return button;
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
