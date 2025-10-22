/**
 * Mask EQ Designer - Web Version
 *
 * A web-based graphic equalizer for designing minimum-phase frequency-domain EQ masks.
 * Ported from the Python CustomTkinter version to pure JavaScript.
 *
 * Features:
 * - 14-band graphic EQ with adjustable sliders
 * - Interactive dot dragging on frequency response plot
 * - Minimum-phase response generation using cepstral method
 * - Export to C header file format
 * - Load curves from text files
 * - Preset curves (Flat, Bass Filter)
 *
 * Example usage:
 *   Open index.html in a web browser
 *   Adjust sliders or drag orange dots on the plot
 *   Click Export to download .h file and PNG image
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const Config = {
    SAMPLE_RATE: 16000,
    FFT_SIZE: 256,
    NUM_BANDS: 14,
    MIN_GAIN_DB: -18.0,
    MAX_GAIN_DB: 6.0,

    get numBins() {
        return this.FFT_SIZE / 2 + 1;
    },

    get nyquistFreq() {
        return this.SAMPLE_RATE / 2;
    }
};

// ============================================================================
// COMPLEX NUMBER UTILITIES
// ============================================================================

class Complex {
    constructor(real, imag = 0) {
        this.real = real;
        this.imag = imag;
    }

    static fromPolar(magnitude, phase) {
        return new Complex(
            magnitude * Math.cos(phase),
            magnitude * Math.sin(phase)
        );
    }

    magnitude() {
        return Math.sqrt(this.real * this.real + this.imag * this.imag);
    }

    phase() {
        return Math.atan2(this.imag, this.real);
    }

    add(other) {
        return new Complex(this.real + other.real, this.imag + other.imag);
    }

    multiply(other) {
        return new Complex(
            this.real * other.real - this.imag * other.imag,
            this.real * other.imag + this.imag * other.real
        );
    }

    scale(scalar) {
        return new Complex(this.real * scalar, this.imag * scalar);
    }
}

// ============================================================================
// FFT IMPLEMENTATION (Cooley-Tukey)
// ============================================================================

class FFT {
    /**
     * Compute FFT using Cooley-Tukey radix-2 algorithm
     * @param {Array<Complex>} input - Input complex array (length must be power of 2)
     * @param {boolean} inverse - If true, compute IFFT
     * @returns {Array<Complex>} FFT result
     */
    static compute(input, inverse = false) {
        const n = input.length;

        if (n <= 1) return input;

        // Check if power of 2
        if ((n & (n - 1)) !== 0) {
            throw new Error("FFT size must be power of 2");
        }

        // Bit-reversal permutation
        const output = new Array(n);
        for (let i = 0; i < n; i++) {
            output[this.reverseBits(i, n)] = input[i];
        }

        // Cooley-Tukey FFT
        const direction = inverse ? 1 : -1;

        for (let size = 2; size <= n; size *= 2) {
            const halfSize = size / 2;
            const step = 2 * Math.PI / size * direction;

            for (let i = 0; i < n; i += size) {
                for (let j = 0; j < halfSize; j++) {
                    const angle = step * j;
                    const twiddle = new Complex(Math.cos(angle), Math.sin(angle));

                    const even = output[i + j];
                    const odd = output[i + j + halfSize].multiply(twiddle);

                    output[i + j] = even.add(odd);
                    output[i + j + halfSize] = even.add(odd.scale(-1));
                }
            }
        }

        // Normalize for inverse FFT
        if (inverse) {
            for (let i = 0; i < n; i++) {
                output[i] = output[i].scale(1 / n);
            }
        }

        return output;
    }

    static reverseBits(x, n) {
        let result = 0;
        let bits = Math.log2(n);
        for (let i = 0; i < bits; i++) {
            result = (result << 1) | (x & 1);
            x >>= 1;
        }
        return result;
    }

    /**
     * Real FFT - optimized for real-valued input
     * @param {Array<number>} input - Real-valued input
     * @returns {Array<Complex>} FFT result (first half + nyquist)
     */
    static rfft(input) {
        const complexInput = input.map(x => new Complex(x, 0));
        const fullFFT = this.compute(complexInput, false);
        // Return first half + Nyquist
        return fullFFT.slice(0, Config.numBins);
    }

    /**
     * Inverse Real FFT
     * @param {Array<Complex>} input - Complex input (first half + nyquist)
     * @returns {Array<number>} Real-valued output
     */
    static irfft(input) {
        // Reconstruct full symmetric spectrum
        const n = Config.FFT_SIZE;
        const fullSpectrum = new Array(n);

        // First half (including DC and Nyquist)
        for (let i = 0; i < Config.numBins; i++) {
            fullSpectrum[i] = input[i];
        }

        // Mirror second half (conjugate symmetry)
        for (let i = Config.numBins; i < n; i++) {
            const mirrorIdx = n - i;
            fullSpectrum[i] = new Complex(
                fullSpectrum[mirrorIdx].real,
                -fullSpectrum[mirrorIdx].imag
            );
        }

        const result = this.compute(fullSpectrum, true);
        return result.map(c => c.real);
    }
}

