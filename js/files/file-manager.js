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
     * Creates the file selector UI as a grouped dropdown
     * @returns {HTMLElement} The file selector element
     */
    /**
     * Creates the file selector UI including a random button
     * @returns {HTMLElement} The container element with the dropdown and button
     */
    createFileSelector() {
        // Create a container div to hold the dropdown and button
        const container = document.createElement('div');
        container.className = 'file-selector-container'; // Add a class for potential styling
        container.style.display = 'flex'; // Use flexbox for easy alignment
        container.style.alignItems = 'center'; // Align items vertically

        // Create the select dropdown
        const select = document.createElement('select');
        select.id = 'abc-file-selector';
        select.className = 'file-selector';
        select.style.marginRight = '8px'; // Add some space between dropdown and button

        // Add default option
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
                group.appendChild(option);
            });
            select.appendChild(group);
        });

        // Handle selection changes [cite: 76]
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

        // Append the dropdown to the container
        container.appendChild(select);

        // Create the "Random" button
        const randomButton = document.createElement('button');
        randomButton.id = 'random-abc-button';
        // Use an icon (e.g., dice) instead of text
        randomButton.textContent = '🎲'; // Unicode dice character
        randomButton.title = 'Load a random ABC file'; // Keep the title for accessibility

        // Adjust styling for the icon button
        randomButton.style.padding = '2px 6px'; // Adjust padding if needed
        randomButton.style.fontSize = '1.5em'; // Make the icon a bit larger
        randomButton.style.lineHeight = '1'; // Adjust line height for vertical centering
        randomButton.style.cursor = 'pointer'; // Ensure cursor indicates it's clickable

        // Add event listener to the random button (same as before)
        randomButton.addEventListener('click', () => {
            const allFiles = this.fileList; // Get the full list of files
            if (allFiles && allFiles.length > 0) {
                // Select a random file
                const randomIndex = Math.floor(Math.random() * allFiles.length);
                const randomFile = allFiles[randomIndex];

                if (randomFile && randomFile.file) {
                    this.loadFile(randomFile.file); // Load the randomly selected file
                    Utils.showFeedback(`Loaded random file: ${randomFile.name}`); // Provide feedback
                }
            } else {
                Utils.showFeedback("No files available to choose from.", true); // Error feedback
            }
        });

        // Append the random button to the container
        container.appendChild(randomButton);

        // Return the container instead of just the select element
        return container;
    }
}