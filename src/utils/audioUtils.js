// Pitch detection using autocorrelation
export class PitchDetector {
  constructor(audioContext, fftSize = 2048) {
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.bufferLength = this.analyser.fftSize;
    this.buffer = new Float32Array(this.bufferLength);
  }

  setFftSize(fftSize) {
    this.analyser.fftSize = fftSize;
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
    
    // Track key detections over time for consensus
    this.keyVotes = {}; // { "C Major": count, "D Minor": count, ... }
    this.maxKeyVotes = 30; // Keep last 30 key detections
    this.keyVoteHistory = []; // Array to maintain order
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
    const keyHistogram = []; // Store all key correlations for histogram

    keys.forEach(key => {
      const keyIndex = noteMap[key];
      
      // Test major key
      let majorCorr = this.correlate(noteProfile, this.majorProfile, keyIndex);
      keyHistogram.push({ key: `${key} Major`, correlation: majorCorr });
      if (majorCorr > bestCorrelation) {
        bestCorrelation = majorCorr;
        bestKey = `${key} Major`;
      }

      // Test minor key
      let minorCorr = this.correlate(noteProfile, this.minorProfile, keyIndex);
      keyHistogram.push({ key: `${key} Minor`, correlation: minorCorr });
      if (minorCorr > bestCorrelation) {
        bestCorrelation = minorCorr;
        bestKey = `${key} Minor`;
      }
    });

    // Normalize confidence to 0-100 range
    // The correlation value needs to be normalized based on the max possible correlation
    const maxCorrelation = this.getMaxCorrelation();
    const normalizedConfidence = (bestCorrelation / maxCorrelation) * 100;
    
    // Track this detection as a vote
    this.keyVoteHistory.push(bestKey);
    if (this.keyVoteHistory.length > this.maxKeyVotes) {
      this.keyVoteHistory.shift();
    }
    
    // Rebuild vote counts
    this.keyVotes = {};
    this.keyVoteHistory.forEach(key => {
      this.keyVotes[key] = (this.keyVotes[key] || 0) + 1;
    });
    
    // Find consensus key (most votes)
    let consensusKey = bestKey;
    let maxVotes = 0;
    Object.entries(this.keyVotes).forEach(([key, votes]) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        consensusKey = key;
      }
    });
    
    // Create histogram from vote counts (not correlations)
    const voteHistogram = Object.entries(this.keyVotes)
      .map(([key, votes]) => ({
        key,
        confidence: this.keyVoteHistory.length > 0 
          ? Math.round((votes / this.keyVoteHistory.length) * 100)
          : 0
      }))
      .sort((a, b) => b.confidence - a.confidence); // Sort by vote percentage descending
    
    const consensusConfidence = this.keyVoteHistory.length > 0 
      ? Math.round((maxVotes / this.keyVoteHistory.length) * 100)
      : 0;
    
    return {
      key: bestKey, // Instantaneous detection
      confidence: Math.round(Math.max(0, Math.min(100, normalizedConfidence))),
      consensusKey, // Most voted key
      consensusConfidence,
      histogram: voteHistogram // Show vote counts, not correlations
    };
  }

  correlate(profile1, profile2, offset) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += profile1[i] * profile2[(i + offset) % 12];
    }
    return sum;
  }

  getMaxCorrelation() {
    // Calculate the maximum possible correlation value
    // This is the sum of the profile values (for normalization)
    return this.majorProfile.reduce((a, b) => a + b, 0);
  }

  clear() {
    this.noteHistory = [];
    this.keyVotes = {};
    this.keyVoteHistory = [];
  }
}

// Beat detection using energy-based algorithm
export class BeatDetector {
  constructor(audioContext, fftSize = 2048) {
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    
    // Initialize beat detection parameters
    this.initBeatParams();
  }

  setFftSize(fftSize) {
    this.analyser.fftSize = fftSize;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
  }

  // Initialize beat detection parameters (called in constructor)
  initBeatParams() {
    // Beat detection parameters
    this.energyHistory = [];
    this.historySize = 43; // Approximately 1 second at 60fps
    this.beatThreshold = 1.3; // Energy must be 30% above average
    this.minTimeBetweenBeats = 300; // Minimum 300ms between beats (200 BPM max)
    this.lastBeatTime = 0;
    
    // BPM calculation
    this.beatTimes = [];
    this.maxBeatHistory = 8; // Keep last 8 beats for BPM calculation
    this.currentBPM = 0;
    
    // BPM histogram for visualization
    this.bpmHistory = []; // Store recent BPM readings
    this.maxBPMHistory = 30; // Keep last 30 BPM readings
  }