// ============================================================================
// EQ MASK GENERATOR
// ============================================================================

class EQMaskGenerator {
    constructor(config) {
        this.config = config;
    }

    /**
     * Generate minimum-phase complex FFT mask from frequency/gain pairs
     *
     * Algorithm:
     * 1. Interpolate user gains to FFT bin frequencies
     * 2. Convert dB to linear magnitude
     * 3. Use cepstral method to generate minimum-phase response:
     *    - Take log of magnitude
     *    - Compute real cepstrum via IFFT
     *    - Apply causal windowing (zero negative time, double positive time)
     *    - Transform back via FFT
     *    - Exponentiate to get complex spectrum
     *
     * @param {Array<number>} freqs - Frequency points in Hz
     * @param {Array<number>} gainsDB - Gain values in dB
     * @returns {Object} { binFreqs, complexMask, actualMagnitude }
     */
    generateMinimumPhaseMask(freqs, gainsDB) {
        // Create frequency bins for FFT
        const binFreqs = [];
        for (let i = 0; i < this.config.numBins; i++) {
            binFreqs.push(i * this.config.nyquistFreq / (this.config.numBins - 1));
        }

        // Interpolate gains to match FFT bins
        const gainsDBInterp = this.interpolate(binFreqs, freqs, gainsDB);

        // Convert dB to linear magnitude
        const magnitude = gainsDBInterp.map(db => Math.pow(10, db / 20.0));

        // Generate minimum phase from magnitude using cepstral method

        // Take log magnitude (with epsilon to avoid log(0))
        const epsilon = 1e-10;
        const logMagnitude = magnitude.map(m => Math.log(Math.max(m, epsilon)));

        // Create full symmetric log magnitude for FFT
        // [DC, f1, f2, ..., fN/2] -> [DC, f1, ..., fN/2, fN/2-1, ..., f1]
        const fullLogMag = [...logMagnitude];
        for (let i = this.config.numBins - 2; i >= 1; i--) {
            fullLogMag.push(logMagnitude[i]);
        }

        // Apply IFFT to get cepstrum (real part only)
        const complexLogMag = fullLogMag.map(x => new Complex(x, 0));
        const cepstrumComplex = FFT.compute(complexLogMag, true);
        const cepstrum = cepstrumComplex.map(c => c.real);

        // Create minimum phase cepstrum (causal window)
        const minPhaseCepstrum = new Array(this.config.FFT_SIZE).fill(0);
        minPhaseCepstrum[0] = cepstrum[0];  // DC

        // Double positive frequencies (causal windowing for minimum phase)
        for (let i = 1; i < this.config.FFT_SIZE / 2; i++) {
            minPhaseCepstrum[i] = 2 * cepstrum[i];
        }
        // Note: negative frequencies remain zero

        // Transform back to get minimum phase log spectrum
        const minPhaseCepstrumComplex = minPhaseCepstrum.map(x => new Complex(x, 0));
        const minPhaseLogSpectrum = FFT.compute(minPhaseCepstrumComplex, false);

        // Convert from log domain to linear domain (complex exponential)
        const fullComplexMask = minPhaseLogSpectrum.map(c => {
            const magnitude = Math.exp(c.real);
            const phase = c.imag;
            return Complex.fromPolar(magnitude, phase);
        });

        // Extract first half (including Nyquist)
        const complexMask = fullComplexMask.slice(0, this.config.numBins);

        // Get actual magnitude for verification
        const actualMagnitude = complexMask.map(c => c.magnitude());

        return { binFreqs, complexMask, actualMagnitude };
    }

