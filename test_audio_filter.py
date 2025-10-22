"""
Audio Filter Test Script - Apply EQ mask from header file to audio

This script validates the exported EQ masks by applying them to audio signals.
Supports white noise generation or loading from WAV files.

Example usage:
    # Test with white noise
    python test_audio_filter.py --noise --header test.h --output filtered_output.wav

    # Test with audio file
    python test_audio_filter.py --input audio.input --header test.h --output filtered_output.wav

Output format:
    Stereo WAV file:
    - Left channel: Original signal (normalized to -12 dB max)
    - Right channel: Filtered signal (un-normalized)
"""

import numpy as np
import argparse
import re
from scipy import signal
import wave
import struct


def parse_header_file(filename):
    """
    Parse .h file to extract interleaved complex FFT mask

    Args:
        filename: Path to .h file containing eq_mask array

    Returns:
        Complex numpy array of FFT coefficients
    """
    with open(filename, 'r') as f:
        content = f.read()

    # Find the eq_mask array
    match = re.search(r'float\s+eq_mask\[(\d+)\]\s*=\s*\{([^}]+)\}', content, re.DOTALL)

    if not match:
        raise ValueError(f"Could not find eq_mask array in {filename}")

    array_size = int(match.group(1))
    array_content = match.group(2)

    # Extract float values (only those followed by 'f')
    values = re.findall(r'([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)f', array_content)
    values = [float(v) for v in values]

    if len(values) != array_size:
        raise ValueError(f"Expected {array_size} values, found {len(values)}")

    # Convert interleaved format to complex array
    num_bins = array_size // 2
    complex_mask = np.zeros(num_bins, dtype=np.complex128)

    for i in range(num_bins):
        real_part = values[i * 2]
        imag_part = values[i * 2 + 1]
        complex_mask[i] = real_part + 1j * imag_part

    return complex_mask


def generate_white_noise(duration_sec, sample_rate):
    """
    Generate white noise signal

    Args:
        duration_sec: Duration in seconds
        sample_rate: Sample rate in Hz

    Returns:
        Numpy array of white noise samples
    """
    num_samples = int(duration_sec * sample_rate)
    noise = np.random.randn(num_samples)
    return noise


def load_audio_file(filename, target_sr):
    """
    Load audio file and resample to target sample rate

    Args:
        filename: Path to WAV file
        target_sr: Target sample rate

    Returns:
        Mono audio signal at target sample rate
    """
    # Read WAV file
    with wave.open(filename, 'rb') as wav_file:
        sr = wav_file.getframerate()
        n_channels = wav_file.getnchannels()
        n_frames = wav_file.getnframes()
        sample_width = wav_file.getsampwidth()

        # Read all frames
        frames = wav_file.readframes(n_frames)

        # Convert to numpy array
        if sample_width == 2:  # 16-bit
            audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
        elif sample_width == 4:  # 32-bit
            audio = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
        else:
            raise ValueError(f"Unsupported sample width: {sample_width}")

        # Convert to mono if stereo
        if n_channels > 1:
            audio = audio.reshape(-1, n_channels).mean(axis=1)

    # Resample if necessary
    if sr != target_sr:
        num_samples = int(len(audio) * target_sr / sr)
        audio = signal.resample(audio, num_samples)

    return audio


def normalize_to_db(audio, target_db):
    """
    Normalize audio to target dB level

    Args:
        audio: Input audio signal
        target_db: Target peak level in dB

    Returns:
        Normalized audio signal
    """
    peak = np.max(np.abs(audio))
    target_linear = 10 ** (target_db / 20.0)

    if peak > 0:
        audio = audio * (target_linear / peak)

    return audio


def apply_frequency_domain_filter(audio, eq_mask, fft_size, overlap_ratio=0.5):
    """
    Apply EQ mask using overlap-add frequency domain filtering

    Args:
        audio: Input audio signal
        eq_mask: Complex FFT mask (num_bins = fft_size/2 + 1)
        fft_size: FFT size
        overlap_ratio: Overlap ratio (0.5 = 50%)

    Returns:
        Filtered audio signal
    """
    hop_size = int(fft_size * (1 - overlap_ratio))
    output = np.zeros(len(audio) + fft_size)

    # Create full symmetric FFT mask for real signal
    # [DC, f1, ..., fN/2] -> [DC, f1, ..., fN/2, conj(fN/2-1), ..., conj(f1)]
    full_mask = np.concatenate([eq_mask, np.conj(eq_mask[-2:0:-1])])

    # Process in overlapping frames
    num_frames = int(np.ceil((len(audio) - fft_size) / hop_size)) + 1

    for i in range(num_frames):
        start = i * hop_size
        end = start + fft_size

        # Extract frame with zero-padding if needed
        if end <= len(audio):
            frame = audio[start:end]
        else:
            frame = np.zeros(fft_size)
            available = len(audio) - start
            if available > 0:
                frame[:available] = audio[start:]

        # Apply windowing (Hann window)
        window = np.hanning(fft_size)
        frame_windowed = frame * window

        # FFT
        spectrum = np.fft.fft(frame_windowed)

        # Apply EQ mask
        filtered_spectrum = spectrum * full_mask

        # IFFT
        filtered_frame = np.fft.ifft(filtered_spectrum).real

        # Overlap-add
        output[start:start + fft_size] += filtered_frame

    # Trim to original length
    output = output[:len(audio)]

    # Compensate for window gain
    # With 50% overlap and Hann window, the sum equals 1
    # For other overlaps, we may need to adjust

    return output


