# Mask EQ Designer

A graphical equalizer application for designing minimum-phase frequency-domain EQ masks for embedded DSP applications.

## Features

- **14-band graphic equalizer** with octave-spaced frequency bands (85 Hz - 8 kHz)
- **Interactive target dot dragging** on frequency response plot - click and drag orange dots to adjust EQ
- **Real-time frequency response visualization** using matplotlib
- **Minimum-phase response generation** using cepstral method
- **Preset curves**: Flat, Bass Filter
- **Load curves from text files** (freq_hz gain_db format)
- **Export to C header files** (.h) with 129 complex FFT bins in interleaved format
- **PNG plot generation** showing target vs actual response
- **Configurable parameters**: Sample rate, FFT size, number of bands

## Installation

Install required packages:
```bash
pip install -r requirements.txt
```

Required packages:
- customtkinter >= 5.2.0
- matplotlib >= 3.7.0
- numpy >= 1.24.0
- scipy >= 1.10.0

## Usage

### Running the Application

```bash
python mask_eq_designer.py
```

### GUI Controls

- **Sliders**: Adjust gain for each frequency band (-18 dB to +6 dB)
- **Interactive Dots**: Click and drag orange target dots on the frequency response plot to adjust gain values
- **Flat Button**: Reset all bands to 0 dB
- **Bass Filter Button**: Apply preset bass boost curve (+6 dB @ 100 Hz → -6 dB @ 8 kHz)
- **Load File Button**: Load frequency/gain curve from text file
- **Export Button**: Generate .h header file and PNG plot

### Input File Format

Text files should contain space or tab-separated values:
```
freq_hz gain_db
50 6.0
100 6.0
500 0.0
1000 -2.0
8000 -6.0
```

Example: `test_bass_filter.txt`

### Output Files

**Header file (.h)**: Contains interleaved real/imaginary pairs for embedded DSP use
```c
// Python FFT output style - interleaved format
float eq_mask[258] = {...};  // [real0, imag0, real1, imag1, ...]
```

**PNG image**: Visual comparison of target vs actual magnitude response

## Configuration

Edit the `Config` class in `mask_eq_designer.py` to modify:

```python
SAMPLE_RATE = 16000    # Sample rate in Hz
FFT_SIZE = 256         # FFT size (output: FFT_SIZE/2 + 1 bins)
NUM_BANDS = 14         # Number of graphic EQ bands
MIN_GAIN_DB = -18.0    # Minimum slider gain
MAX_GAIN_DB = 6.0      # Maximum slider gain
```

## Technical Details

### Algorithm

The application generates minimum-phase EQ masks using the following process:

1. Interpolate user-defined gain values across FFT frequency bins
2. Convert dB gains to linear magnitude
3. Apply cepstral method to generate minimum-phase response:
   - Take logarithm of magnitude
   - Compute real cepstrum via IFFT
   - Apply causal windowing (double positive frequencies)
   - Transform back via FFT
   - Convert from log domain to complex spectrum

This ensures the output has minimum group delay, which is desirable for real-time audio processing.

### Output Format

- **FFT Size**: 256 samples
- **Sample Rate**: 16000 Hz (default)
- **Output Bins**: 129 (DC + 128 bins to Nyquist)
- **Frequency Resolution**: 62.5 Hz per bin
- **Nyquist Frequency**: 8000 Hz

## Testing

Run the test script to verify mask generation:
```bash
python test_mask_generation.py
```

This tests the algorithm with the bass filter preset and exports test files.

## Platform Support

- Windows (primary)
- macOS (compatible)
- Linux (compatible)

## Example Workflow

1. Launch application: `python mask_eq_designer.py`
2. Adjust EQ curve using sliders, interactive dot dragging, or load from file
3. Preview response in real-time plot
4. Click **Export** to generate .h file and PNG
5. Use generated header file in your embedded DSP project

## Notes

- The GUI handles window resizing gracefully
- All frequency axes use logarithmic scaling for better visualization
- Minimum phase ensures causality and minimum group delay
- Export creates both data file (.h) and visualization (PNG)
