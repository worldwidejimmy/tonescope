# ToneScope - Development Documentation

**Last Updated:** October 11, 2025  
**GitHub Repository:** https://github.com/worldwidejimmy/tonescope  
**Current Version:** 1.0.0

---

## Project Overview

ToneScope is a real-time music analysis web application that detects musical notes, keys, and beats from live audio input or audio files. Built with React 18.3.1, Vite 5.4.2, and the Web Audio API.

### Core Functionality

1. **Pitch Detection** - Autocorrelation algorithm to detect musical notes from audio frequency
2. **Key Detection** - Krumhansl-Schmuckler algorithm to determine musical key from note distribution
3. **Beat Detection** - Energy-based algorithm analyzing bass frequencies for BPM calculation
4. **Real-time Visualizations** - Canvas-based waveform, frequency spectrum, and chromatic note circle
5. **Histogram Analysis** - Vote bucket displays for notes, keys, and BPM distributions
6. **Calibration Mode** - Audio file playback for testing with known reference tracks

---

## Architecture

### File Structure

```
tonescope/
├── src/
│   ├── App.jsx (643 lines)           # Main application component, detection loop, state management
│   ├── App.css (610 lines)           # Styling with gradients, responsive design, slider controls
│   ├── Visualizer.jsx (204 lines)    # Canvas visualizations (waveform, spectrum, note circle)
│   ├── Visualizer.css                # Visualization styling
│   ├── AnalysisPanel.jsx (266 lines) # Histogram displays for notes, keys, BPM
│   ├── AnalysisPanel.css (192 lines) # Histogram styling
│   ├── main.jsx                      # React entry point
│   ├── index.css                     # Global styles
│   └── utils/
│       ├── audioUtils.js (555 lines) # Core audio analysis classes
│       └── songLibrary.js            # Calibration track metadata (11 tracks)
├── public/
│   └── audio/                        # Audio files for calibration
├── tonescope_calibration_tracks/     # CC0 audio files (12MB)
│   ├── clips/                        # Short MP3 clips for quick testing
│   ├── full/                         # Full-length tracks
│   ├── metronome/                    # Metronome files with various features
│   ├── LICENSE.txt                   # CC0 license info
│   └── README.txt                    # Track credits
├── package.json                      # Dependencies and scripts
├── vite.config.js                    # Vite build configuration
├── README.md                         # User-facing documentation
└── DEVELOPMENT.md                    # This file - technical documentation for AI agents
```

---

## Core Components

### App.jsx - Main Application Component

**Purpose:** Orchestrates all detection, manages state, handles user interactions

**Key State Variables:**
- `noteDetectionEnabled` - Toggle for pitch/key detection
- `beatDetectionEnabled` - Toggle for beat/BPM detection
- `currentNote` - Currently detected note object
- `keyData` - Key detection results with consensus
- `beatInfo` - Beat detection results with BPM
- `noteHistogram` - Distribution of detected notes
- `squelchThreshold` (default: 20) - Volume threshold to filter noise (0-50%)
- `updateRate` (default: 60) - Detection sampling rate in Hz (5-60)
- `fftSize` (default: 2048) - FFT size for frequency analysis (512-8192)
- `isCalibrationMode` - Whether in calibration or live mode
- `selectedSong` - Currently playing calibration track

**Detection Loop (detectPitch function):**
```javascript
1. Throttle updates based on updateRate slider
2. Check volume against squelchThreshold (stores boolean isAboveSquelch)
3. If noteDetectionEnabled AND isAboveSquelch:
   - Run pitch detection via PitchDetector.detectPitch()
   - Convert frequency to note
   - Update note histogram
   - Run key detection via KeyDetector.detectKey()
4. If beatDetectionEnabled (independent of squelch):
   - Run beat detection via BeatDetector.detectBeat()
5. Schedule next frame with requestAnimationFrame
```