    /**
     * Linear interpolation
     * @param {Array<number>} xNew - New x values
     * @param {Array<number>} x - Original x values
     * @param {Array<number>} y - Original y values
     * @returns {Array<number>} Interpolated y values
     */
    interpolate(xNew, x, y) {
        return xNew.map(xVal => {
            // Find bracketing indices
            if (xVal <= x[0]) return y[0];
            if (xVal >= x[x.length - 1]) return y[y.length - 1];

            for (let i = 0; i < x.length - 1; i++) {
                if (xVal >= x[i] && xVal <= x[i + 1]) {
                    const t = (xVal - x[i]) / (x[i + 1] - x[i]);
                    return y[i] + t * (y[i + 1] - y[i]);
                }
            }
            return y[y.length - 1];
        });
    }

    /**
     * Export complex mask to C header file format
     * @param {Array<Complex>} complexMask - Complex FFT coefficients
     * @returns {string} Header file content
     */
    exportToHeader(complexMask) {
        const now = new Date().toISOString().replace('T', ' ').split('.')[0];
        let content = `// Generated by Mask EQ Designer (Web) on ${now}\n`;
        content += `// Sample rate: ${this.config.SAMPLE_RATE} Hz\n`;
        content += `// FFT size: ${this.config.FFT_SIZE}\n`;
        content += `// Number of complex bins: ${this.config.numBins}\n`;
        content += `//\n`;
        content += `// Format: Interleaved real/imaginary pairs (Python FFT output style)\n`;
        content += `// Array layout: [real0, imag0, real1, imag1, real2, imag2, ...]\n`;
        content += `// - Bin 0 (DC): real value, imag=0\n`;
        content += `// - Bins 1 to ${this.config.FFT_SIZE/2 - 1}: complex pairs (real, imag)\n`;
        content += `// - Bin ${this.config.FFT_SIZE/2} (Nyquist): real value, imag=0\n`;
        content += `// Total elements: ${this.config.numBins * 2}\n\n`;

        const arraySize = this.config.numBins * 2;
        content += `float eq_mask[${arraySize}] = {\n`;

        for (let i = 0; i < this.config.numBins; i++) {
            const real = complexMask[i].real.toFixed(8);
            const imag = complexMask[i].imag.toFixed(8);

            content += `    ${real}f, ${imag}f`;

            if (i < this.config.numBins - 1) {
                content += ',';
            }

            // Add comments for readability
            if (i === 0) {
                content += '  // Bin 0: DC';
            } else if (i === this.config.numBins - 1) {
                content += `  // Bin ${i}: Nyquist`;
            } else if (i % 16 === 0) {
                content += `  // Bin ${i}`;
            }

            content += '\n';
        }

        content += '};\n';
        return content;
    }
}

// ============================================================================
// APPLICATION STATE & UI
// ============================================================================

class MaskEQDesignerApp {
    constructor() {
        this.config = Config;
        this.eqGenerator = new EQMaskGenerator(this.config);

        // Generate frequency centers for EQ bands (octave spacing)
        this.bandFreqs = this.generateBandFrequencies();

        // Initialize slider gains (all at 0 dB)
        this.bandGains = new Array(this.config.NUM_BANDS).fill(0.0);

        // Initialize UI
        this.initSliders();
        this.initButtons();
        this.updatePlot();
    }

    /**
     * Generate frequency centers for EQ bands with octave spacing
     */
    generateBandFrequencies() {
        const startFreq = 85;
        const maxFreq = this.config.nyquistFreq;
        const freqs = [];

        let freq = startFreq;
        while (freq <= maxFreq && freqs.length < this.config.NUM_BANDS) {
            freqs.push(freq);
            freq *= 2;  // Octave spacing
        }

        // If we need more bands, fill with log spacing
        if (freqs.length < this.config.NUM_BANDS) {
            const logStart = Math.log10(startFreq);
            const logEnd = Math.log10(maxFreq);
            const step = (logEnd - logStart) / (this.config.NUM_BANDS - 1);

            for (let i = 0; i < this.config.NUM_BANDS; i++) {
                freqs[i] = Math.pow(10, logStart + i * step);
            }
        }

        return freqs.slice(0, this.config.NUM_BANDS);
    }

