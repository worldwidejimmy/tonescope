// Calibration song library
// Add your audio files to public/audio/ and list them here

export const calibrationSongs = [
  {
    id: 'c-major-scale',
    name: 'C Major Scale',
    filename: 'c-major-scale.mp3',
    description: 'Simple C major scale for note detection testing',
    expectedNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'],
    bpm: null
  },
  // Add more songs here as you add audio files
  // Example:
  // {
  //   id: 'test-120bpm',
  //   name: '120 BPM Test Track',
  //   filename: '120bpm-test.mp3',
  //   description: 'Test track with 120 BPM for beat detection',
  //   expectedNotes: null,
  //   bpm: 120
  // }
];

// Helper to get audio file URL
export function getAudioUrl(filename) {
  return `/audio/${filename}`;
}