def save_stereo_wav(filename, left_channel, right_channel, sample_rate):
    """
    Save stereo WAV file

    Args:
        filename: Output filename
        left_channel: Left channel audio
        right_channel: Right channel audio
        sample_rate: Sample rate in Hz
    """
    # Ensure same length
    max_len = max(len(left_channel), len(right_channel))
    if len(left_channel) < max_len:
        left_channel = np.pad(left_channel, (0, max_len - len(left_channel)))
    if len(right_channel) < max_len:
        right_channel = np.pad(right_channel, (0, max_len - len(right_channel)))

    # Clip to [-1, 1] and convert to 16-bit PCM
    left_channel = np.clip(left_channel, -1.0, 1.0)
    right_channel = np.clip(right_channel, -1.0, 1.0)

    left_int16 = (left_channel * 32767).astype(np.int16)
    right_int16 = (right_channel * 32767).astype(np.int16)

    # Interleave channels
    stereo = np.empty((max_len * 2,), dtype=np.int16)
    stereo[0::2] = left_int16
    stereo[1::2] = right_int16

    # Write WAV file
    with wave.open(filename, 'wb') as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(stereo.tobytes())


def main():
    parser = argparse.ArgumentParser(description='Apply EQ mask from header file to audio')
    parser.add_argument('--noise', action='store_true', help='Generate white noise instead of loading audio file')
    parser.add_argument('--input', type=str, default='audio.input', help='Input audio file (default: audio.input)')
    parser.add_argument('--header', type=str, default='test.h', help='EQ mask header file (default: test.h)')
    parser.add_argument('--output', type=str, default='filtered_output.wav', help='Output WAV file (default: filtered_output.wav)')
    parser.add_argument('--duration', type=float, default=5.0, help='Duration in seconds for white noise (default: 5.0)')

    args = parser.parse_args()

    # Configuration
    SAMPLE_RATE = 16000
    FFT_SIZE = 256
    TARGET_DB = -12.0

    print("=" * 60)
    print("Audio Filter Test Script")
    print("=" * 60)

    # Load EQ mask from header file
    print(f"\nLoading EQ mask from: {args.header}")
    eq_mask = parse_header_file(args.header)
    print(f"Loaded {len(eq_mask)} complex FFT bins")

    # Generate or load audio
    if args.noise:
        print(f"\nGenerating {args.duration} seconds of white noise at {SAMPLE_RATE} Hz")
        audio = generate_white_noise(args.duration, SAMPLE_RATE)
    else:
        print(f"\nLoading audio from: {args.input}")
        audio = load_audio_file(args.input, SAMPLE_RATE)
        print(f"Loaded {len(audio)} samples ({len(audio)/SAMPLE_RATE:.2f} seconds)")

    # Normalize original to -12 dB
    print(f"\nNormalizing original signal to {TARGET_DB} dB max")
    original_normalized = normalize_to_db(audio, TARGET_DB)

    # Apply filter to normalized signal
    print(f"\nApplying frequency-domain filter (FFT size: {FFT_SIZE}, 50% overlap)")
    filtered = apply_frequency_domain_filter(original_normalized, eq_mask, FFT_SIZE)

    # Report levels
    orig_peak_db = 20 * np.log10(np.max(np.abs(original_normalized)))
    filt_peak_db = 20 * np.log10(np.max(np.abs(filtered))) if np.max(np.abs(filtered)) > 0 else -np.inf

    print(f"\nSignal levels:")
    print(f"  Original (normalized): {orig_peak_db:.2f} dB peak")
    print(f"  Filtered (un-normalized): {filt_peak_db:.2f} dB peak")

    # Save stereo output
    print(f"\nSaving stereo output to: {args.output}")
    print(f"  Left channel:  Original (normalized to {TARGET_DB} dB)")
    print(f"  Right channel: Filtered (un-normalized)")

    save_stereo_wav(args.output, original_normalized, filtered, SAMPLE_RATE)

    print("\n" + "=" * 60)
    print("Processing complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