**Critical Issue Fixed (Oct 10, 2025):**
- Squelch logic was initially blocking ALL detection when below threshold
- Fixed by checking squelch first, storing boolean, making note detection conditional
- Beat detection runs independently regardless of squelch
- This allows beat detection to continue even when melody is quiet

**Audio Setup:**
- `startListening()` - Initializes microphone, creates PitchDetector/KeyDetector/BeatDetector with fftSize
- `startCalibrationMode()` - Loads audio file, creates AudioPlayer and analysis nodes
- `handleFftSizeChange()` - Dynamically updates FFT size via setFftSize() methods

### audioUtils.js - Core Analysis Algorithms

**Exports:**
- `PitchDetector` class
- `KeyDetector` class
- `BeatDetector` class
- `AudioPlayer` class
- `frequencyToNote()` function

#### PitchDetector Class

**Constructor:** `new PitchDetector(audioContext, fftSize = 2048)`

**Key Methods:**
- `detectPitch()` - Returns frequency in Hz using autocorrelation
- `autoCorrelate(buffer, sampleRate)` - Autocorrelation algorithm for pitch detection
- `setFftSize(fftSize)` - Updates FFT size dynamically
- `getAnalyser()` - Returns AnalyserNode for visualization access

**Algorithm:** Time-domain autocorrelation
1. Gets time domain data from analyser
2. Calculates autocorrelation for potential periods
3. Finds maximum correlation (ignoring DC component)
4. Refines frequency using quadratic interpolation
5. Returns fundamental frequency

#### KeyDetector Class

**Constructor:** `new KeyDetector()`

**Key Methods:**
- `addNote(noteName)` - Adds note to history (max 50)
- `detectKey()` - Returns key detection result object
- `correlate(profile1, profile2, offset)` - Correlates note distribution with key profiles
- `clear()` - Resets note history and votes

**Algorithm:** Krumhansl-Schmuckler key-finding
1. Builds note profile from last 50 detected notes (12-element array for chromatic scale)
2. Normalizes to percentages
3. Correlates with major/minor key profiles (research-based weights)
4. Tests all 24 keys (12 major + 12 minor)
5. Returns best match with confidence

