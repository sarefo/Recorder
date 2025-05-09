/**
 * Manages loading ABC files
 */
class FileManager {
    constructor(player) {
        this.player = player;
        this.fileList = AbcFileList.getFiles();
        this.categorizedFiles = this.categorizeFiles();
    }

    /**
     * Organizes files by category
     * @returns {Object} Files organized by category
     */
    categorizeFiles() {
        const categories = {};

        this.fileList.forEach(file => {
            if (!categories[file.category]) {
                categories[file.category] = [];
            }
            categories[file.category].push(file);
        });

        return categories;
    }

    /**
     * Load a specific ABC file by path
     * @param {string} filePath - Path to the file to load
     * @returns {Promise<boolean>} Success status
     */
    async loadFile(filePath) {
        try {
            const response = await fetch(`abc/${filePath}`);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            const abcContent = await response.text();

            // Make sure it's valid ABC notation
            if (abcContent.includes('X:') && abcContent.includes('K:')) {
                // Update the notation and render it
                this.player.notationParser.currentAbc = abcContent;
                this.player.tuneManager.resetToFirstTune();
                this.player.render();

                // Extract filename for feedback
                const filename = filePath.split('/').pop();
                Utils.showFeedback(`Loaded ${filename}`);
                return true;
            } else {
                throw new Error("Invalid ABC notation format");
            }
        } catch (error) {
            console.error(`Error loading ABC file ${filePath}:`, error);
            Utils.showFeedback(`Error loading file`, true);
            return false;
        }
    }

    /**
     * Creates the file selector UI including search functionality
     * @returns {HTMLElement} The container element with the dropdown and button
     */
    createFileSelector() {
        // Create a container for the Files button
        const container = document.createElement('div');
        container.className = 'file-selector-container';
        container.style.display = 'flex';
        container.style.alignItems = 'center';

        // Create the Files button
        const filesButton = document.createElement('button');
        filesButton.id = 'files-button';
        filesButton.className = 'files-button';
        filesButton.textContent = 'Files';
        filesButton.title = 'Browse and select files';
        filesButton.addEventListener('click', () => this.openFilesDialog());

        // Create the "Random" button
        const randomButton = document.createElement('button');
        randomButton.id = 'random-abc-button';
        randomButton.textContent = '🎲';
        randomButton.title = 'Load a random ABC file';
        randomButton.style.padding = '2px 6px';
        randomButton.style.fontSize = '1.5em';
        randomButton.style.lineHeight = '1';
        randomButton.style.cursor = 'pointer';

        // Add event listener to the random button
        randomButton.addEventListener('click', () => {
            const allFiles = this.fileList;
            if (allFiles && allFiles.length > 0) {
                const randomIndex = Math.floor(Math.random() * allFiles.length);
                const randomFile = allFiles[randomIndex];

                if (randomFile && randomFile.file) {
                    this.loadFile(randomFile.file);
                    Utils.showFeedback(`Loaded random file: ${randomFile.name}`);
                }
            } else {
                Utils.showFeedback("No files available to choose from.", true);
            }
        });

        // Append buttons to the container
        container.appendChild(filesButton);
        container.appendChild(randomButton);

        return container;
    }