    /**
     * Initialize EQ sliders
     */
    initSliders() {
        const container = document.getElementById('sliders-container');
        container.innerHTML = '';

        for (let i = 0; i < this.config.NUM_BANDS; i++) {
            const sliderBox = document.createElement('div');
            sliderBox.className = 'slider-box';

            // Gain label
            const gainLabel = document.createElement('div');
            gainLabel.className = 'gain-label';
            gainLabel.id = `gain-label-${i}`;
            gainLabel.textContent = '0.0 dB';
            sliderBox.appendChild(gainLabel);

            // Slider
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'slider-vertical';
            slider.id = `slider-${i}`;
            slider.min = this.config.MIN_GAIN_DB;
            slider.max = this.config.MAX_GAIN_DB;
            slider.step = 0.1;
            slider.value = 0;
            slider.orient = 'vertical';  // For some browsers

            slider.addEventListener('input', (e) => {
                this.onSliderChange(i, parseFloat(e.target.value));
            });

            sliderBox.appendChild(slider);

            // Frequency label
            const freqLabel = document.createElement('div');
            freqLabel.className = 'freq-label';
            freqLabel.textContent = this.formatFrequency(this.bandFreqs[i]);
            sliderBox.appendChild(freqLabel);

            container.appendChild(sliderBox);
        }
    }

    /**
     * Initialize control buttons
     */
    initButtons() {
        document.getElementById('btn-flat').addEventListener('click', () => this.presetFlat());
        document.getElementById('btn-bass').addEventListener('click', () => this.presetBassFilter());
        document.getElementById('btn-load').addEventListener('click', () => this.loadFromFile());
        document.getElementById('btn-export').addEventListener('click', () => this.exportMask());

        // Hidden file input for loading
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileLoad(e));

        // Info modal button
        document.getElementById('btn-info').addEventListener('click', () => this.openInfoModal());

        // Modal close handlers
        const modal = document.getElementById('info-modal');
        const closeBtn = document.querySelector('.modal-close');

