claude rules for mask-EQ-designer

in this project, write short notes in header of all source code, but do not use hyperbole. give examples how tp use the code.
this project is to generate an EQ mask: this is a frequency domain (real and imaginary) set of coefficients. 
The mask is made from a target magnitude, specified either graphically (liek a "Graphic EQ") or from a list, eg from input text file specifying frequency vs target gain in dB. Defautl is a graphic EQ, with frequency axis as 1/3rd octave, with sliders from -18 dB to + 6 dB. 
There should be some buttons for preset curves: flat, bass filter (+6 dB at 100 Hz sloping to -6 dB at 8 kHz). also a button for "export curve", ie to dump the generated freq. domain values to a .h file, for use by a cpp project that runs on an embedded 32 bit float dsp. when this button is pressed, also make png image that shows target vs actual magitude response. 

the output header file should be N/2+1 bins, where N is fft size. that prob means, dC, then real and imag up to NQ
what algorithm to use go generate output? you must research this. note the output eq must have a minimum phase response!
Project sample rate default is 16 kHz.
FFT size is 256. output mask size is 129 bins.
todo after we have tested this: also have a button to optionally process an iut audio file with the generated filter, eg using overlap add. input file should be resampled and mono'd. button is placeholder until we get other things working ie eq generation.
this is for windows pc as default but should work on macbook.
design should be simple, elegant, and not too colourful, for engineers to use. gui should handle resize.
always test this works first.
do not generate a venv, just install packages if needed, but make a requirements.txt to show packages we need.2