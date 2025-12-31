/**
 * WorkflowManager - Manages the step-by-step workflow navigation
 */

export class WorkflowManager {
    constructor(app) {
        this.app = app;
        this.steps = ['load', 'review', 'export'];  // Simplified to 3 steps
        this.currentStep = 'load';
    }

    /**
     * Initialize workflow manager
     */
    init() {
        this._setupStepIndicator();
        this.showStep('load');
    }

    /**
     * Setup step indicator click handlers
     * @private
     */
    _setupStepIndicator() {
        const stepElements = document.querySelectorAll('#step-indicator .step');
        stepElements.forEach(step => {
            step.addEventListener('click', () => {
                const stepName = step.dataset.step;
                // Only allow going to completed steps or current step
                if (this._canGoToStep(stepName)) {
                    this.showStep(stepName);
                }
            });
        });
    }

    /**
     * Check if we can navigate to a step
     * @private
     */
    _canGoToStep(stepName) {
        const currentIndex = this.steps.indexOf(this.currentStep);
        const targetIndex = this.steps.indexOf(stepName);

        // Can always go back or stay
        if (targetIndex <= currentIndex) {
            return true;
        }

        // Check prerequisites for going forward
        switch (stepName) {
            case 'review':
                return this.app.detectedNotes.length > 0;
            case 'export':
                return this.app.correctedNotes.length > 0;
            default:
                return false;
        }
    }

    /**
     * Show a specific step
     * @param {string} stepName - Step to show
     */
    showStep(stepName) {
        // Hide all panels
        document.querySelectorAll('.step-panel').forEach(panel => {
            panel.classList.add('hidden');
        });

        // Show target panel
        const targetPanel = document.getElementById(`panel-${stepName}`);
        if (targetPanel) {
            targetPanel.classList.remove('hidden');
        }

        // Update step indicators
        const stepIndex = this.steps.indexOf(stepName);
        document.querySelectorAll('#step-indicator .step').forEach((el, index) => {
            el.classList.remove('active', 'completed');
            if (index < stepIndex) {
                el.classList.add('completed');
            } else if (index === stepIndex) {
                el.classList.add('active');
            }
        });

        // Perform step-specific initialization
        this._onStepEnter(stepName);

        this.currentStep = stepName;
    }

    /**
     * Handle entering a step
     * @private
     */
    async _onStepEnter(stepName) {
        switch (stepName) {
            case 'load':
                // Nothing special needed
                break;

            case 'review':
                // Initialize editor waveform
                await this.app.enterReviewMode();
                break;

            case 'export':
                // Generate ABC
                this.app.generateAbc();
                break;
        }
    }

    /**
     * Go to next step
     */
    nextStep() {
        const currentIndex = this.steps.indexOf(this.currentStep);
        if (currentIndex < this.steps.length - 1) {
            const nextStep = this.steps[currentIndex + 1];
            if (this._canGoToStep(nextStep)) {
                this.showStep(nextStep);
            }
        }
    }

    /**
     * Go to previous step
     */
    prevStep() {
        const currentIndex = this.steps.indexOf(this.currentStep);
        if (currentIndex > 0) {
            this.showStep(this.steps[currentIndex - 1]);
        }
    }

    /**
     * Get current step
     * @returns {string} Current step name
     */
    getCurrentStep() {
        return this.currentStep;
    }

    /**
     * Check if on first step
     * @returns {boolean} True if on first step
     */
    isFirstStep() {
        return this.currentStep === this.steps[0];
    }

    /**
     * Check if on last step
     * @returns {boolean} True if on last step
     */
    isLastStep() {
        return this.currentStep === this.steps[this.steps.length - 1];
    }
}
