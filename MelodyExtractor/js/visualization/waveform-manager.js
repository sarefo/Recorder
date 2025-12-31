/**
 * WaveformManager - Manages Wavesurfer.js waveform displays
 */

export class WaveformManager {
    constructor(app) {
        this.app = app;
        this.previewWavesurfer = null;
        this.editorWavesurfer = null;
        this.regions = null;
        this.timeline = null;
        this.keydownHandlerAttached = false;
        this.audioBlobUrl = null;  // Store blob URL for playback

        // Library references (loaded dynamically)
        this.WaveSurfer = null;
        this.RegionsPlugin = null;
        this.TimelinePlugin = null;
    }

    /**
     * Load Wavesurfer.js library modules
     */
    async loadLibraries() {
        if (this.WaveSurfer) return;

        try {
            const [wavesurfer, regions, timeline] = await Promise.all([
                import('https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js'),
                import('https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/plugins/regions.esm.js'),
                import('https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/plugins/timeline.esm.js')
            ]);

            this.WaveSurfer = wavesurfer.default;
            this.RegionsPlugin = regions.default;
            this.TimelinePlugin = timeline.default;

            console.log('Wavesurfer.js libraries loaded');
        } catch (error) {
            console.error('Failed to load Wavesurfer.js:', error);
            throw error;
        }
    }

    /**
     * Initialize preview waveform (Step 1)
     * @param {string} containerId - Container element ID
     */
    async initPreview(containerId) {
        await this.loadLibraries();

        if (this.previewWavesurfer) {
            this.previewWavesurfer.destroy();
        }

        this.previewWavesurfer = this.WaveSurfer.create({
            container: `#${containerId}`,
            waveColor: '#4F4A85',
            progressColor: '#7B76A8',
            cursorColor: '#ff4444',
            height: 80,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            normalize: true,
            hideScrollbar: true
        });

        // Click to play/pause
        this.previewWavesurfer.on('interaction', () => {
            this.previewWavesurfer.playPause();
        });
    }