**Key Profiles (from Carol Krumhansl's research):**
- Major: `[6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]`
- Minor: `[6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]`

These represent the statistical importance of each note in a key.

**Return Object:**
```javascript
{
  key: "C Major",              // Instantaneous detection (this sample)
  confidence: 75,              // Correlation confidence (0-100%)
  consensusKey: "C Major",     // Most voted key over last 30 samples
  consensusConfidence: 80,     // Vote percentage (0-100%)
  histogram: [                 // Vote distribution for visualization
    { key: "C Major", confidence: 80 },
    { key: "A Minor", confidence: 15 },
    ...
  ]
}
```

**Consensus Tracking:**
- Keeps last 30 key detections in `keyVoteHistory`
- Counts votes in `keyVotes` object
- Consensus key is the one with most votes
- **IMPORTANT:** Histogram shows vote buckets, NOT instantaneous correlations (fixed Oct 10, 2025)

#### BeatDetector Class

**Constructor:** `new BeatDetector(audioContext, fftSize = 2048)`

**Key Methods:**
- `detectBeat()` - Returns beat detection result object
- `getEnergy()` - Calculates current energy in bass frequencies
- `calculateBPM()` - Calculates BPM from beat intervals
- `calculateConfidence()` - Calculates beat detection confidence
- `getBPMHistogram()` - Returns BPM distribution for visualization
- `setFftSize(fftSize)` - Updates FFT size WITHOUT resetting state
- `initBeatParams()` - Initializes beat detection parameters (called in constructor)
- `reset()` - Clears all beat detection state

**Algorithm:** Energy-based beat detection
1. Gets frequency data from analyser
2. Calculates energy in bass range (first 10% of spectrum)
3. Maintains energy history (43 samples ≈ 1 second at 60fps)
4. Detects beat when current energy > average × 1.3 threshold
5. Enforces minimum 300ms between beats (200 BPM max)
6. Calculates BPM from last 8 beat intervals
7. Maintains BPM histogram for last 30 readings

**Critical Fix (Oct 10, 2025):**
- `setFftSize()` was resetting ALL beat detection state (energyHistory, beatTimes, currentBPM, etc.)
- This broke beat detection whenever user adjusted FFT size slider
- Fixed by creating separate `initBeatParams()` method for initialization
- `setFftSize()` now ONLY updates analyser settings, preserves beat state

**Beat Detection Parameters:**
```javascript
energyHistory: []              // Last 43 energy readings
historySize: 43                // ~1 second at 60fps
beatThreshold: 1.3             // Energy must be 30% above average
minTimeBetweenBeats: 300       // Min 300ms (200 BPM max)
maxBeatHistory: 8              // Use last 8 beats for BPM
maxBPMHistory: 30              // Keep last 30 BPM readings for histogram
```

#### AudioPlayer Class

**Purpose:** Plays audio files for calibration mode

**Constructor:** `new AudioPlayer(audioContext)`

**Key Methods:**
- `load(url)` - Loads audio file from URL
- `play()` - Starts playback
- `pause()` - Pauses playback
- `stop()` - Stops and resets playback
- `getAnalyser()` - Returns AnalyserNode for analysis

### Visualizer.jsx - Real-time Canvas Visualizations

**Purpose:** Renders three canvas-based visualizations

**Canvases:**
1. **Waveform** - Time domain oscilloscope showing audio waveform
2. **Frequency Spectrum** - Frequency domain bars showing frequency content
3. **Note Circle** - Chromatic circle highlighting current note

**Animation Loop:**
- Uses `requestAnimationFrame` for smooth 60fps rendering
- Reads data from shared AnalyserNode
- Cleans up on unmount to prevent memory leaks

### AnalysisPanel.jsx - Histogram Visualizations

**Purpose:** Displays distribution analysis as bar charts

**Canvases:**
1. **Note Histogram** - Shows distribution of detected notes (12 chromatic notes)
2. **Key Histogram** - Shows vote distribution for keys (top 10)
3. **BPM Histogram** - Shows BPM distribution (top 10)

**Key Histogram Rendering (Fixed Oct 10, 2025):**
- Uses absolute scale (0-100%) instead of relative max
- Shows vote percentages from KeyDetector consensus tracking
- Highlights currently detected key in green
- This allows proper comparison between different key confidences

**Audio Parameters Display:**
- Sample Rate (from AudioContext)
- Buffer Size (FFT size)
- Analysis Window (duration in milliseconds)

---

## Analysis Controls (Sliders)

### Squelch Threshold (0-50%)
**Purpose:** Filter background noise by ignoring audio below volume threshold

**Implementation:**
- Calculates average frequency data as percentage
- Compares to threshold before running note detection
- Does NOT affect beat detection (runs independently)
- Default: 20%

**Code Location:** App.jsx line ~140-150

### Update Rate (5-60 Hz)
**Purpose:** Control how often detection runs (samples per second)

**Implementation:**
- Calculates minimum interval: `1000 / updateRate` milliseconds
- Uses `performance.now()` for accurate timing
- Throttles via `requestAnimationFrame` loop
- Default: 60 Hz

**Trade-offs:**
- Higher rate = more responsive, more CPU usage
- Lower rate = less CPU, smoother consensus tracking

### FFT Size (512-8192)
**Purpose:** Control frequency resolution vs time resolution

**Implementation:**
- Updates `analyser.fftSize` dynamically
- Calls `setFftSize()` on PitchDetector and BeatDetector
- Buffer length = fftSize / 2 (frequencyBinCount)

**Trade-offs:**
- Larger FFT = better frequency resolution, slower response
- Smaller FFT = faster response, less frequency precision
- Default: 2048 (good balance)

**Valid FFT Sizes:** Must be power of 2: 512, 1024, 2048, 4096, 8192

---

## Consensus vs Instantaneous Detection

**Design Philosophy:** Show both "what we see right now" and "what we think overall"

### Instantaneous Detection
- Current sample's detection result
- Changes rapidly with audio
- Good for real-time feedback
- Can be noisy/unstable

### Consensus Detection
- Most common detection over recent history
- Smooths out momentary variations
- More stable and reliable
- Represents "what key/BPM the song is in"

**Implementation:**
- Keys: Last 30 detections tracked in `keyVoteHistory`
- BPM: Last 30 readings tracked in `bpmHistory`
- Both display simultaneously in UI
- Histograms show vote distribution (buckets)

---

## Known Issues & Solutions

### Issue 1: Detection Getting Stuck (FIXED - Oct 10, 2025)
**Symptom:** Detection stops updating after first sample
**Cause:** Squelch check with early return blocked entire detection loop
**Solution:** Check squelch first, store boolean, make note detection conditional
**Files Changed:** `App.jsx` - Modified detectPitch() function

### Issue 2: Beat Detection Breaks on FFT Slider Adjustment (FIXED - Oct 10, 2025)
**Symptom:** Beat detection stops working when user changes FFT size
**Cause:** `BeatDetector.setFftSize()` was resetting all state including energyHistory, beatTimes, currentBPM
**Solution:** Created separate `initBeatParams()` for initialization, `setFftSize()` now only updates analyser
**Files Changed:** `audioUtils.js` - Modified BeatDetector class

### Issue 3: Key Histogram Shows All Equal Values (FIXED - Oct 10, 2025)
**Symptom:** Key histogram bars all appear same height despite different detections
**Cause 1:** Normalizing to max of top 10 makes similar values look identical
**Cause 2:** Showing instantaneous correlations instead of vote buckets
**Solution:** 
1. Changed histogram to show vote percentages (0-100% absolute scale)
2. Modified KeyDetector to return vote histogram instead of correlation histogram
**Files Changed:** `audioUtils.js` - Modified detectKey() to build voteHistogram
**Files Changed:** `AnalysisPanel.jsx` - Changed normalization to use 100 as max

### Issue 4: Confidence Values Over 100% (FIXED - Earlier)
**Symptom:** Beat and key confidence showing >100%
**Cause:** Correlation values not properly normalized
**Solution:** Added `Math.min(100, Math.max(0, confidence))` clamping and normalization
**Files Changed:** `audioUtils.js` - Multiple locations

---

## Calibration Tracks

11 CC0 (Creative Commons Zero) tracks included for testing:

### Full Tracks (tonescope_calibration_tracks/full/)
1. **Groovin** - G Major, 98 BPM, 4/4
2. **QuickMetalRiff1** - E Minor, 132 BPM, 4/4
3. **DowntownBoogie** - A Major, 115 BPM, 4/4
4. **Backbeat** - C Major, 104 BPM, 4/4
5. **BassForGambling** - D Minor, 90 BPM, 4/4

### Clips (tonescope_calibration_tracks/clips/)
- 30-second versions of above tracks for quick testing

### Metronome (tonescope_calibration_tracks/metronome/)
- **metronome_120bpm.mp3** - Clean 120 BPM clicks
- **metronome_120bpm_accent.mp3** - With accented beats
- **metronome_120bpm_tagged.mp3** - With metadata

**Source:** FreePD (https://freepd.com/)
**License:** CC0 - Public Domain

---

## Git Repository

**GitHub:** https://github.com/worldwidejimmy/tonescope
**Branch:** main
**Last Commit:** 95b62b3 (Oct 10, 2025)

### Recent Commits
- `95b62b3` - Fix key histogram vote buckets, BeatDetector state preservation
- `b933cdf` - Modified squelch logic (3rd iteration)
- Earlier - Added squelch/update rate/FFT sliders, consensus tracking, histograms

### Git Configuration
- `http.postBuffer` set to 524288000 (500MB) for large file push
- 12MB calibration tracks committed successfully

---

## Development Environment

**Node.js:** v19.6.0  
**Package Manager:** npm  
**OS:** macOS (zsh shell)  
**Dev Server:** Vite (HMR enabled)  
**Default Port:** 3000 (auto-increments if occupied)

### Scripts
```bash
npm install          # Install dependencies
npm run dev         # Start dev server (localhost:3000)
npm run build       # Build for production (outputs to dist/)
npm run preview     # Preview production build
```

### Dependencies
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

### Dev Dependencies
```json
{
  "@vitejs/plugin-react": "^4.3.4",
  "vite": "^5.4.20"
}
```

---

## Testing Recommendations

### For Pitch Detection
1. Use single-note instruments (flute, whistle, sine wave)
2. Hold notes steady for 1-2 seconds
3. Test across octaves (C3-C6)
4. Verify cents display (tuning accuracy)

### For Key Detection
1. Use calibration tracks with known keys
2. Play scales (C major scale, A minor scale)
3. Test modulation (key changes mid-song)
4. Verify consensus converges after 5-10 seconds

### For Beat Detection
1. Use metronome tracks (120 BPM reference)
2. Test various tempos (60-180 BPM)
3. Verify beat indicator pulses on beat
4. Check BPM histogram stabilizes

### Slider Testing
1. **Squelch:** Test with background noise, verify notes stop below threshold
2. **Update Rate:** Lower to 10 Hz, verify slower updates but less CPU
3. **FFT Size:** Change during detection, verify beat detection continues (Issue #2 fix)

---

## Browser Compatibility Notes

### Web Audio API Support
- Chrome/Edge: Full support ✓
- Firefox: Full support ✓
- Safari: Full support (iOS requires user gesture) ✓
- Opera: Full support ✓

### Microphone Access Requirements
- **localhost:** Works without HTTPS
- **Production:** Requires HTTPS
- **Permissions:** Must be granted by user

### Canvas API
- Universally supported across modern browsers

---

## Performance Considerations

### CPU Usage
- Detection loop runs at 60 Hz by default
- Each analysis involves:
  - FFT calculation (Web Audio API - optimized)
  - Autocorrelation (O(n²) but n=fftSize is manageable)
  - Key correlation (24 keys × 12 notes = 288 operations)
  - Canvas rendering (3 visualizations + 3 histograms)

### Memory Usage
- Audio buffers: fftSize × 2 (time + frequency data)
- Note history: 50 notes
- Key vote history: 30 detections
- Beat history: 43 energy values + 8 beat times + 30 BPM readings
- Total: ~5-10 KB for all analysis state

### Optimization Tips
1. Lower update rate slider for less CPU
2. Disable unused detection features
3. Smaller FFT size for faster processing
4. Consider using Web Workers for heavy computation (future enhancement)

---

## Future Enhancement Ideas

### Planned Features
- [ ] Chord detection (major, minor, diminished, augmented)
- [ ] Audio recording and playback
- [ ] Export detected data (JSON, MIDI, MusicXML)
- [ ] Visual tuner mode with needle display
- [ ] Multiple instrument profiles (guitar, piano, vocals)
- [ ] Harmonic analysis (overtone visualization)
- [ ] Time signature detection (3/4, 4/4, 6/8, etc.)
- [ ] Swing detection (triplet feel quantification)

### Technical Improvements
- [ ] Web Worker for analysis (offload from main thread)
- [ ] WebAssembly for autocorrelation (faster pitch detection)
- [ ] Machine learning for improved key detection
- [ ] Polyphonic pitch detection (multiple notes simultaneously)
- [ ] Adaptive thresholding for beat detection
- [ ] Onset detection (note attack timing)

---

## Debugging Tips for AI Agents

### Common Issues to Check

1. **Detection not working:**
   - Check microphone permissions
   - Verify `isListening` or `isCalibrationMode` is true
   - Check squelch threshold isn't too high
   - Verify analyser nodes are properly connected
   - Check console for Web Audio API errors

2. **Histogram not updating:**
   - Verify histogram data structure matches expected format
   - Check canvas refs are properly initialized
   - Verify useEffect dependencies include data props
   - Check for console errors in drawing functions

3. **Consensus not converging:**
   - Verify vote history arrays are properly managed
   - Check array lengths match maxHistory constants
   - Verify vote counting logic in rebuild sections

4. **FFT size changes breaking things:**
   - Verify setFftSize() only updates analyser settings
   - Check that state variables are NOT reset
   - Verify bufferLength and dataArray are updated

5. **Performance issues:**
   - Check update rate isn't too high
   - Verify no memory leaks (useEffect cleanup)
   - Check for unnecessary re-renders (React DevTools)
   - Profile with browser performance tools

### Key Files to Inspect
- `App.jsx` - Main detection loop and state management
- `audioUtils.js` - Core algorithms (likely source of logic bugs)
- `AnalysisPanel.jsx` - Histogram rendering issues
- Browser console - Web Audio API warnings/errors

### Testing Shortcuts
1. Start with calibration mode (known audio) before testing live
2. Use metronome tracks for beat detection (precise BPM)
3. Lower update rate to slow down for debugging
4. Add console.log statements in detection loop (temporarily)
5. Use React DevTools to inspect state values

---

## Code Style & Conventions

### React
- Functional components with hooks
- useRef for mutable instance variables
- useEffect for side effects and canvas drawing
- Props drilling (no context/redux needed for this size)

### JavaScript
- ES6+ syntax (arrow functions, destructuring, const/let)
- Async/await for audio loading
- requestAnimationFrame for animations
- Performance.now() for accurate timing

### CSS
- CSS custom properties for theming
- Flexbox for layout
- CSS Grid for histogram layouts
- Responsive design (mobile-friendly)
- Dark mode support

### Naming Conventions
- Components: PascalCase (App.jsx, Visualizer.jsx)
- Functions: camelCase (detectPitch, startListening)
- Constants: UPPER_CASE (rare in this codebase)
- Classes: PascalCase (PitchDetector, KeyDetector)
- CSS classes: kebab-case (detection-info, beat-indicator)

---

## License & Attribution

**ToneScope:** MIT License (Open Source)  
**Calibration Tracks:** CC0 (Public Domain) from FreePD  
**Algorithms:**
- Autocorrelation: Standard DSP technique
- Krumhansl-Schmuckler: Based on Carol Krumhansl's cognitive research (1990)
- Energy-based beat detection: Common music information retrieval technique

---

## Contact & Support

**GitHub Issues:** https://github.com/worldwidejimmy/tonescope/issues  
**Repository:** https://github.com/worldwidejimmy/tonescope

---

## Changelog

### v1.0.0 - October 11, 2025
- ✅ Real-time pitch, key, and beat detection
- ✅ Three canvas visualizations (waveform, spectrum, note circle)
- ✅ Three histogram displays (notes, keys, BPM)
- ✅ Calibration mode with 11 CC0 audio tracks
- ✅ Consensus tracking for key and BPM
- ✅ Three analysis control sliders (squelch, update rate, FFT size)
- ✅ Fixed key histogram to show vote buckets
- ✅ Fixed BeatDetector state preservation on FFT size change
- ✅ Fixed squelch logic to allow beat detection independently
- ✅ Mobile-responsive design with dark/light mode
- ✅ Individual feature toggles
- ✅ Audio parameters display

---

**End of Development Documentation**

This document should be consulted by AI agents at the start of future sessions to understand the complete project state, architecture, and recent fixes.