    openFilesDialog() {
        // Create dialog overlay
        const dialogOverlay = document.createElement('div');
        dialogOverlay.className = 'files-dialog-overlay';
        dialogOverlay.addEventListener('click', (e) => {
            if (e.target === dialogOverlay) {
                document.body.removeChild(dialogOverlay);
            }
        });

        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'files-dialog';

        // Create dialog header
        const header = document.createElement('div');
        header.className = 'files-dialog-header';

        // Create title
        const title = document.createElement('h2');
        title.textContent = 'ABC Files';
        header.appendChild(title);

        // Create search input
        const searchContainer = document.createElement('div');
        searchContainer.className = 'files-search-container';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'files-search-input';
        searchInput.placeholder = 'Search files...';
        searchInput.addEventListener('input', (e) => {
            this.filterFilesList(e.target.value, filesList);
        });

        const searchIcon = document.createElement('span');
        searchIcon.className = 'files-search-icon';
        searchIcon.innerHTML = '🔍';

        searchContainer.appendChild(searchIcon);
        searchContainer.appendChild(searchInput);
        header.appendChild(searchContainer);

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.className = 'files-dialog-close';
        closeButton.innerHTML = '×';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(dialogOverlay);
        });
        header.appendChild(closeButton);

        // Create files list container
        const filesList = document.createElement('div');
        filesList.className = 'files-list';

        // Populate files list by category
        this.populateFilesList(filesList);

        // Assemble dialog
        dialog.appendChild(header);
        dialog.appendChild(filesList);
        dialogOverlay.appendChild(dialog);

        // Add dialog to body
        document.body.appendChild(dialogOverlay);

        // Focus search input after a brief delay (for mobile keyboard)
        //setTimeout(() => searchInput.focus(), 100);
    }

    populateFilesList(container) {
        // Sort categories alphabetically
        const sortedCategories = Object.keys(this.categorizedFiles).sort();

        // Create column containers
        const columns = document.createElement('div');
        columns.className = 'files-columns';
        container.appendChild(columns);

        // Populate each category
        sortedCategories.forEach(category => {
            const categoryContainer = this.createCategoryContainer(category);
            columns.appendChild(categoryContainer);
        });
    }

    createCategoryContainer(category) {
        const files = this.categorizedFiles[category];

        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'files-category';
        categoryContainer.dataset.category = category;

        const categoryHeader = document.createElement('h3');
        categoryHeader.textContent = category;
        categoryContainer.appendChild(categoryHeader);

        const fileItems = document.createElement('ul');
        fileItems.className = 'files-items';

        files.forEach(file => {
            const fileItem = document.createElement('li');
            fileItem.className = 'file-item';
            fileItem.textContent = file.name;
            fileItem.dataset.file = file.file;
            fileItem.dataset.name = file.name.toLowerCase();
            fileItem.dataset.category = category.toLowerCase();
            fileItem.addEventListener('click', () => {
                this.loadFile(file.file);
                // Close dialog
                const dialog = document.querySelector('.files-dialog-overlay');
                if (dialog) {
                    document.body.removeChild(dialog);
                }
            });
            fileItems.appendChild(fileItem);
        });

        categoryContainer.appendChild(fileItems);
        return categoryContainer;
    }

    filterFilesList(searchTerm, container) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const categories = container.querySelectorAll('.files-category');

        let totalVisible = 0;

        categories.forEach(category => {
            let visibleInCategory = 0;
            const fileItems = category.querySelectorAll('.file-item');

            fileItems.forEach(item => {
                const fileName = item.dataset.name;
                const categoryName = item.dataset.category;

                const matches = fileName.includes(lowerSearchTerm) ||
                    categoryName.includes(lowerSearchTerm);

                if (matches || lowerSearchTerm === '') {
                    item.style.display = '';
                    visibleInCategory++;
                    totalVisible++;
                } else {
                    item.style.display = 'none';
                }
            });

            // Show/hide category based on whether it has visible items
            category.style.display = visibleInCategory > 0 ? '' : 'none';
        });

        // Show a "no results" message if needed
        let noResults = container.querySelector('.no-results-message');

        if (totalVisible === 0 && searchTerm !== '') {
            if (!noResults) {
                noResults = document.createElement('div');
                noResults.className = 'no-results-message';
                noResults.textContent = 'No matching files found.';
                container.appendChild(noResults);
            }
            noResults.style.display = 'block';
        } else if (noResults) {
            noResults.style.display = 'none';
        }
    }

    /**
     * Updates the search results based on the search term
     * @param {string} searchTerm - The search term to filter by
     * @param {HTMLElement} resultsContainer - The container for search results
     * @param {HTMLInputElement} searchInput - The search input field
     */
    updateSearchResults(searchTerm, resultsContainer, searchInput) {
        // Clear previous results
        resultsContainer.innerHTML = '';

        // Show all files if search term is empty
        if (searchTerm.trim() === '') {
            this._showAllFiles(resultsContainer, searchInput);
            resultsContainer.style.display = 'block';
            return;
        }

        // Filter files by search term
        const matchingFiles = this.fileList.filter(file =>
            file.name.toLowerCase().includes(searchTerm) ||
            file.category.toLowerCase().includes(searchTerm)
        );

        // If no results, show a message
        if (matchingFiles.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'search-no-results';
            noResults.textContent = 'No matching files found';
            noResults.style.padding = '8px 12px';
            noResults.style.color = '#666';
            resultsContainer.appendChild(noResults);
        } else {
            // Group results by category
            const groupedResults = {};
            matchingFiles.forEach(file => {
                if (!groupedResults[file.category]) {
                    groupedResults[file.category] = [];
                }
                groupedResults[file.category].push(file);
            });

            // Add results to the container
            Object.keys(groupedResults).sort().forEach(category => {
                // Create category header
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'search-category';
                categoryHeader.textContent = category;
                categoryHeader.style.padding = '4px 12px';
                categoryHeader.style.fontWeight = 'bold';
                categoryHeader.style.backgroundColor = '#f8f8f8';
                categoryHeader.style.borderBottom = '1px solid #eee';
                resultsContainer.appendChild(categoryHeader);

                // Add files in this category
                groupedResults[category].forEach(file => {
                    const resultItem = this._createResultItem(file, searchTerm, resultsContainer, searchInput);
                    resultsContainer.appendChild(resultItem);
                });
            });
        }

        // Show results
        resultsContainer.style.display = 'block';
    }

    _showAllFiles(resultsContainer, searchInput) {
        // Group all files by category
        const groupedFiles = {};
        this.fileList.forEach(file => {
            if (!groupedFiles[file.category]) {
                groupedFiles[file.category] = [];
            }
            groupedFiles[file.category].push(file);
        });

        // Add all files grouped by category
        Object.keys(groupedFiles).sort().forEach(category => {
            // Create category header
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'search-category';
            categoryHeader.textContent = category;
            categoryHeader.style.padding = '4px 12px';
            categoryHeader.style.fontWeight = 'bold';
            categoryHeader.style.backgroundColor = '#f8f8f8';
            categoryHeader.style.borderBottom = '1px solid #eee';
            resultsContainer.appendChild(categoryHeader);

            // Add files in this category
            groupedFiles[category].forEach(file => {
                const resultItem = this._createResultItem(file, '', resultsContainer, searchInput);
                resultsContainer.appendChild(resultItem);
            });
        });
    }

    _createResultItem(file, searchTerm, resultsContainer, searchInput) {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.textContent = file.name;
        resultItem.dataset.file = file.file;
        resultItem.style.padding = '8px 12px';
        resultItem.style.cursor = 'pointer';
        resultItem.style.borderBottom = '1px solid #eee';

        // Highlight the matching part if a search term exists
        if (searchTerm && file.name.toLowerCase().includes(searchTerm)) {
            const highlightedText = file.name.replace(
                new RegExp(`(${searchTerm})`, 'gi'),
                '<span style="background-color: #ffeb3b;">$1</span>'
            );
            resultItem.innerHTML = highlightedText;
        }

        // Add click handler
        resultItem.addEventListener('click', () => {
            this.loadFile(file.file);
            resultsContainer.style.display = 'none';

            // Clear search input after selection
            searchInput.value = '';
        });

        // Add hover effect
        resultItem.addEventListener('mouseover', () => {
            resultItem.style.backgroundColor = '#f0f0f0';
        });
        resultItem.addEventListener('mouseout', () => {
            resultItem.style.backgroundColor = 'white';
        });

        return resultItem;
    }
}