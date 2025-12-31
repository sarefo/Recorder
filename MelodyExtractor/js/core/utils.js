/**
 * Utility functions for Melody Extractor
 */

/**
 * Show a feedback toast message
 * @param {string} message - Message to display
 * @param {number} duration - Duration in milliseconds
 */
export function showFeedback(message, duration = 2000) {
    const feedback = document.getElementById('feedback');
    if (!feedback) return;

    feedback.textContent = message;
    feedback.classList.add('visible');

    setTimeout(() => {
        feedback.classList.remove('visible');
    }, duration);
}

/**
 * Format duration in seconds to mm:ss format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted time string
 */
export function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format sample rate for display
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {string} Formatted sample rate
 */
export function formatSampleRate(sampleRate) {
    return `${(sampleRate / 1000).toFixed(1)} kHz`;
}

/**
 * Debounce function to limit execution rate
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Convert MIDI note number to note name
 * @param {number} midi - MIDI note number
 * @returns {string} Note name with octave (e.g., "C4", "F#5")
 */
export function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return noteNames[noteIndex] + octave;
}

/**
 * Convert note name to MIDI note number
 * @param {string} noteName - Note name (e.g., "C4", "F#5")
 * @returns {number} MIDI note number
 */
export function noteNameToMidi(noteName) {
    const noteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    const match = noteName.match(/^([A-G])(#|b)?(\d+)$/);
    if (!match) return null;

    let note = noteMap[match[1]];
    if (match[2] === '#') note += 1;
    if (match[2] === 'b') note -= 1;
    const octave = parseInt(match[3]);

    return (octave + 1) * 12 + note;
}

/**
 * Convert frequency (Hz) to MIDI note number
 * @param {number} frequency - Frequency in Hz
 * @returns {number} MIDI note number (can be fractional)
 */
export function frequencyToMidi(frequency) {
    if (frequency <= 0) return null;
    return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * Convert MIDI note number to frequency (Hz)
 * @param {number} midi - MIDI note number
 * @returns {number} Frequency in Hz
 */
export function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert MIDI note to ABC notation
 * @param {number} midi - MIDI note number
 * @returns {string} ABC notation for the note
 */
export function midiToAbc(midi) {
    // ABC note names (with sharps)
    const noteNames = ['C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B'];
    const noteIndex = Math.round(midi) % 12;
    const octave = Math.floor(Math.round(midi) / 12) - 1;
    let noteName = noteNames[noteIndex];

    // ABC octave notation:
    // C, D, E, F, G, A, B = octave 4
    // c, d, e, f, g, a, b = octave 5
    // c', d', e', etc. = octave 6+
    // C,, D,, etc. = octave 2 and below

    if (octave >= 5) {
        noteName = noteName.toLowerCase();
        if (octave > 5) {
            noteName += "'".repeat(octave - 5);
        }
    } else if (octave < 4) {
        noteName += ",".repeat(4 - octave);
    }

    return noteName;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        return false;
    }
}

/**
 * Download text as a file
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Get confidence color for a confidence value
 * @param {number} confidence - Confidence value (0-1)
 * @returns {string} RGBA color string
 */
export function getConfidenceColor(confidence) {
    if (confidence >= 0.8) return 'rgba(40, 167, 69, 0.4)';   // Green - high
    if (confidence >= 0.6) return 'rgba(255, 193, 7, 0.4)';  // Yellow - medium
    return 'rgba(220, 53, 69, 0.4)';                          // Red - low
}

/**
 * Get confidence class name
 * @param {number} confidence - Confidence value (0-1)
 * @returns {string} CSS class name
 */
export function getConfidenceClass(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
}

/**
 * Generate pitch selector options HTML
 * @param {number} currentMidi - Currently selected MIDI note
 * @param {number} minMidi - Minimum MIDI note (default: 60 = C4)
 * @param {number} maxMidi - Maximum MIDI note (default: 96 = C7)
 * @returns {string} HTML options string
 */
export function generatePitchOptions(currentMidi, minMidi = 60, maxMidi = 96) {
    let options = '';
    for (let midi = minMidi; midi <= maxMidi; midi++) {
        const selected = midi === currentMidi ? 'selected' : '';
        options += `<option value="${midi}" ${selected}>${midiToNoteName(midi)}</option>`;
    }
    return options;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
