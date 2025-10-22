"""
Compare Python and JavaScript versions of the EQ mask generator
This script generates a mask using Python and compares key values
that can be manually verified against the JavaScript test output.
"""

import numpy as np
from mask_eq_designer import Config, EQMaskGenerator

# Initialize
config = Config()
eq_gen = EQMaskGenerator(config)

print("=" * 60)
print("Python Version Output (for comparison with JS)")
print("=" * 60)
print(f"Sample Rate: {config.SAMPLE_RATE} Hz")
print(f"FFT Size: {config.FFT_SIZE}")
print(f"Output Bins: {config.num_bins}")
print(f"Nyquist Frequency: {config.nyquist_freq} Hz")
print()

# Test 1: Flat response
print("Test 1: Flat Response (all 0 dB)")
print("-" * 60)
test_freqs_1 = np.array([100, 1000, 8000])
test_gains_1 = np.array([0, 0, 0])

bin_freqs_1, complex_mask_1, actual_mag_1 = eq_gen.generate_minimum_phase_mask(
    test_freqs_1, test_gains_1
)

print(f"Max magnitude: {np.max(actual_mag_1):.6f} (should be ~1.0)")
print(f"Min magnitude: {np.min(actual_mag_1):.6f} (should be ~1.0)")
print(f"DC component: {complex_mask_1[0].real:.6f}")
print(f"Nyquist component: {complex_mask_1[-1].real:.6f}")
print()

# Test 2: Bass filter
print("Test 2: Bass Filter from File")
print("-" * 60)

data = np.loadtxt("test_bass_filter.txt")
test_freqs_2 = data[:, 0]
test_gains_2 = data[:, 1]

print(f"Loaded {len(test_freqs_2)} data points from test_bass_filter.txt")
print("Input data:")
for f, g in zip(test_freqs_2, test_gains_2):
    print(f"  {f:.1f} Hz: {g:.1f} dB")
print()

bin_freqs_2, complex_mask_2, actual_mag_2 = eq_gen.generate_minimum_phase_mask(
    test_freqs_2, test_gains_2
)

print("Generated mask:")
print(f"  Number of bins: {len(complex_mask_2)}")
print(f"  DC magnitude: {actual_mag_2[0]:.4f}")
print(f"  Max magnitude: {np.max(actual_mag_2):.4f}")
print(f"  Min magnitude: {np.min(actual_mag_2):.4f}")
print()

print("Sample bins (compare with JavaScript output):")
print("Bin | Freq (Hz) | Real      | Imag      | Magnitude | Phase")
print("-" * 80)
for i in [0, 10, 64, 128]:
    if i < len(complex_mask_2):
        c = complex_mask_2[i]
        mag = np.abs(c)
        phase = np.angle(c)
        print(f"{i:3d} | {bin_freqs_2[i]:8.1f} | {c.real:9.6f} | "
              f"{c.imag:9.6f} | {mag:9.4f} | {phase:7.4f}")
print()

print("=" * 60)
print("Comparison Complete!")
print("=" * 60)
print()
print("Compare the sample bin values above with the JavaScript test output.")
print("The values should match to within floating-point precision (~1e-6).")
print()
print("If values match, the JavaScript port is accurate!")
