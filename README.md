# ToneScope 🎵

Real-time music note and key detection web application built with React.js and the Web Audio API.

## Features

- 🎤 **Real-time pitch detection** - Detects musical notes as you play or sing
- 🎹 **Musical key detection** - Analyzes note patterns to determine the musical key
- 📊 **Visual feedback** - Shows current note, frequency, and tuning accuracy (cents)
- 📜 **Note history** - Displays recent notes detected
- 🎨 **Modern UI** - Beautiful gradient design with dark/light mode support
- 🌐 **Browser-based** - No installation required, runs entirely in the browser

## How It Works

ToneScope uses the Web Audio API to:
1. Access your microphone
2. Analyze audio in real-time using autocorrelation for pitch detection
3. Convert frequencies to musical notes
4. Apply the Krumhansl-Schmuckler key-finding algorithm to detect the musical key

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

## Future Enhancements

- [ ] Chord detection
- [ ] Audio recording and playback
- [ ] Sheet music generation
- [ ] MIDI export
- [ ] Multiple instrument profiles
- [ ] Tuner mode with better visualization

---

Built with ❤️ using open source technologies
