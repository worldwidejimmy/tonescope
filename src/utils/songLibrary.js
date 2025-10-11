// Calibration song library
// All tracks are CC0/Public Domain from FreePD.com
// Metadata based on tonescope_calibration_tracks/README.txt

export const calibrationSongs = [
  {
    id: 'metronome-120bpm',
    name: 'Metronome 120 BPM',
    filename: '../tonescope_calibration_tracks/metronome/metronome_120bpm.mp3',
    description: 'Pure 120 BPM metronome for beat detection testing',
    expectedKey: null,
    bpm: 120,
    timeSignature: '4/4'
  },
  {
    id: 'groovin',
    name: 'Groovin (Clip)',
    filename: '../tonescope_calibration_tracks/clips/Groovin_clip.mp3',
    description: 'G major groove at 98 BPM',
    expectedKey: 'G major',
    bpm: 98,
    timeSignature: '4/4'
  },
  {
    id: 'quick-metal-riff',
    name: 'Quick Metal Riff (Clip)',
    filename: '../tonescope_calibration_tracks/clips/QuickMetalRiff1_clip.mp3',
    description: 'E minor metal riff at 132 BPM',
    expectedKey: 'E minor',
    bpm: 132,
    timeSignature: '4/4'
  },
  {
    id: 'downtown-boogie',
    name: 'Downtown Boogie (Clip)',
    filename: '../tonescope_calibration_tracks/clips/DowntownBoogie_clip.mp3',
    description: 'A major boogie at 115 BPM',
    expectedKey: 'A major',
    bpm: 115,
    timeSignature: '4/4'
  },
  {
    id: 'backbeat',
    name: 'Backbeat (Clip)',
    filename: '../tonescope_calibration_tracks/clips/Backbeat_clip.mp3',
    description: 'C major backbeat at 104 BPM',
    expectedKey: 'C major',
    bpm: 104,
    timeSignature: '4/4'
  },
  {
    id: 'bass-for-gambling',
    name: 'Bass For Gambling (Clip)',
    filename: '../tonescope_calibration_tracks/clips/BassForGambling_clip.mp3',
    description: 'D minor bass groove at 90 BPM',
    expectedKey: 'D minor',
    bpm: 90,
    timeSignature: '4/4'
  },
  // Full-length tracks
  {
    id: 'groovin-full',
    name: 'Groovin (Full)',
    filename: '../tonescope_calibration_tracks/full/Groovin.mp3',
    description: 'G major groove (full track)',
    expectedKey: 'G major',
    bpm: 98,
    timeSignature: '4/4'
  },
  {
    id: 'quick-metal-riff-full',
    name: 'Quick Metal Riff (Full)',
    filename: '../tonescope_calibration_tracks/full/QuickMetalRiff1.mp3',
    description: 'E minor metal riff (full track)',
    expectedKey: 'E minor',
    bpm: 132,
    timeSignature: '4/4'
  },
  {
    id: 'downtown-boogie-full',
    name: 'Downtown Boogie (Full)',
    filename: '../tonescope_calibration_tracks/full/DowntownBoogie.mp3',
    description: 'A major boogie (full track)',
    expectedKey: 'A major',
    bpm: 115,
    timeSignature: '4/4'
  },
  {
    id: 'backbeat-full',
    name: 'Backbeat (Full)',
    filename: '../tonescope_calibration_tracks/full/Backbeat.mp3',
    description: 'C major backbeat (full track)',
    expectedKey: 'C major',
    bpm: 104,
    timeSignature: '4/4'
  },
  {
    id: 'bass-for-gambling-full',
    name: 'Bass For Gambling (Full)',
    filename: '../tonescope_calibration_tracks/full/BassForGambling.mp3',
    description: 'D minor bass groove (full track)',
    expectedKey: 'D minor',
    bpm: 90,
    timeSignature: '4/4'
  }
];

// Helper to get audio file URL
export function getAudioUrl(filename) {
  return `/${filename}`;
}