  // Calculate instantaneous energy
  getEnergy() {
    this.analyser.getByteFrequencyData(this.dataArray);
    
    let sum = 0;
    // Focus on lower frequencies (bass) for beat detection
    const bassRange = Math.floor(this.bufferLength * 0.1); // First 10% of spectrum
    
    for (let i = 0; i < bassRange; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    
    return sum / bassRange;
  }

  // Detect if current energy indicates a beat
  detectBeat() {
    const currentTime = Date.now();
    const energy = this.getEnergy();
    
    // Add to history
    this.energyHistory.push(energy);
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift();
    }
    
    // Need enough history to make a decision
    if (this.energyHistory.length < this.historySize) {
      return { isBeat: false, bpm: 0, confidence: 0 };
    }
    
    // Calculate average energy
    const averageEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    
    // Check if current energy is significantly higher than average
    const isBeat = energy > (averageEnergy * this.beatThreshold) && 
                   (currentTime - this.lastBeatTime) > this.minTimeBetweenBeats;
    
    if (isBeat) {
      this.lastBeatTime = currentTime;
      this.beatTimes.push(currentTime);
      
      // Keep only recent beats
      if (this.beatTimes.length > this.maxBeatHistory) {
        this.beatTimes.shift();
      }
      
      // Calculate BPM from beat intervals
      this.currentBPM = this.calculateBPM();
      
      // Add to BPM history
      if (this.currentBPM > 0) {
        this.bpmHistory.push(Math.round(this.currentBPM));
        if (this.bpmHistory.length > this.maxBPMHistory) {
          this.bpmHistory.shift();
        }
      }
    }
    
    // Calculate confidence based on consistency of beat intervals
    const confidence = this.calculateConfidence();
    
    // Build BPM histogram
    const bpmHistogram = this.getBPMHistogram();
    
    // Find consensus BPM (most common in histogram)
    let consensusBPM = Math.round(this.currentBPM);
    let consensusConfidence = 0;
    
    if (bpmHistogram.length > 0) {
      // Get the BPM with highest percentage
      const topBPM = bpmHistogram[0]; // Already sorted by percentage descending
      consensusBPM = topBPM.bpm;
      consensusConfidence = topBPM.percentage;
    }
    
    return {
      isBeat,
      bpm: Math.round(this.currentBPM), // Instantaneous BPM
      confidence,
      consensusBPM, // Most voted BPM
      consensusConfidence,
      energy: Math.round(energy),
      histogram: bpmHistogram
    };
  }

  calculateBPM() {
    if (this.beatTimes.length < 2) {
      return 0;
    }
    
    // Calculate average interval between beats
    const intervals = [];
    for (let i = 1; i < this.beatTimes.length; i++) {
      intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
    }
    
    const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Convert to BPM (beats per minute)
    const bpm = 60000 / averageInterval;
    
    // Clamp to reasonable range
    return Math.max(40, Math.min(240, bpm));
  }

  calculateConfidence() {
    if (this.beatTimes.length < 3) {
      return 0;
    }
    
    // Calculate variance in beat intervals
    const intervals = [];
    for (let i = 1; i < this.beatTimes.length; i++) {
      intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
    }
    
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Prevent division by zero
    if (mean === 0) return 0;
    
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - mean, 2);
    }, 0) / intervals.length;
    
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = (stdDev / mean) * 100;
    
    // Lower coefficient of variation = higher confidence
    // Clamp to ensure we stay within 0-100 range
    const confidence = 100 - coefficientOfVariation;
    
    return Math.round(Math.max(0, Math.min(100, confidence)));
  }

  getBPMHistogram() {
    if (this.bpmHistory.length === 0) {
      return [];
    }
    
    // Group BPM values into buckets (±2 BPM range)
    const buckets = {};
    this.bpmHistory.forEach(bpm => {
      // Round to nearest 2 to create buckets
      const bucket = Math.round(bpm / 2) * 2;
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });
    
    // Convert to array and calculate percentages
    const total = this.bpmHistory.length;
    const histogram = Object.entries(buckets)
      .map(([bpm, count]) => ({
        bpm: parseInt(bpm),
        count,
        percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage); // Sort by percentage descending
    
    return histogram;
  }

  getAnalyser() {
    return this.analyser;
  }

  reset() {
    this.energyHistory = [];
    this.beatTimes = [];
    this.bpmHistory = [];
    this.currentBPM = 0;
    this.lastBeatTime = 0;
  }
}

// Audio file player for calibration
export class AudioPlayer {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.audioElement = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.isPlaying = false;
  }

  async loadAudio(url) {
    // Create audio element
    this.audioElement = new Audio(url);
    this.audioElement.crossOrigin = 'anonymous';
    
    // Wait for audio to be loadable
    return new Promise((resolve, reject) => {
      this.audioElement.addEventListener('canplaythrough', () => resolve(), { once: true });
      this.audioElement.addEventListener('error', (e) => reject(e), { once: true });
      this.audioElement.load();
    });
  }

  connectToAnalyser(analyser) {
    if (!this.audioElement) {
      throw new Error('Audio not loaded. Call loadAudio() first.');
    }

    // Create media element source if not already created
    if (!this.sourceNode) {
      this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    }

    // Connect to analyser
    this.sourceNode.connect(analyser);
    
    // Also connect to destination so we can hear it
    this.sourceNode.connect(this.audioContext.destination);
    
    this.analyserNode = analyser;
  }

  play() {
    if (this.audioElement) {
      this.audioElement.play();
      this.isPlaying = true;
    }
  }

  pause() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.isPlaying = false;
    }
  }

  isAudioPlaying() {
    return this.isPlaying && this.audioElement && !this.audioElement.paused;
  }

  getCurrentTime() {
    return this.audioElement ? this.audioElement.currentTime : 0;
  }

  getDuration() {
    return this.audioElement ? this.audioElement.duration : 0;
  }

  setVolume(volume) {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  cleanup() {
    this.stop();
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    if (this.audioElement) {
      this.audioElement.src = '';
      this.audioElement = null;
    }
  }
}
