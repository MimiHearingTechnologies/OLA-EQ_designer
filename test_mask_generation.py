"""
Quick test script to verify EQ mask generation algorithm

Tests the minimum-phase mask generation with bass filter input
"""

import numpy as np
from mask_eq_designer import Config, EQMaskGenerator

# Initialize
config = Config()
eq_gen = EQMaskGenerator(config)

print("=" * 60)
print("Testing Mask EQ Designer Algorithm")
print("=" * 60)
print(f"Sample Rate: {config.SAMPLE_RATE} Hz")
print(f"FFT Size: {config.FFT_SIZE}")
print(f"Output Bins: {config.num_bins}")
print(f"Nyquist Frequency: {config.nyquist_freq} Hz")
print()

# Load test bass filter data
print("Loading test_bass_filter.txt...")
data = np.loadtxt("test_bass_filter.txt")
test_freqs = data[:, 0]
test_gains = data[:, 1]

print(f"Input data points: {len(test_freqs)}")
print("Frequency (Hz) | Gain (dB)")
print("-" * 30)
for f, g in zip(test_freqs, test_gains):
    print(f"{f:12.1f} | {g:8.1f}")
print()

# Generate mask
print("Generating minimum-phase mask...")
bin_freqs, complex_mask, actual_magnitude = eq_gen.generate_minimum_phase_mask(
    test_freqs, test_gains
)

print(f"Generated {len(complex_mask)} complex coefficients")
print()

# Verify output
print("Output verification:")
print(f"  DC component: {complex_mask[0]}")
print(f"  Nyquist component: {complex_mask[-1]}")
print(f"  Max magnitude: {np.max(actual_magnitude):.4f}")
print(f"  Min magnitude: {np.min(actual_magnitude):.4f}")
print()

# Check a few bins
print("Sample bins:")
print("Bin | Freq (Hz) | Real      | Imag      | Magnitude")
print("-" * 60)
for i in [0, 10, 64, 128]:
    if i < len(complex_mask):
        print(f"{i:3d} | {bin_freqs[i]:8.1f} | {complex_mask[i].real:9.6f} | "
              f"{complex_mask[i].imag:9.6f} | {actual_magnitude[i]:.4f}")
print()

# Test export
print("Testing export to header file...")
eq_gen.export_to_header(complex_mask, "test_output.h")
print("[OK] Exported to test_output.h")
print()

# Verify header file was created
import os
if os.path.exists("test_output.h"):
    file_size = os.path.getsize("test_output.h")
    print(f"[OK] Header file created successfully ({file_size} bytes)")

    # Show first few lines
    with open("test_output.h", 'r') as f:
        lines = f.readlines()
    print("\nFirst 15 lines of header file:")
    print("-" * 60)
    for line in lines[:15]:
        print(line.rstrip())
else:
    print("[ERROR] Header file not created")

print()
print("=" * 60)
print("Test completed successfully!")
print("=" * 60)
