/**
 * Manages UI controls for navigating between tunes
 */
class TuneNavigation {
    constructor(player) {
        this.player = player;
    }

    /**
     * Creates tune navigation controls
     * @returns {HTMLElement} Container with navigation controls
     */
    createTuneNavigationControls() {
        const navContainer = document.createElement('div');
        navContainer.className = 'tune-navigation';

        // Previous tune button
        const prevButton = document.createElement('button');
        prevButton.id = 'prev-tune';
        prevButton.title = 'Previous tune';
        prevButton.textContent = '◀';
        prevButton.addEventListener('click', () => {
            this.player.tuneManager.previousTune();
            this.player.render();
            this.updateTuneCountDisplay();
        });

        // Tune count display
        const tuneDisplay = document.createElement('span');
        tuneDisplay.id = 'tune-display';
        tuneDisplay.className = 'tune-display';
        tuneDisplay.textContent = '1/1';

        // Next tune button
        const nextButton = document.createElement('button');
        nextButton.id = 'next-tune';
        nextButton.title = 'Next tune';
        nextButton.textContent = '▶';
        nextButton.addEventListener('click', () => {
            this.player.tuneManager.nextTune();
            this.player.render();
            this.updateTuneCountDisplay();
        });

        navContainer.appendChild(prevButton);
        navContainer.appendChild(tuneDisplay);
        navContainer.appendChild(nextButton);

        // Initial update of tune counter
        setTimeout(() => this.updateTuneCountDisplay(), 100);

        return navContainer;
    }

    /**
     * Updates the tune counter display with current information
     */
    updateTuneCountDisplay() {
        const tuneInfo = this.player.tuneManager.getCurrentTuneInfo();
        const tuneDisplay = document.getElementById('tune-display');

        if (tuneDisplay) {
            tuneDisplay.textContent = tuneInfo.display;

            // Hide/show navigation controls based on tune count
            const prevButton = document.getElementById('prev-tune');
            const nextButton = document.getElementById('next-tune');

            if (prevButton && nextButton) {
                if (tuneInfo.total <= 1) {
                    prevButton.classList.add('hidden');
                    nextButton.classList.add('hidden');
                    tuneDisplay.classList.add('hidden');
                } else {
                    prevButton.classList.remove('hidden');
                    nextButton.classList.remove('hidden');
                    tuneDisplay.classList.remove('hidden');
                }
            }
        }
    }

    /**
     * Updates the title displayed in UI when changing tunes
     */
    updateTuneTitle() {
        const titleElement = document.getElementById('tune-title');
        if (titleElement) {
            const title = this.player.tuneManager.getCurrentTuneTitle();
            titleElement.textContent = title;
        }
    }
}