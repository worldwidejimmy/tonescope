# ToneScope - AI Agent Instructions

## Project Overview
Real-time music analysis web app using React 18.3 + Vite 5.4 + Web Audio API. Detects musical notes (pitch), keys (Krumhansl-Schmuckler), and beats (BPM) from microphone or audio files.

## Architecture & Data Flow

### Component Hierarchy
```
App.jsx (643 lines) - State management, detection loop, user controls
├── Visualizer.jsx - 3 canvas visualizations (waveform, spectrum, note circle)
└── AnalysisPanel.jsx - 3 histogram canvases (notes, keys, BPM)
```

### Core Detection Loop (App.jsx `detectPitch()`)
1. **Throttle** based on `updateRate` slider (5-60 Hz)
2. **Check squelch** - Calculate volume, store `isAboveSquelch` boolean
3. **Note detection** - Runs IF `noteDetectionEnabled` AND `isAboveSquelch`
   - PitchDetector.detectPitch() → frequency
   - frequencyToNote() → note object
   - Update noteHistogram
   - KeyDetector.detectKey() (uses last 50 notes)
4. **Beat detection** - Runs IF `beatDetectionEnabled` (independent of squelch)
   - BeatDetector.detectBeat() → BPM
5. **Schedule next frame** with requestAnimationFrame

**Critical:** Squelch only blocks note/key detection, NOT beat detection. This prevents silence from stopping rhythm analysis.

### Analysis Classes (audioUtils.js)

#### PitchDetector
- **Algorithm:** Autocorrelation on time-domain data
- **Dynamic FFT:** Call `setFftSize(size)` to adjust resolution on the fly
- Returns frequency in Hz, filtered by RMS threshold (0.01)

#### KeyDetector
- **Algorithm:** Krumhansl-Schmuckler correlation with major/minor profiles
- **Consensus tracking:** Maintains `keyVoteHistory` (last 30 detections)
- **Returns:** Both instantaneous (`key`) and consensus (`consensusKey`) with separate confidences
- **Histogram:** Shows vote percentages (0-100%), NOT correlation values

#### BeatDetector
- **Algorithm:** Energy-based on bass frequencies (first 10% of spectrum)
- **Beat trigger:** Energy > average × 1.3, minimum 300ms apart
- **BPM:** Calculated from last 8 beat intervals
- **CRITICAL:** `setFftSize()` must NOT reset state (energyHistory, beatTimes, currentBPM)
  - Separate `initBeatParams()` for initialization
  - `setFftSize()` only updates analyser settings

## Critical Patterns & Conventions

### State Management Philosophy
- **Instantaneous** values show current detection (responsive, noisy)
- **Consensus** values show most-voted result over time (stable, reliable)
- Display both simultaneously - users need real-time feedback AND stable analysis

### Audio Context Lifecycle
- Created in `startListening()` or `startCalibrationMode()`
- Shared AnalyserNode used for both detection AND visualization
- Must call `.close()` on cleanup to prevent memory leaks
- Use refs for all Web Audio API objects (audioContextRef, pitchDetectorRef, etc.)

### Canvas Rendering
- All visualizations use `requestAnimationFrame` loops
- Canvas sizes set from `offsetWidth/offsetHeight` (responsive)
- Clear previous frame with `fillStyle = 'rgba(0, 0, 0, 0.1)'` for trails
- Cancel animation frames in cleanup to prevent orphaned loops

### Calibration Mode
- Audio files loaded via AudioPlayer class
- Paths relative to `public/`: `../tonescope_calibration_tracks/clips/...`
- songLibrary.js defines metadata (expectedKey, bpm, timeSignature)
- 11 CC0 tracks included for testing known keys/BPM

## Common Pitfalls (Recently Fixed)

### Don't Reset State in Dynamic Updates
❌ **Wrong:** `setFftSize()` calls `initBeatParams()` → clears energyHistory  
✅ **Right:** `setFftSize()` only updates analyser, preserves detection state

### Squelch Must Not Block Beat Detection
❌ **Wrong:** `if (!isAboveSquelch) return` blocks entire loop  
✅ **Right:** Store `isAboveSquelch`, make note detection conditional

### Histograms Need Absolute Scaling
❌ **Wrong:** Normalize to max of visible data → similar values look identical  
✅ **Right:** Use absolute 0-100% scale for vote percentages

### Consensus Uses Vote Buckets, Not Correlations
❌ **Wrong:** Histogram shows instantaneous correlation values  
✅ **Right:** Histogram shows vote counts from history tracking

## Development Workflows

### Local Development
```bash
npm run dev    # Vite dev server on http://localhost:3000
npm run build  # Production build to dist/
npm run preview # Preview production build
```

### Testing Detection Accuracy
1. Enter calibration mode
2. Select track from songLibrary (e.g., "Groovin (Clip)" - G Major, 98 BPM)
3. Adjust squelch/update rate/FFT sliders
4. Compare detected key/BPM to expected values in songLibrary.js

### Adjusting Detection Parameters
- **Squelch (0-50%):** Increase to filter noise, decrease for quiet sources
- **Update Rate (5-60 Hz):** Higher = responsive, lower = stable consensus
- **FFT Size (512-8192):** Larger = frequency precision, smaller = time precision

## Key Files Reference
- `App.jsx` - Detection loop (line ~130-200), state management, slider handlers
- `audioUtils.js` - All detection algorithms, setFftSize() methods
- `songLibrary.js` - Calibration track metadata for testing
- `DEVELOPMENT.md` - Comprehensive technical documentation (643 lines)
- `vite.config.js` - Dev server on port 3000

## Styling Patterns
- Gradient backgrounds: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- Dark theme defaults, uses CSS custom properties
- Responsive grid layouts with `display: grid` and `grid-template-columns`
- Slider inputs styled with `::-webkit-slider-thumb` pseudo-elements
