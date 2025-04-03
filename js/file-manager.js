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
    createFileSelector() {
        const select = document.createElement('select');
        select.id = 'abc-file-selector';
        select.className = 'file-selector';

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Load ABC File...';
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        // Add options for each category
        Object.keys(this.categorizedFiles).sort().forEach(category => {
            const files = this.categorizedFiles[category];

            // Create an optgroup for the category
            const group = document.createElement('optgroup');
            group.label = category;

            // Add files within this category
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.file;
                option.textContent = file.name;
                group.appendChild(option);
            });

            select.appendChild(group);
        });

        // Handle selection changes
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

        return select;
    }
}