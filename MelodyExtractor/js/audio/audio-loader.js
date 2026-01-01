/**
 * AudioLoader - Handles audio file loading and decoding
 */

export class AudioLoader {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.monoChannel = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.isWaitingForFirstTap = false;

        // Tap tracking for note onset marking
        this.tapTimestamps = [];
        this.recordingStartTime = null;
        this._boundKeyHandler = null;

        // Latency compensation for MediaRecorder startup delay
        // Typical latency is 100-300ms. This offset is ADDED to tap times.
        this.tapLatencyOffset = 0;
    }

    /**
     * Load and decode an audio file
     * @param {File} file - Audio file to load
     * @returns {Promise<Object>} Audio information
     */
    async loadFile(file) {
        // Create audio context if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Decode audio data
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        // Pre-calculate mono channel
        this.monoChannel = this._mixToMono();

        return {
            buffer: this.audioBuffer,
            duration: this.audioBuffer.duration,
            sampleRate: this.audioBuffer.sampleRate,
            channels: this.audioBuffer.numberOfChannels,
            length: this.audioBuffer.length
        };
    }

    /**
     * Get mono audio data for analysis
     * @returns {Float32Array} Mono audio samples
     */
    getMonoChannel() {
        if (!this.monoChannel && this.audioBuffer) {
            this.monoChannel = this._mixToMono();
        }
        return this.monoChannel;
    }

    /**
     * Mix stereo to mono
     * @private
     * @returns {Float32Array} Mono audio samples
     */
    _mixToMono() {
        if (!this.audioBuffer) return null;

        if (this.audioBuffer.numberOfChannels === 1) {
            return this.audioBuffer.getChannelData(0);
        }

        // Average left and right channels
        const left = this.audioBuffer.getChannelData(0);
        const right = this.audioBuffer.getChannelData(1);
        const mono = new Float32Array(left.length);

        for (let i = 0; i < left.length; i++) {
            mono[i] = (left[i] + right[i]) / 2;
        }

        return mono;
    }

    /**
     * Get a segment of audio
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @returns {Float32Array} Audio segment
     */
    getSegment(startTime, endTime) {
        if (!this.audioBuffer) return null;

        const sampleRate = this.audioBuffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);

        const mono = this.getMonoChannel();
        return mono.slice(startSample, endSample);
    }

    /**
     * Create an AudioBuffer from a segment for playback
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @returns {AudioBuffer} Audio buffer for playback
     */
    createSegmentBuffer(startTime, endTime) {
        if (!this.audioBuffer) return null;

        const sampleRate = this.audioBuffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const length = endSample - startSample;

        const segmentBuffer = this.audioContext.createBuffer(
            this.audioBuffer.numberOfChannels,
            length,
            sampleRate
        );

        for (let channel = 0; channel < this.audioBuffer.numberOfChannels; channel++) {
            const channelData = this.audioBuffer.getChannelData(channel);
            const segmentData = segmentBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                segmentData[i] = channelData[startSample + i];
            }
        }

        return segmentBuffer;
    }

    /**
     * Play a segment of audio
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @returns {AudioBufferSourceNode} Audio source node (for stopping)
     */
    playSegment(startTime, endTime) {
        if (!this.audioContext || !this.audioBuffer) return null;

        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const segmentBuffer = this.createSegmentBuffer(startTime, endTime);
        const source = this.audioContext.createBufferSource();
        source.buffer = segmentBuffer;
        source.connect(this.audioContext.destination);
        source.start();

        return source;
    }

    /**
     * Get the audio context
     * @returns {AudioContext} The audio context
     */
    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }

    /**
     * Get the audio buffer
     * @returns {AudioBuffer} The decoded audio buffer
     */
    getAudioBuffer() {
        return this.audioBuffer;
    }

    /**
     * Start recording from microphone (prepares, waits for first Right Ctrl to start)
     * @returns {Promise<void>}
     */
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                }
            });

            this.recordedChunks = [];
            this.tapTimestamps = [];
            this._firstDataReceived = false;
            this.isWaitingForFirstTap = true;

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.addEventListener('dataavailable', (e) => {
                if (e.data.size > 0) {
                    this.recordedChunks.push(e.data);

                    // Set the actual recording start time on first data
                    if (!this._firstDataReceived) {
                        this._firstDataReceived = true;
                        // Recording started when first tap was pressed
                        console.log(`First data received at ${((performance.now() - this.recordingStartTime) / 1000).toFixed(3)}s`);
                    }
                }
            });

            // Set up tap listener for Right Ctrl
            this._boundKeyHandler = (e) => this._handleTapKey(e);
            document.addEventListener('keydown', this._boundKeyHandler);

            console.log('Recording ready - press Right Ctrl to START recording and mark first note');

        } catch (error) {
            console.error('Failed to start recording:', error);
            throw new Error('Microphone access denied or not available');
        }
    }

    /**
     * Handle tap key press during recording
     * @private
     */
    _handleTapKey(e) {
        // Right Ctrl key
        if (e.code === 'ControlRight' && (this.isWaitingForFirstTap || this.isRecording)) {
            e.preventDefault();
            const now = performance.now();

            // First tap: START recording at this exact moment
            if (this.isWaitingForFirstTap) {
                this.isWaitingForFirstTap = false;
                this.isRecording = true;
                this.recordingStartTime = now;

                // Start the MediaRecorder NOW
                this.mediaRecorder.start(100); // Collect data every 100ms

                // First tap is at time 0.0
                this.tapTimestamps.push(0.0);
                console.log('Recording STARTED on first tap at 0.00s');

                // Visual feedback
                this._showTapFeedback();
                return;
            }

            // Subsequent taps: record relative time
            if (this.isRecording) {
                const tapTime = (now - this.recordingStartTime) / 1000;
                this.tapTimestamps.push(tapTime);
                console.log(`Tap registered at ${tapTime.toFixed(2)}s (total: ${this.tapTimestamps.length})`);

                // Visual feedback
                this._showTapFeedback();
            }
        }
    }

    /**
     * Show visual feedback for tap
     * @private
     */
    _showTapFeedback() {
        const indicator = document.getElementById('tap-indicator');
        if (indicator) {
            indicator.classList.add('active');
            setTimeout(() => indicator.classList.remove('active'), 150);
        }
    }

    /**
     * Stop recording and return the audio blob
     * @returns {Promise<Blob>}
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                reject(new Error('Not recording'));
                return;
            }

            // Remove tap listener
            if (this._boundKeyHandler) {
                document.removeEventListener('keydown', this._boundKeyHandler);
                this._boundKeyHandler = null;
            }

            this.mediaRecorder.addEventListener('stop', () => {
                const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });

                // Stop all tracks
                if (this.mediaRecorder.stream) {
                    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }

                this.isRecording = false;
                this.mediaRecorder = null;

                console.log('Recording stopped, blob size:', blob.size);
                console.log(`Recorded ${this.tapTimestamps.length} tap markers:`, this.tapTimestamps);
                resolve(blob);
            });

            this.mediaRecorder.stop();
        });
    }

    /**
     * Get tap timestamps from last recording
     * @returns {Array<number>} Array of tap times in seconds
     */
    getTapTimestamps() {
        return this.tapTimestamps;
    }

    /**
     * Load audio from a blob (for recordings)
     * @param {Blob} blob - Audio blob
     * @returns {Promise<Object>} Audio information
     */
    async loadBlob(blob) {
        // Create audio context if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Read blob as ArrayBuffer
        const arrayBuffer = await blob.arrayBuffer();

        // Decode audio data
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        // Pre-calculate mono channel
        this.monoChannel = this._mixToMono();

        return {
            buffer: this.audioBuffer,
            duration: this.audioBuffer.duration,
            sampleRate: this.audioBuffer.sampleRate,
            channels: this.audioBuffer.numberOfChannels,
            length: this.audioBuffer.length
        };
    }

    /**
     * Check if currently recording
     * @returns {boolean}
     */
    getIsRecording() {
        return this.isRecording;
    }

    /**
     * Check if waiting for first tap to start recording
     * @returns {boolean}
     */
    getIsWaitingForFirstTap() {
        return this.isWaitingForFirstTap;
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Stop recording if active
        if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.stop();
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }

        this.monoChannel = null;
        this.audioBuffer = null;
        this.recordedChunks = [];
        if (this.audioContext && this.audioContext.state !== 'closed') {
            // Don't close the context, just clear references
            // this.audioContext.close();
        }
    }
}
