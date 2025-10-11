// Pitch detection using autocorrelation
export class PitchDetector {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.bufferLength = this.analyser.fftSize;
    this.buffer = new Float32Array(this.bufferLength);
  }

  // Autocorrelation algorithm for pitch detection
  autoCorrelate(buffer, sampleRate) {
    let size = buffer.length;
    let maxSamples = Math.floor(size / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;

    // Calculate RMS (root mean square) to detect if there's enough signal
    for (let i = 0; i < size; i++) {
      let val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / size);

    // Not enough signal
    if (rms < 0.01) return -1;

    // Find the best correlation
    let lastCorrelation = 1;
    for (let offset = 1; offset < maxSamples; offset++) {
      let correlation = 0;

      for (let i = 0; i < maxSamples; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset]);
      }

      correlation = 1 - correlation / maxSamples;

      if (correlation > 0.9 && correlation > lastCorrelation) {
        let foundGoodCorrelation = false;

        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
          foundGoodCorrelation = true;
        }

        if (foundGoodCorrelation) {
          // Apply a parabolic interpolation for better accuracy
          let shift = (buffer[bestOffset + 1] - buffer[bestOffset - 1]) / 
                      (2 * (2 * buffer[bestOffset] - buffer[bestOffset - 1] - buffer[bestOffset + 1]));
          return sampleRate / (bestOffset + shift);
        }
      }

      lastCorrelation = correlation;
    }

    if (bestCorrelation > 0.01) {
      return sampleRate / bestOffset;
    }

    return -1;
  }

  detectPitch() {
    this.analyser.getFloatTimeDomainData(this.buffer);
    const frequency = this.autoCorrelate(this.buffer, this.audioContext.sampleRate);
    return frequency;
  }

  getAnalyser() {
    return this.analyser;
  }
}

// Convert frequency to musical note
export function frequencyToNote(frequency) {
  if (frequency <= 0) return null;

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75); // C0 frequency
  
  const halfSteps = 12 * Math.log2(frequency / C0);
  const octave = Math.floor(halfSteps / 12);
  const noteIndex = Math.round(halfSteps % 12);
  
  const noteName = noteNames[noteIndex];
  const cents = Math.round((halfSteps % 1) * 100);
  
  return {
    note: `${noteName}${octave}`,
    noteName,
    octave,
    frequency: frequency.toFixed(2),
    cents
  };
}

// Detect musical key from a collection of notes
export class KeyDetector {
  constructor() {
    this.noteHistory = [];
    this.maxHistory = 50; // Keep last 50 detected notes
    
    // Major and minor key profiles (Krumhansl-Schmuckler)
    this.majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    this.minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  }

  addNote(noteName) {
    if (!noteName) return;
    
    this.noteHistory.push(noteName);
    if (this.noteHistory.length > this.maxHistory) {
      this.noteHistory.shift();
    }
  }

  detectKey() {
    if (this.noteHistory.length < 10) {
      return { key: 'Collecting data...', confidence: 0 };
    }

    // Count note occurrences
    const noteCounts = new Array(12).fill(0);
    const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
    
    this.noteHistory.forEach(note => {
      if (noteMap[note] !== undefined) {
        noteCounts[noteMap[note]]++;
      }
    });

    // Normalize
    const total = noteCounts.reduce((a, b) => a + b, 0);
    const noteProfile = noteCounts.map(count => count / total);

    // Calculate correlation with each key
    let bestKey = '';
    let bestCorrelation = -1;
    const keys = Object.keys(noteMap);

    keys.forEach(key => {
      const keyIndex = noteMap[key];
      
      // Test major key
      let majorCorr = this.correlate(noteProfile, this.majorProfile, keyIndex);
      if (majorCorr > bestCorrelation) {
        bestCorrelation = majorCorr;
        bestKey = `${key} Major`;
      }

      // Test minor key
      let minorCorr = this.correlate(noteProfile, this.minorProfile, keyIndex);
      if (minorCorr > bestCorrelation) {
        bestCorrelation = minorCorr;
        bestKey = `${key} Minor`;
      }
    });

    return {
      key: bestKey,
      confidence: Math.round(bestCorrelation * 100)
    };
  }

  correlate(profile1, profile2, offset) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += profile1[i] * profile2[(i + offset) % 12];
    }
    return sum;
  }

  clear() {
    this.noteHistory = [];
  }
}
