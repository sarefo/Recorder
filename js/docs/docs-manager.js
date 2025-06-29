/**
 * Manages documentation display and markdown rendering
 */
class DocsManager {
    constructor() {
        this.markdownConverter = new showdown.Converter({
            tables: true,
            tasklists: true,
            strikethrough: true,
            ghCodeBlocks: true,
            simpleLineBreaks: false,
            literalMidWordUnderscores: true,
            simplifiedAutoLink: true,
            excludeTrailingPunctuationFromURLs: true,
            ghMentions: false,
            requireSpaceBeforeHeadingText: true,
            disableForced4SpacesIndentedSublists: true,
            parseImgDimensions: true,
            encodeEmails: true
        });
        this.currentDoc = null;
        this.isLoading = false;
    }

    /**
     * Initialize the documentation page
     */
    init() {
        this.loadDocsList();
        this.setupEventListeners();
    }

    /**
     * Preprocess markdown - just convert + to - for better compatibility
     * @param {string} markdown - Raw markdown text
     * @returns {string} Processed markdown
     */
    preprocessMarkdown(markdown) {
        // Simply convert + style lists to - style for better Showdown compatibility
        return markdown.replace(/^(\s*)\+\s/gm, '$1- ');
    }

    /**
     * Load and display the list of available documentation files
     */
    loadDocsList() {
        const docsList = document.getElementById('docs-list');
        if (!docsList) return;

        try {
            const docs = DocsFileList.getFiles();
            docsList.innerHTML = '';

            docs.forEach(doc => {
                const listItem = document.createElement('li');
                listItem.className = 'doc-item';
                listItem.dataset.file = doc.file;

                const link = document.createElement('a');
                link.href = '#';
                link.className = 'doc-link';
                link.textContent = doc.name;
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.loadMarkdownFile(doc.file, doc.name);
                });

                listItem.appendChild(link);
                docsList.appendChild(listItem);
            });
        } catch (error) {
            console.error('Error loading docs list:', error);
            docsList.innerHTML = '<li class="error">Error loading documentation list</li>';
        }
    }

    /**
     * Load and render a markdown file
     * @param {string} filename - The markdown file to load
     * @param {string} title - The display title
     */
    async loadMarkdownFile(filename, title) {
        // Prevent double loading
        if (this.isLoading) {
            return;
        }
        
        const contentDiv = document.getElementById('markdown-content');
        if (!contentDiv) return;

        this.isLoading = true;

        // Show loading state
        contentDiv.innerHTML = '<div class="loading">Loading...</div>';
        contentDiv.style.display = 'block';

        try {
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const markdownText = await response.text();
            if (!markdownText) {
                throw new Error(`Empty file: ${filename}`);
            }

            // Clear content first to prevent double rendering
            contentDiv.innerHTML = '';
            
            // Preprocess markdown to fix nested lists and remove duplicate header
            let processedMarkdown = this.preprocessMarkdown(markdownText);
            
            // Remove the first # header since we're creating our own header
            processedMarkdown = processedMarkdown.replace(/^#\s+.*$/m, '').replace(/^\s*\n/, '');
            
            const htmlContent = this.markdownConverter.makeHtml(processedMarkdown);
            
            // Create header with close button
            const headerDiv = document.createElement('div');
            headerDiv.className = 'markdown-header';
            
            const titleElement = document.createElement('h1');
            titleElement.textContent = title;
            
            const closeButton = document.createElement('button');
            closeButton.className = 'back-link';
            closeButton.textContent = '← Back to Documentation List';
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeDocument();
            });
            
            headerDiv.appendChild(titleElement);
            headerDiv.appendChild(closeButton);
            
            // Create body
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'markdown-body';
            bodyDiv.innerHTML = htmlContent;
            
            // Append both to content div
            contentDiv.appendChild(headerDiv);
            contentDiv.appendChild(bodyDiv);

            this.currentDoc = { filename, title };
        } catch (error) {
            console.error(`Error loading ${filename}:`, error);
            contentDiv.innerHTML = `
                <div class="error">
                    <h3>Error loading document</h3>
                    <p>Could not load "${title}". Error: ${error.message}</p>
                    <p><small>Tried to load: ${filename}</small></p>
                    <button onclick="docsManager.closeDocument()" class="back-link">← Back to Documentation List</button>
                </div>
            `;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Close the current document and return to the list
     */
    closeDocument() {
        const contentDiv = document.getElementById('markdown-content');
        if (contentDiv) {
            contentDiv.style.display = 'none';
            contentDiv.innerHTML = '';
        }
        this.currentDoc = null;
        this.isLoading = false;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Handle browser back button
        window.addEventListener('popstate', () => {
            if (this.currentDoc) {
                this.closeDocument();
            }
        });
    }
}

// Global instance
let docsManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (docsManager) {
        return;
    }
    docsManager = new DocsManager();
    docsManager.init();
});