        closeBtn.addEventListener('click', () => this.closeInfoModal());

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeInfoModal();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeInfoModal();
            }
        });
    }

    /**
     * Handle slider change
     */
    onSliderChange(index, value) {
        this.bandGains[index] = value;
        document.getElementById(`gain-label-${index}`).textContent = `${value.toFixed(1)} dB`;
        this.updatePlot();
    }

    /**
     * Update the frequency response plot using Plotly
     */
    updatePlot() {
        // Generate mask
        const { binFreqs, complexMask, actualMagnitude } =
            this.eqGenerator.generateMinimumPhaseMask(this.bandFreqs, this.bandGains);

        // Convert to dB
        const actualDB = actualMagnitude.map(m => 20 * Math.log10(Math.max(m, 1e-10)));

        // Create interpolated target curve for visualization
        const targetCurve = this.eqGenerator.interpolate(binFreqs, this.bandFreqs, this.bandGains);

        // Plotly traces
        const traces = [
            {
                x: binFreqs,
                y: targetCurve,
                type: 'scatter',
                mode: 'lines',
                name: 'Target Curve',
                line: { color: 'rgba(255, 165, 0, 0.4)', width: 2 },
            },
            {
                x: binFreqs,
                y: actualDB,
                type: 'scatter',
                mode: 'lines',
                name: 'Actual Response',
                line: { color: 'cyan', width: 2 },
            },
            {
                x: this.bandFreqs,
                y: this.bandGains,
                type: 'scatter',
                mode: 'markers',
                name: 'Target',
                marker: {
                    color: 'orange',
                    size: 10,
                    line: { color: 'white', width: 1 }
                },
            }
        ];

        // Plotly layout
        const layout = {
            title: {
                text: 'Frequency Response',
                font: { color: 'white' }
            },
            xaxis: {
                title: 'Frequency (Hz)',
                type: 'log',
                range: [Math.log10(20), Math.log10(this.config.nyquistFreq)],
                color: 'white',
                gridcolor: 'rgba(128, 128, 128, 0.3)',
            },
            yaxis: {
                title: 'Gain (dB)',
                range: [this.config.MIN_GAIN_DB - 2, this.config.MAX_GAIN_DB + 2],
                color: 'white',
                gridcolor: 'rgba(128, 128, 128, 0.3)',
            },
            paper_bgcolor: '#2b2b2b',
            plot_bgcolor: '#1e1e1e',
            font: { color: 'white' },
            legend: {
                bgcolor: 'rgba(43, 43, 43, 0.8)',
                bordercolor: 'white',
                borderwidth: 1,
                font: { color: 'white' }
            },
            margin: { t: 50, b: 50, l: 60, r: 30 },
            hovermode: 'closest',
            dragmode: false  // Disable zoom/pan to allow custom dot dragging
        };

        // Plot configuration
        const plotConfig = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: [
                'zoom2d', 'pan2d', 'select2d', 'lasso2d',
                'zoomIn2d', 'zoomOut2d', 'autoScale2d'
            ],
            toImageButtonOptions: {
                format: 'png',
                filename: 'eq_response',
                height: 600,
                width: 1000,
                scale: 2
            }
        };

        Plotly.newPlot('freq-plot', traces, layout, plotConfig);

        // Add drag interaction for target points
        this.setupDragInteraction();
    }

    /**
     * Setup drag interaction for orange target dots
     */
    setupDragInteraction() {
        const plotDiv = document.getElementById('freq-plot');

        // Track dragging state
        this.isDragging = false;
        this.dragIndex = null;

        // Use plotly_click to detect which dot was clicked
        plotDiv.on('plotly_click', (data) => {
            // Check if clicked on target scatter (trace index 2)
            if (data.points && data.points.length > 0 && data.points[0].curveNumber === 2) {
                const pointIndex = data.points[0].pointIndex;
                this.isDragging = true;
                this.dragIndex = pointIndex;

                // Change cursor to indicate dragging
                plotDiv.style.cursor = 'ns-resize';
            }
        });

        // Use native mousemove for continuous tracking during drag
        plotDiv.addEventListener('mousemove', (event) => {
            if (!this.isDragging || this.dragIndex === null) return;

            // Get the plot's bounding box
            const bbox = plotDiv.getBoundingClientRect();

            // Calculate mouse position relative to plot
            const mouseX = event.clientX - bbox.left;
            const mouseY = event.clientY - bbox.top;

            // Get the plot's layout to find the actual plot area
            const fullLayout = plotDiv._fullLayout;
            if (!fullLayout || !fullLayout.yaxis) return;

            // Convert pixel coordinates to data coordinates
            // Plotly stores the axis range and pixel positions
            const yaxis = fullLayout.yaxis;

            // Calculate the y data value from pixel position
            // Need to account for plot margins and axis scaling
            const plotHeight = yaxis._length; // Height of plot area in pixels
            const plotTop = yaxis._offset; // Top offset of plot area

            // Mouse Y relative to plot area (invert because y increases downward in pixels)
            const yPixelInPlot = mouseY - plotTop;
            const yFraction = 1 - (yPixelInPlot / plotHeight); // Invert for data coordinates

            // Convert fraction to data value
            const yRange = yaxis.range;
            const yValue = yRange[0] + yFraction * (yRange[1] - yRange[0]);

            // Clamp to valid gain range
            const clampedGain = Math.max(this.config.MIN_GAIN_DB,
                                        Math.min(this.config.MAX_GAIN_DB, yValue));

            // Update band gain
            this.bandGains[this.dragIndex] = clampedGain;

            // Update slider and label
            document.getElementById(`slider-${this.dragIndex}`).value = clampedGain;
            document.getElementById(`gain-label-${this.dragIndex}`).textContent =
                `${clampedGain.toFixed(1)} dB`;

            // Redraw plot
            this.updatePlot();
        });

        // Stop dragging on mouse up
        const stopDragging = () => {
            this.isDragging = false;
            this.dragIndex = null;
            plotDiv.style.cursor = 'default';
        };

        plotDiv.addEventListener('mouseup', stopDragging);
        plotDiv.addEventListener('mouseleave', stopDragging);
        document.addEventListener('mouseup', stopDragging);
    }

    /**
     * Format frequency for display
     */
    formatFrequency(freq) {
        if (freq >= 1000) {
            return `${(freq / 1000).toFixed(1)}k`;
        }
        return `${Math.round(freq)}`;
    }

    /**
     * Preset: Flat response (all 0 dB)
     */
    presetFlat() {
        for (let i = 0; i < this.config.NUM_BANDS; i++) {
            this.bandGains[i] = 0.0;
            document.getElementById(`slider-${i}`).value = 0.0;
            document.getElementById(`gain-label-${i}`).textContent = '0.0 dB';
        }
        this.updatePlot();
    }

    /**
     * Preset: Bass filter (+6 dB @ 100 Hz → -6 dB @ 8 kHz)
     */
    presetBassFilter() {
        for (let i = 0; i < this.config.NUM_BANDS; i++) {
            const freq = this.bandFreqs[i];
            let gain;

            if (freq <= 100) {
                gain = 6.0;
            } else if (freq >= 8000) {
                gain = -6.0;
            } else {
                // Log interpolation
                const logRatio = (Math.log10(freq) - Math.log10(100)) /
                               (Math.log10(8000) - Math.log10(100));
                gain = 6.0 - 12.0 * logRatio;
            }

            this.bandGains[i] = gain;
            document.getElementById(`slider-${i}`).value = gain;
            document.getElementById(`gain-label-${i}`).textContent = `${gain.toFixed(1)} dB`;
        }
        this.updatePlot();
    }

    /**
     * Load curve from text file
     */
    loadFromFile() {
        document.getElementById('file-input').click();
    }

    /**
     * Handle file load
     */
    handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.trim().split('\n');

                const fileFreqs = [];
                const fileGains = [];

                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        fileFreqs.push(parseFloat(parts[0]));
                        fileGains.push(parseFloat(parts[1]));
                    }
                }

                if (fileFreqs.length === 0) {
                    alert('Error: File must contain at least one freq/gain pair');
                    return;
                }

                // Interpolate to band frequencies
                for (let i = 0; i < this.config.NUM_BANDS; i++) {
                    let gain = this.eqGenerator.interpolate(
                        [this.bandFreqs[i]], fileFreqs, fileGains
                    )[0];

                    gain = Math.max(this.config.MIN_GAIN_DB,
                                  Math.min(this.config.MAX_GAIN_DB, gain));

                    this.bandGains[i] = gain;
                    document.getElementById(`slider-${i}`).value = gain;
                    document.getElementById(`gain-label-${i}`).textContent =
                        `${gain.toFixed(1)} dB`;
                }

                this.updatePlot();
                alert(`Loaded curve from ${file.name}`);

            } catch (error) {
                alert(`Error loading file: ${error.message}`);
            }
        };

        reader.readAsText(file);
        // Reset file input
        event.target.value = '';
    }

    /**
     * Export EQ mask to .h file
     */
    exportMask() {
        // Generate mask
        const { binFreqs, complexMask, actualMagnitude } =
            this.eqGenerator.generateMinimumPhaseMask(this.bandFreqs, this.bandGains);

        // Export to header file
        const headerContent = this.eqGenerator.exportToHeader(complexMask);

        // Download .h file
        this.downloadFile('eq_mask.h', headerContent, 'text/plain');

        // Also trigger PNG download from Plotly
        // Use Plotly's built-in download feature
        setTimeout(() => {
            const plotDiv = document.getElementById('freq-plot');
            Plotly.downloadImage(plotDiv, {
                format: 'png',
                width: 1000,
                height: 600,
                filename: 'eq_mask'
            });
        }, 100);

        alert('Exported eq_mask.h and eq_mask.png');
    }

    /**
     * Download file helper
     */
    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Open info modal
     */
    openInfoModal() {
        const modal = document.getElementById('info-modal');
        modal.classList.add('show');
    }

    /**
     * Close info modal
     */
    closeInfoModal() {
        const modal = document.getElementById('info-modal');
        modal.classList.remove('show');
    }
}

// ============================================================================
// INITIALIZE APP
// ============================================================================

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    const app = new MaskEQDesignerApp();
    console.log('Mask EQ Designer initialized');
});
