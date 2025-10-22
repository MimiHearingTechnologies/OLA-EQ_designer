# Mask EQ Designer - Web Version

A web-based graphic equalizer application for designing minimum-phase frequency-domain EQ masks for embedded DSP applications.

This is a pure JavaScript port of the Python CustomTkinter version, requiring no server or installation - just open in a web browser.

## Features

- **14-band graphic equalizer** with octave-spaced frequency bands (85 Hz - 8 kHz)
- **Interactive target dot dragging** on frequency response plot - click orange dots to adjust EQ
- **Real-time frequency response visualization** using Plotly.js
- **Minimum-phase response generation** using cepstral method (FFT-based)
- **Preset curves**: Flat, Bass Filter
- **Load curves from text files** (freq_hz gain_db format)
- **Export to C header files** (.h) with 129 complex FFT bins in interleaved format
- **PNG plot export** showing target vs actual response
- **Fully client-side** - no server required, works offline once loaded
- **Responsive design** - works on desktop and mobile devices

## Usage

### Running Locally

Simply open `index.html` in any modern web browser:

```bash
# Navigate to the web folder
cd web

# Open in your default browser (or double-click index.html)
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

### Deploying to GitHub Pages

1. Push the `web` folder to your GitHub repository
2. Go to repository Settings → Pages
3. Set source to your main branch and `/web` folder
4. Your app will be available at `https://yourusername.github.io/repositoryname/`

Alternatively, you can make the web folder the root of a gh-pages branch.

## GUI Controls

- **Sliders**: Adjust gain for each frequency band (-18 dB to +6 dB)
- **Interactive Plot**: Click and drag orange target dots on the frequency response plot to adjust gain values
  - Click on any orange dot to select it
  - While holding the mouse button, drag up/down to adjust the gain
  - Release to finish adjusting
  - The cursor will change to ↕ (vertical resize) during drag
- **Flat Button**: Reset all bands to 0 dB
- **Bass Filter Button**: Apply preset bass boost curve (+6 dB @ 100 Hz → -6 dB @ 8 kHz)
- **Load File Button**: Load frequency/gain curve from text file
- **Export Button**: Download .h header file and PNG plot image

## Input File Format

Text files should contain space or tab-separated values:
```
freq_hz gain_db
50 6.0
100 6.0
500 0.0
1000 -2.0
8000 -6.0
```

You can use the `test_bass_filter.txt` from the parent directory for testing.

## Output Files

### Header file (.h)
Contains interleaved real/imaginary pairs for embedded DSP use:
```c
// Interleaved format - Python FFT output style
float eq_mask[258] = {
    real0, imag0,  // Bin 0: DC
    real1, imag1,  // Bin 1
    ...
    real128, imag128  // Bin 128: Nyquist
};
```

### PNG image
Visual comparison of target vs actual magnitude response, exported directly from the plot.

## Configuration

Default parameters (can be modified in `eq_designer.js`):

```javascript
const Config = {
    SAMPLE_RATE: 16000,    // Sample rate in Hz
    FFT_SIZE: 256,         // FFT size (output: FFT_SIZE/2 + 1 bins)
    NUM_BANDS: 14,         // Number of graphic EQ bands
    MIN_GAIN_DB: -18.0,    // Minimum slider gain
    MAX_GAIN_DB: 6.0       // Maximum slider gain
};
```

## Technical Details

### Algorithm

The application generates minimum-phase EQ masks using the following process:

1. Interpolate user-defined gain values across FFT frequency bins
2. Convert dB gains to linear magnitude
3. Apply cepstral method to generate minimum-phase response:
   - Take logarithm of magnitude
   - Compute real cepstrum via IFFT (Cooley-Tukey radix-2)
   - Apply causal windowing (zero negative time, double positive time)
   - Transform back via FFT
   - Convert from log domain to complex spectrum via exponential

This ensures the output has minimum group delay, which is desirable for real-time audio processing.

### Output Format

- **FFT Size**: 256 samples
- **Sample Rate**: 16000 Hz (default)
- **Output Bins**: 129 (DC + bins 1-128 to Nyquist)
- **Frequency Resolution**: 62.5 Hz per bin
- **Nyquist Frequency**: 8000 Hz

### Implementation Details

- **FFT**: Custom Cooley-Tukey radix-2 implementation in JavaScript
- **Complex arithmetic**: Custom Complex number class
- **Plotting**: Plotly.js for interactive, publication-quality plots
- **No dependencies** except Plotly.js (loaded via CDN)
- **Pure client-side**: All DSP processing runs in the browser

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript (classes, arrow functions, etc.)
- HTML5 File API
- Canvas (for Plotly)

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Differences from Python Version

### Functional Parity
- ✅ All core features implemented
- ✅ Same algorithm (minimum-phase cepstral method)
- ✅ Same output format (.h files)
- ✅ Interactive plot with dragging
- ✅ Preset curves and file loading

### Improvements
- 🌐 No installation required - runs in browser
- 📱 Mobile-friendly responsive design
- 🔗 Easy to share via URL (GitHub Pages)
- ⚡ Instant startup (no Python runtime)

### Known Limitations
- Audio file processing not implemented (placeholder in Python version)
- Dragging behavior slightly different (uses Plotly events vs matplotlib)

## Example Workflow

1. Open `index.html` in web browser
2. Adjust EQ curve using sliders or drag orange dots on plot
3. Or click "Bass Filter" for preset curve
4. Or click "Load File" to load curve from text file
5. Preview response in real-time plot
6. Click **Export** to download eq_mask.h and eq_mask.png
7. Use generated header file in your embedded DSP project

## Files

- `index.html` - Main application page
- `style.css` - Dark theme styling
- `eq_designer.js` - Core DSP algorithm and UI logic
- `README.md` - This file

## License

Same as parent project.

## Credits

Web version ported from the Python CustomTkinter implementation.
Maintains the same minimum-phase EQ mask generation algorithm.
