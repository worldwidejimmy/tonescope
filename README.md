# ToneScope 🎵

Real-time music note and key detection web application built with React.js and the Web Audio API.

## Features

- 🎤 **Real-time pitch detection** - Detects musical notes as you play or sing
- 🎹 **Musical key detection** - Analyzes note patterns to determine the musical key using Krumhansl-Schmuckler algorithm
- 🥁 **Beat detection & BPM** - Detects beats and calculates tempo in real-time using energy-based analysis
- 🎵 **Calibration mode** - Test with 11 included CC0 audio tracks for accurate testing
- 📊 **Visual feedback** - Three real-time visualizations: waveform, frequency spectrum, and chromatic note circle
- 📈 **Histogram analysis** - Vote bucket displays showing distribution of notes, keys, and BPM over time
- 🎯 **Consensus tracking** - Shows both instantaneous detection and most-voted results for stability
- 🎛️ **Analysis controls** - Adjustable squelch threshold, update rate, and FFT size sliders
- 💓 **Pulsing beat indicator** - Visual pulse animation synchronized with detected beats
- 📜 **Note history** - Displays recent notes detected with musical notation
- 🎛️ **Individual feature toggles** - Enable/disable note, key, or beat detection independently
- 🎨 **Modern UI** - Beautiful gradient design with dark/light mode support and mobile-responsive layout
- 🌐 **Browser-based** - No installation required, runs entirely in the browser using Web Audio API

## How It Works

ToneScope uses the Web Audio API to:
1. Access your microphone
2. Analyze audio in real-time using autocorrelation for pitch detection
3. Convert frequencies to musical notes
4. Apply the Krumhansl-Schmuckler key-finding algorithm to detect the musical key
5. Use energy-based beat detection to identify rhythmic patterns and calculate BPM

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development

The app will run on `http://localhost:3000` by default.

## Calibration Mode

Test ToneScope with audio files for accurate calibration:

1. **Add audio files** - Place MP3 files in `public/audio/`
2. **Update song library** - Add song entries to `src/utils/songLibrary.js`
3. **Start calibration** - Click "Calibration Mode" and select a song

### Finding Public Domain Audio

- **Musopen** - https://musopen.org/music/ (Classical music)
- **FreePD** - https://freepd.com/ (Various genres)
- **Internet Archive** - https://archive.org/details/audio

### Recommended Test Files

- C major scale exercises
- Simple melodies (Twinkle Twinkle, Mary Had a Little Lamb)
- Known BPM tracks for beat detection testing

### Production Build

```bash
npm run build
```

This creates a `dist/` folder with optimized static files ready for deployment.

## Deployment to Linux Server

The built files are static HTML/CSS/JS and can be served by any web server:

### Option 1: Using nginx

```bash
# Copy built files to nginx
cp -r dist/* /var/www/html/tonescope/

# Configure nginx
sudo nano /etc/nginx/sites-available/tonescope
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html/tonescope;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Option 2: Using Node.js + serve

```bash
npm install -g serve
serve -s dist -p 3000
```

### Option 3: Using Apache

```bash
cp -r dist/* /var/www/html/tonescope/
```

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

**Note:** Requires HTTPS for microphone access (except on localhost).

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Web Audio API** - Audio capture and analysis
- **Autocorrelation** - Pitch detection algorithm
- **Krumhansl-Schmuckler** - Key detection algorithm

## License

Open Source - MIT License

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## Troubleshooting

### Microphone not working
- Ensure you've granted microphone permissions in your browser
- Check that your microphone is not being used by another application
- Try using HTTPS (required for non-localhost domains)

### Notes not detected
- Ensure the audio is loud enough
- Speak/sing/play clearly and hold notes steady
- Check your microphone settings

## Analysis Controls

ToneScope provides three adjustable sliders to fine-tune detection:

### Squelch Threshold (0-50%)
Filters out background noise by ignoring audio below a volume threshold. Increase if picking up unwanted ambient sound. Note: Beat detection continues independently of squelch.

### Update Rate (5-60 Hz)
Controls how often detection runs (samples per second). Higher = more responsive, lower = smoother consensus and less CPU usage.

### FFT Size (512-8192)
Controls frequency resolution vs time resolution. Larger = better frequency precision but slower response, smaller = faster response but less precision.

## Understanding the Display

### Instantaneous vs Consensus
- **Instantaneous:** What's detected in the current sample (changes rapidly)
- **Consensus:** Most common detection over recent history (stable, reliable)

### Histograms (Vote Buckets)
- **Note Histogram:** Distribution of detected notes over recent samples
- **Key Histogram:** Vote percentages for detected keys (shows which keys appear most often)
- **BPM Histogram:** Distribution of detected tempos

## Technical Details

For detailed technical documentation, architecture information, and development notes, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Future Enhancements

- [ ] Chord detection (major, minor, diminished, augmented)
- [ ] Audio recording and playback
- [ ] Sheet music generation
- [ ] MIDI export
- [ ] Multiple instrument profiles (guitar, piano, vocals)
- [ ] Tuner mode with needle visualization
- [ ] Harmonic analysis and overtone visualization
- [ ] Time signature detection

---

Built with ❤️ using open source technologies

**See [DEVELOPMENT.md](DEVELOPMENT.md) for complete technical documentation.**
