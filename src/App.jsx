import { useState, useRef, useEffect } from 'react'
import { PitchDetector, frequencyToNote, KeyDetector, BeatDetector, AudioPlayer } from './utils/audioUtils'
import { calibrationSongs, getAudioUrl } from './utils/songLibrary'
import Visualizer from './Visualizer'
import AnalysisPanel from './AnalysisPanel'
import './App.css'

function App() {
  const [isListening, setIsListening] = useState(false)
  const [currentNote, setCurrentNote] = useState(null)
  const [detectedKey, setDetectedKey] = useState({ key: 'Not detected', confidence: 0 })
  const [error, setError] = useState(null)
  const [noteHistory, setNoteHistory] = useState([])
  const [noteHistogram, setNoteHistogram] = useState({}) // Track note counts
  
  // Individual feature toggles - all enabled by default
  const [noteDetectionEnabled, setNoteDetectionEnabled] = useState(true)
  const [keyDetectionEnabled, setKeyDetectionEnabled] = useState(true)
  const [beatDetectionEnabled, setBeatDetectionEnabled] = useState(true)
  
  // Beat detection state
  const [beatInfo, setBeatInfo] = useState({ bpm: 0, confidence: 0 })
  const [isBeat, setIsBeat] = useState(false)

  // Analysis controls
  const [squelchThreshold, setSquelchThreshold] = useState(20) // 0-100 scale
  const [updateRate, setUpdateRate] = useState(60) // Updates per second (10-60)
  const [fftSize, setFftSize] = useState(2048) // FFT size: 512, 1024, 2048, 4096, 8192

  // Calibration mode state
  const [calibrationMode, setCalibrationMode] = useState(false)
  const [selectedSong, setSelectedSong] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [loadingAudio, setLoadingAudio] = useState(false)

  const audioContextRef = useRef(null)
  const pitchDetectorRef = useRef(null)
  const keyDetectorRef = useRef(null)
  const beatDetectorRef = useRef(null)
  const audioPlayerRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)
  const lastUpdateTimeRef = useRef(0)

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopListening()
    }
  }, [])

  const startListening = async () => {
    try {
      setError(null)

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioContext

      // Create pitch detector
      const pitchDetector = new PitchDetector(audioContext, fftSize)
      pitchDetectorRef.current = pitchDetector

      // Create key detector
      const keyDetector = new KeyDetector()
      keyDetectorRef.current = keyDetector

      // Create beat detector
      const beatDetector = new BeatDetector(audioContext, fftSize)
      beatDetectorRef.current = beatDetector

      // Connect microphone to analyzers
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(pitchDetector.getAnalyser())
      source.connect(beatDetector.getAnalyser())

      setIsListening(true)

      // Start detection loop
      detectPitch()
    } catch (err) {
      console.error('Error accessing microphone:', err)
      setError('Could not access microphone. Please grant permission.')
    }
  }

  const stopListening = () => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsListening(false)
    setCurrentNote(null)
  }

  const detectPitch = () => {
    if (!pitchDetectorRef.current || !keyDetectorRef.current) return

    // Throttle update rate
    const now = performance.now();
    const minInterval = 1000 / updateRate; // Convert updates/sec to ms between updates
    
    if (now - lastUpdateTimeRef.current < minInterval) {
      animationFrameRef.current = requestAnimationFrame(detectPitch);
      return;
    }
    lastUpdateTimeRef.current = now;

    // Note detection (if enabled)
    if (noteDetectionEnabled) {
      const frequency = pitchDetectorRef.current.detectPitch()
      
      if (frequency > 0) {
        // Check volume level (squelch) - only if we detected a frequency
        const analyser = pitchDetectorRef.current.getAnalyser();
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const averageVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const volumePercent = (averageVolume / 255) * 100;
        
        // Skip processing if below squelch threshold
        if (volumePercent < squelchThreshold) {
          animationFrameRef.current = requestAnimationFrame(detectPitch);
          return;
        }
        
        const noteInfo = frequencyToNote(frequency)
        if (noteInfo) {
          setCurrentNote(noteInfo)
          
          // Update note histogram
          setNoteHistogram(prev => {
            const newHistogram = { ...prev };
            newHistogram[noteInfo.noteName] = (newHistogram[noteInfo.noteName] || 0) + 1;
            return newHistogram;
          });
          
          // Add to note history display (keep for backwards compatibility)
          setNoteHistory(prev => {
            const newHistory = [...prev, noteInfo.note]
            return newHistory.slice(-10) // Keep last 10 notes
          })

          // Add to key detector (if key detection is enabled)
          if (keyDetectionEnabled) {
            keyDetectorRef.current.addNote(noteInfo.noteName)
            
            // Update detected key
            const key = keyDetectorRef.current.detectKey()
            setDetectedKey(key)
          }
        }
      }
    }

    // Beat detection (if enabled)
    if (beatDetectionEnabled && beatDetectorRef.current) {
      const beatResult = beatDetectorRef.current.detectBeat()
      
      if (beatResult.isBeat) {
        setIsBeat(true)
        // Clear beat indicator after brief moment
        setTimeout(() => setIsBeat(false), 100)
      }
      
      if (beatResult.bpm > 0) {
        setBeatInfo({
          bpm: beatResult.bpm,
          confidence: beatResult.confidence,
          consensusBPM: beatResult.consensusBPM,
          consensusConfidence: beatResult.consensusConfidence,
          histogram: beatResult.histogram
        })
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectPitch)
  }

  const resetDetection = () => {
    if (keyDetectorRef.current) {
      keyDetectorRef.current.clear()
    }
    if (beatDetectorRef.current) {
      beatDetectorRef.current.reset()
    }
    setNoteHistory([])
    setNoteHistogram({})
    setDetectedKey({ key: 'Not detected', confidence: 0 })
    setBeatInfo({ bpm: 0, confidence: 0 })
  }

  const toggleNoteDetection = () => {
    setNoteDetectionEnabled(prev => !prev)
    if (!noteDetectionEnabled) {
      setCurrentNote(null)
      setNoteHistory([])
    }
  }

  const toggleKeyDetection = () => {
    setKeyDetectionEnabled(prev => !prev)
    if (keyDetectorRef.current && !keyDetectionEnabled) {
      keyDetectorRef.current.clear()
      setDetectedKey({ key: 'Not detected', confidence: 0 })
    }
  }

  const toggleBeatDetection = () => {
    setBeatDetectionEnabled(prev => !prev)
    if (beatDetectorRef.current && !beatDetectionEnabled) {
      beatDetectorRef.current.reset()
      setBeatInfo({ bpm: 0, confidence: 0 })
      setIsBeat(false)
    }
  }

  const handleFftSizeChange = (newSize) => {
    setFftSize(newSize)
    // Update existing analyzers if they exist
    if (pitchDetectorRef.current) {
      pitchDetectorRef.current.setFftSize(newSize)
    }
    if (beatDetectorRef.current) {
      beatDetectorRef.current.setFftSize(newSize)
    }
  }

  // Calibration mode functions
  const startCalibrationMode = async () => {
    if (!selectedSong) {
      setError('Please select a song first')
      return
    }

    try {
      setError(null)
      setLoadingAudio(true)

      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }

      // Create detectors
      const pitchDetector = new PitchDetector(audioContextRef.current)
      pitchDetectorRef.current = pitchDetector

      const keyDetector = new KeyDetector()
      keyDetectorRef.current = keyDetector

      const beatDetector = new BeatDetector(audioContextRef.current)
      beatDetectorRef.current = beatDetector

      // Create and load audio player
      const audioPlayer = new AudioPlayer(audioContextRef.current)
      audioPlayerRef.current = audioPlayer

      const song = calibrationSongs.find(s => s.id === selectedSong)
      await audioPlayer.loadAudio(getAudioUrl(song.filename))

      // Connect audio player to all analyzers
      audioPlayer.connectToAnalyser(pitchDetector.getAnalyser())
      pitchDetector.getAnalyser().connect(beatDetector.getAnalyser())

      setCalibrationMode(true)
      setIsListening(true)
      setLoadingAudio(false)

      // Start detection loop
      detectPitch()
    } catch (err) {
      console.error('Error loading audio:', err)
      setError(`Could not load audio file. Make sure the file exists in public/audio/`)
      setLoadingAudio(false)
    }
  }

  const stopCalibrationMode = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.cleanup()
      audioPlayerRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setCalibrationMode(false)
    setIsListening(false)
    setIsPlaying(false)
    setCurrentNote(null)
  }

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return

    if (isPlaying) {
      audioPlayerRef.current.pause()
      setIsPlaying(false)
    } else {
      audioPlayerRef.current.play()
      setIsPlaying(true)
    }
  }

  const stopPlayback = () => {
    if (!audioPlayerRef.current) return

    audioPlayerRef.current.stop()
    setIsPlaying(false)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎵 ToneScope</h1>
        <p className="subtitle">Real-Time Music Note & Key Detection</p>
      </header>

      <main className="main">
        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        <div className="controls">
          {!isListening ? (
            <>
              <button className="btn btn-primary" onClick={startListening}>
                🎤 Start Listening
              </button>
              <div className="calibration-divider">or</div>
              <button 
                className="btn btn-calibrate" 
                onClick={() => setError(null)}
                disabled={calibrationSongs.length === 0}
              >
                🎵 Calibration Mode
              </button>
            </>
          ) : calibrationMode ? (
            <>
              <button className="btn btn-danger" onClick={stopCalibrationMode}>
                ⏹️ Stop Calibration
              </button>
              <button 
                className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
                onClick={togglePlayback}
              >
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
              <button className="btn btn-secondary" onClick={stopPlayback}>
                ⏹️ Stop
              </button>
              <button className="btn btn-secondary" onClick={resetDetection}>
                🔄 Reset
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-danger" onClick={stopListening}>
                ⏹️ Stop Listening
              </button>
              <button className="btn btn-secondary" onClick={resetDetection}>
                🔄 Reset All
              </button>
            </>
          )}
        </div>

        {isListening && (
          <div className="analysis-controls">
            <h3>Analysis Settings</h3>
            <div className="slider-controls">
              <div className="slider-control">
                <label>
                  <span className="slider-label">Squelch Threshold</span>
                  <span className="slider-value">{squelchThreshold}%</span>
                </label>
                <input 
                  type="range"
                  min="0"
                  max="50"
                  value={squelchThreshold}
                  onChange={(e) => setSquelchThreshold(Number(e.target.value))}
                  className="slider"
                />
                <p className="slider-description">Minimum volume to detect notes (filters background noise)</p>
              </div>
              
              <div className="slider-control">
                <label>
                  <span className="slider-label">Update Rate</span>
                  <span className="slider-value">{updateRate} Hz</span>
                </label>
                <input 
                  type="range"
                  min="5"
                  max="60"
                  value={updateRate}
                  onChange={(e) => setUpdateRate(Number(e.target.value))}
                  className="slider"
                />
                <p className="slider-description">How often to analyze audio (lower = less CPU, slower response)</p>
              </div>
              
              <div className="slider-control">
                <label>
                  <span className="slider-label">FFT Size (Sample Window)</span>
                  <span className="slider-value">{fftSize}</span>
                </label>
                <input 
                  type="range"
                  min="512"
                  max="8192"
                  step="512"
                  value={fftSize}
                  onChange={(e) => handleFftSizeChange(Number(e.target.value))}
                  className="slider"
                />
                <p className="slider-description">Audio analysis window size (larger = better low freq, slower response)</p>
              </div>
            </div>
          </div>
        )}

        {!isListening && !calibrationMode && (
          <div className="calibration-panel">
            <h3>🎵 Calibration Mode</h3>
            <p>Test ToneScope with known audio files</p>
            {calibrationSongs.length > 0 ? (
              <>
                <select 
                  className="song-select"
                  value={selectedSong}
                  onChange={(e) => setSelectedSong(e.target.value)}
                >
                  <option value="">Select a calibration song...</option>
                  {calibrationSongs.map(song => (
                    <option key={song.id} value={song.id}>
                      {song.name}
                      {song.bpm && ` (${song.bpm} BPM)`}
                    </option>
                  ))}
                </select>
                {selectedSong && (
                  <div className="song-info">
                    <p>{calibrationSongs.find(s => s.id === selectedSong)?.description}</p>
                  </div>
                )}
                <button 
                  className="btn btn-primary"
                  onClick={startCalibrationMode}
                  disabled={!selectedSong || loadingAudio}
                >
                  {loadingAudio ? '⏳ Loading...' : '🎵 Start Calibration'}
                </button>
              </>
            ) : (
              <div className="no-songs">
                <p>No calibration songs available.</p>
                <p>Add MP3 files to <code>public/audio/</code> and update <code>src/utils/songLibrary.js</code></p>
              </div>
            )}
          </div>
        )}

        <div className="display-container">
          <div className="feature-panel">
            <div className="feature-header">
              <h2>Current Note</h2>
              {isListening && (
                <button 
                  className={`btn-feature-toggle ${noteDetectionEnabled ? 'active' : ''}`}
                  onClick={toggleNoteDetection}
                >
                  {noteDetectionEnabled ? '✓ ON' : '✗ OFF'}
                </button>
              )}
            </div>
            <div className={`note-display ${!noteDetectionEnabled ? 'disabled' : ''}`}>
              {noteDetectionEnabled && currentNote ? (
                <div className="note-info">
                  <div className="note-large">{currentNote.note}</div>
                  <div className="frequency">{currentNote.frequency} Hz</div>
                  <div className="cents">
                    {currentNote.cents > 0 ? '+' : ''}{currentNote.cents} cents
                  </div>
                </div>
              ) : (
                <div className="note-placeholder">
                  {!isListening ? 'Not listening' : !noteDetectionEnabled ? 'Disabled' : 'Listening...'}
                </div>
              )}
            </div>
          </div>

          <div className="feature-panel">
            <div className="feature-header">
              <h2>Detected Key</h2>
              {isListening && (
                <button 
                  className={`btn-feature-toggle ${keyDetectionEnabled ? 'active' : ''}`}
                  onClick={toggleKeyDetection}
                >
                  {keyDetectionEnabled ? '✓ ON' : '✗ OFF'}
                </button>
              )}
            </div>
            <div className={`key-display ${!keyDetectionEnabled ? 'disabled' : ''}`}>
              <div className="key-info">
                <div className="key-large">
                  {keyDetectionEnabled ? (detectedKey.consensusKey || detectedKey.key) : 'Disabled'}
                </div>
                {keyDetectionEnabled && detectedKey.consensusConfidence > 0 && (
                  <div className="confidence">
                    Consensus: {detectedKey.consensusConfidence}%
                  </div>
                )}
                {keyDetectionEnabled && detectedKey.confidence > 0 && (
                  <div className="confidence" style={{fontSize: '0.85rem', opacity: 0.7}}>
                    Current: {detectedKey.key} ({detectedKey.confidence}%)
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="feature-panel">
            <div className="feature-header">
              <h2>Beat Detection</h2>
              {isListening && (
                <button 
                  className={`btn-feature-toggle ${beatDetectionEnabled ? 'active' : ''}`}
                  onClick={toggleBeatDetection}
                >
                  {beatDetectionEnabled ? '✓ ON' : '✗ OFF'}
                </button>
              )}
            </div>
            <div className={`beat-display ${isBeat && beatDetectionEnabled ? 'pulse' : ''} ${!beatDetectionEnabled ? 'disabled' : ''}`}>
              {beatDetectionEnabled ? (
                <div className="beat-info">
                  <div className="beat-indicator">
                    {isBeat ? '🔴' : '⚪'}
                  </div>
                  <div className="bpm-large">{beatInfo.consensusBPM || beatInfo.bpm || '--'}</div>
                  <div className="bpm-label">BPM</div>
                  {beatInfo.consensusConfidence > 0 && (
                    <div className="confidence">
                      Consensus: {beatInfo.consensusConfidence}%
                    </div>
                  )}
                  {beatInfo.bpm > 0 && (
                    <div className="confidence" style={{fontSize: '0.85rem', opacity: 0.7}}>
                      Current: {beatInfo.bpm} BPM ({beatInfo.confidence}%)
                    </div>
                  )}
                </div>
              ) : (
                <div className="note-placeholder">
                  {!isListening ? 'Not listening' : 'Disabled'}
                </div>
              )}
            </div>
          </div>
        </div>

        {isListening && pitchDetectorRef.current && (
          <Visualizer 
            analyser={pitchDetectorRef.current.getAnalyser()} 
            currentNote={currentNote?.note}
            isActive={isListening}
          />
        )}

        {isListening && (
          <AnalysisPanel 
            keyData={detectedKey}
            beatData={beatInfo}
            noteHistogram={noteHistogram}
            audioContext={audioContextRef.current}
            fftSize={fftSize}
          />
        )}

        {noteHistory.length > 0 && (
          <div className="note-history">
            <h3>Recent Notes</h3>
            <div className="history-list">
              {noteHistory.map((note, index) => (
                <span key={index} className="history-note">
                  {note}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="info">
          <h3>How to use:</h3>
          <ol>
            <li>Click "Start Listening" and allow microphone access</li>
            <li>Play or sing some music</li>
            <li>Watch as ToneScope detects notes in real-time</li>
            <li>After several notes, the musical key will be detected</li>
          </ol>
        </div>
      </main>

      <footer className="footer">
        <p>Built with Web Audio API | Open Source</p>
      </footer>
    </div>
  )
}

export default App
