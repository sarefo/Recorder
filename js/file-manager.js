/**
 * Manages loading ABC files
 */
class FileManager {
    constructor(player) {
        this.player = player;
        this.fileList = AbcFileList.getFiles();
    }

    /**
     * Load a specific ABC file by name
     * @param {string} filename - Name of the file to load
     * @returns {Promise<boolean>} Success status
     */
    async loadFile(filename) {
        try {
            const response = await fetch(`abc/${filename}`);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            const abcContent = await response.text();

            // Make sure it's valid ABC notation
            if (abcContent.includes('X:') && abcContent.includes('K:')) {
                // Update the notation and render it
                this.player.notationParser.currentAbc = abcContent;
                this.player.render();
                Utils.showFeedback(`Loaded ${filename}`);
                return true;
            } else {
                throw new Error("Invalid ABC notation format");
            }
        } catch (error) {
            console.error(`Error loading ABC file ${filename}:`, error);
            Utils.showFeedback(`Error loading ${filename}`, true);
            return false;
        }
    }

    /**
     * Creates the file selector UI
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

        // Add options for each available file
        this.fileList.forEach(file => {
            const option = document.createElement('option');
            option.value = file.file;
            option.textContent = file.name;
            select.appendChild(option);
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