    /**
     * Initialize editor waveform with regions (Step 3)
     * @param {string} waveformId - Waveform container ID
     */
    async initEditor(waveformId) {
        await this.loadLibraries();

        if (this.editorWavesurfer) {
            this.editorWavesurfer.destroy();
        }

        // Create regions plugin
        this.regions = this.RegionsPlugin.create();

        // Create timeline plugin
        this.timeline = this.TimelinePlugin.create({
            height: 20,
            timeInterval: 0.5,
            primaryLabelInterval: 1,
            style: {
                fontSize: '10px',
                color: '#888'
            }
        });

        // Get container width before creating waveform
        const container = document.getElementById(waveformId);
        const containerWidth = container ? container.clientWidth : 800;

        // Create main waveform with regions and timeline
        this.editorWavesurfer = this.WaveSurfer.create({
            container: `#${waveformId}`,
            waveColor: '#5B5B5B',
            progressColor: '#A0A0A0',
            cursorColor: '#ff4444',
            height: 200,
            barWidth: 1,
            normalize: true,
            hideScrollbar: false,
            plugins: [this.regions, this.timeline],
            minPxPerSec: 50,
            width: containerWidth,
            autoScroll: false,
            autoCenter: false,
            fillParent: false
        });

        // Handle region events
        this.regions.on('region-clicked', (region, e) => {
            e.stopPropagation();
            this.app.noteEditor.selectNote(region.id);
        });

        this.regions.on('region-updated', (region) => {
            this.app.noteEditor.onRegionUpdate(region);
        });

        // Click on waveform (not region) in add mode
        this.editorWavesurfer.on('click', (relativeX) => {
            if (this.app.noteEditor.addMode) {
                const duration = this.editorWavesurfer.getDuration();
                const clickTime = relativeX * duration;
                this.app.noteEditor.handleAddClick(clickTime);
            }
        });

        // Waveform ready event
        this.editorWavesurfer.on('ready', () => {
            console.log('Waveform ready for editing');
        });

        // Space bar to play/pause
        if (!this.keydownHandlerAttached) {
            this.keydownHandlerAttached = true;
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
                    const reviewPanel = document.getElementById('panel-review');
                    if (reviewPanel && !reviewPanel.classList.contains('hidden')) {
                        e.preventDefault();
                        if (this.editorWavesurfer) {
                            this.editorWavesurfer.playPause();
                        }
                    }
                }
            });
        }
    }

    /**
     * Load audio buffer into preview waveform
     * @param {AudioBuffer} audioBuffer - Decoded audio buffer
     */
    async loadAudioBuffer(audioBuffer) {
        if (!this.previewWavesurfer) return;

        // Create a blob from audio buffer for loading
        const blob = await this._audioBufferToBlob(audioBuffer);
        await this.previewWavesurfer.loadBlob(blob);
    }

    /**
     * Load audio buffer into editor waveform
     * @param {AudioBuffer} audioBuffer - Decoded audio buffer
     */
    async loadAudioBufferToEditor(audioBuffer) {
        if (!this.editorWavesurfer) return;

        console.log('Loading audio buffer to editor...');
        console.log('Audio buffer:', {
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length
        });

        // Clean up previous blob URL
        if (this.audioBlobUrl) {
            URL.revokeObjectURL(this.audioBlobUrl);
            this.audioBlobUrl = null;
        }

        // Convert AudioBuffer to WAV blob for proper playback
        const wavBlob = this._bufferToWav(audioBuffer);
        this.audioBlobUrl = URL.createObjectURL(wavBlob);

        console.log('Created blob URL for editor:', this.audioBlobUrl);

        // Load using blob URL - this ensures proper playback
        await this.editorWavesurfer.load(this.audioBlobUrl);

        console.log('Audio loaded into editor wavesurfer');
    }

    /**
     * Convert AudioBuffer to Blob
     * @private
     */
    async _audioBufferToBlob(audioBuffer) {
        // Create offline context to render to WAV
        const offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start();

        const renderedBuffer = await offlineCtx.startRendering();

        // Convert to WAV blob
        return this._bufferToWav(renderedBuffer);
    }

    /**
     * Convert AudioBuffer to WAV Blob
     * @private
     */
    _bufferToWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;

        const data = [];
        for (let channel = 0; channel < numChannels; channel++) {
            data.push(audioBuffer.getChannelData(channel));
        }

        const samples = audioBuffer.length;
        const dataSize = samples * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Interleave samples
        let offset = 44;
        for (let i = 0; i < samples; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, data[channel][i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Play editor waveform
     */
    playEditor() {
        if (this.editorWavesurfer) {
            console.log('Playing editor waveform, duration:', this.editorWavesurfer.getDuration());
            this.editorWavesurfer.play();
        } else {
            console.warn('Editor wavesurfer not initialized');
        }
    }

    /**
     * Stop editor waveform
     */
    stopEditor() {
        if (this.editorWavesurfer) {
            console.log('Stopping editor waveform');
            this.editorWavesurfer.pause();
        }
    }

    /**
     * Play a specific time range
     * @param {number} start - Start time in seconds
     * @param {number} end - End time in seconds
     */
    playRange(start, end) {
        if (!this.editorWavesurfer) return;

        console.log(`Playing range: ${start.toFixed(2)}s to ${end.toFixed(2)}s`);

        // Stop any current playback
        this.editorWavesurfer.pause();

        // Set position and play
        this.editorWavesurfer.setTime(start);
        this.editorWavesurfer.play();

        // Stop at end time
        const duration = (end - start) * 1000;
        if (this.playRangeTimeout) {
            clearTimeout(this.playRangeTimeout);
        }
        this.playRangeTimeout = setTimeout(() => {
            this.editorWavesurfer.pause();
            this.playRangeTimeout = null;
        }, duration);
    }

    /**
     * Get the regions plugin
     * @returns {Object} Regions plugin instance
     */
    getRegions() {
        return this.regions;
    }

    /**
     * Zoom in/out
     * @param {number} direction - 1 for zoom in, -1 for zoom out
     */
    zoom(direction) {
        if (!this.editorWavesurfer) return;

        const currentZoom = this.editorWavesurfer.options.minPxPerSec || 50;
        const newZoom = direction > 0
            ? Math.min(currentZoom * 1.5, 500)
            : Math.max(currentZoom / 1.5, 10);

        this.editorWavesurfer.zoom(newZoom);
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.previewWavesurfer) {
            this.previewWavesurfer.destroy();
            this.previewWavesurfer = null;
        }
        if (this.editorWavesurfer) {
            this.editorWavesurfer.destroy();
            this.editorWavesurfer = null;
        }
        if (this.audioBlobUrl) {
            URL.revokeObjectURL(this.audioBlobUrl);
            this.audioBlobUrl = null;
        }
        this.regions = null;
        this.timeline = null;
    }
}
