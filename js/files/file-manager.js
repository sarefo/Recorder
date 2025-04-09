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
        // Create a container div to hold the dropdown, search input, and button
        const container = document.createElement('div');
        container.className = 'file-selector-container';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.position = 'relative'; // For positioning the search results

        // Create the select dropdown (kept for compatibility but hidden)
        const select = document.createElement('select');
        select.id = 'abc-file-selector';
        select.className = 'file-selector';
        select.style.marginRight = '8px';
        select.style.display = 'none'; // Hide it as we're using the search input instead

        // Create a search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'abc-file-search';
        searchInput.className = 'file-search';
        searchInput.placeholder = 'Search for files...';
        searchInput.style.marginRight = '8px';
        searchInput.style.padding = '6px 10px';
        searchInput.style.border = '1px solid #ddd';
        searchInput.style.borderRadius = '4px';
        searchInput.style.width = '180px';

        // Create a search results dropdown
        const searchResults = document.createElement('div');
        searchResults.id = 'search-results';
        searchResults.className = 'search-results';
        searchResults.style.display = 'none';
        searchResults.style.position = 'absolute';
        searchResults.style.top = '100%';
        searchResults.style.left = '0';
        searchResults.style.zIndex = '1000';
        searchResults.style.backgroundColor = 'white';
        searchResults.style.border = '1px solid #ddd';
        searchResults.style.borderRadius = '4px';
        searchResults.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        searchResults.style.maxHeight = '300px';
        searchResults.style.overflowY = 'auto';
        searchResults.style.width = '100%';

        // Add default option to the select
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Load ABC File...';
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        // Add options for each category
        Object.keys(this.categorizedFiles).sort().forEach(category => {
            const files = this.categorizedFiles[category];
            const group = document.createElement('optgroup');
            group.label = category;
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.file;
                option.textContent = file.name;
                option.dataset.category = category;
                group.appendChild(option);
            });
            select.appendChild(group);
        });

        // Handle selection changes for the select dropdown
        select.addEventListener('change', (e) => {
            const selectedFile = e.target.value;
            if (selectedFile) {
                this.loadFile(selectedFile);
                // Reset selection to default after loading
                setTimeout(() => {
                    select.value = '';
                }, 100);
            }
        });

        // Handle input in the search field
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            this.updateSearchResults(searchTerm, searchResults, searchInput);
        });

        // Focus event to show all files when clicking the search input
        searchInput.addEventListener('focus', (e) => {
            // Show all files when focusing with empty search
            this.updateSearchResults(e.target.value.toLowerCase(), searchResults, searchInput);
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });

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

                    // Clear the search input when loading a random file
                    searchInput.value = '';
                    searchResults.style.display = 'none';
                }
            } else {
                Utils.showFeedback("No files available to choose from.", true);
            }
        });

        // Append all elements to the container
        container.appendChild(searchInput);
        container.appendChild(searchResults);
        container.appendChild(randomButton);

        return container;
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