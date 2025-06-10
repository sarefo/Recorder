/**
 * Utility functions for the application
 */
const Utils = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    showFeedback(message, duration = 2000) {
        const feedback = document.getElementById('feedback');
        feedback.textContent = message;
        feedback.classList.remove('hidden');
        feedback.classList.add('visible');
        setTimeout(() => {
            feedback.classList.add('hidden');
            feedback.classList.remove('visible');
        }, duration);
    },

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showFeedback('ABC notation copied to clipboard!');
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Could not copy to clipboard. Please check browser permissions.');
            return false;
        }
    },

    async readFromClipboard() {
        try {
            return await navigator.clipboard.readText();
        } catch (err) {
            console.error('Failed to paste:', err);
            alert('Could not access clipboard. Please check browser permissions.');
            return null;
        }
    }
};
