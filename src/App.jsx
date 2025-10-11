import { useState, useRef, useEffect } from 'react'
import { PitchDetector, frequencyToNote, KeyDetector, BeatDetector } from './utils/audioUtils'
import './App.css'

function App() {
  const [isListening, setIsListening] = useState(false)
  const [currentNote, setCurrentNote] = useState(null)
  const [detectedKey, setDetectedKey] = useState({ key: 'Not detected', confidence: 0 })
  const [error, setError] = useState(null)
  const [noteHistory, setNoteHistory] = useState([])
  
  // Individual feature toggles - all enabled by default
  const [noteDetectionEnabled, setNoteDetectionEnabled] = useState(true)
  const [keyDetectionEnabled, setKeyDetectionEnabled] = useState(true)
  const [beatDetectionEnabled, setBeatDetectionEnabled] = useState(true)
  
  // Beat detection state
  const [beatInfo, setBeatInfo] = useState({ bpm: 0, confidence: 0 })
  const [isBeat, setIsBeat] = useState(false)

  const audioContextRef = useRef(null)
  const pitchDetectorRef = useRef(null)
  const keyDetectorRef = useRef(null)
  const beatDetectorRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)

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
      const pitchDetector = new PitchDetector(audioContext)
      pitchDetectorRef.current = pitchDetector

      // Create key detector
      const keyDetector = new KeyDetector()
      keyDetectorRef.current = keyDetector

      // Create beat detector
      const beatDetector = new BeatDetector(audioContext)
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

    // Note detection (if enabled)
    if (noteDetectionEnabled) {
      const frequency = pitchDetectorRef.current.detectPitch()
      
      if (frequency > 0) {
        const noteInfo = frequencyToNote(frequency)
        if (noteInfo) {
          setCurrentNote(noteInfo)
          
          // Add to note history display
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
          confidence: beatResult.confidence
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
            <button className="btn btn-primary" onClick={startListening}>
              🎤 Start Listening
            </button>
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
                  {keyDetectionEnabled ? detectedKey.key : 'Disabled'}
                </div>
                {keyDetectionEnabled && detectedKey.confidence > 0 && (
                  <div className="confidence">
                    Confidence: {detectedKey.confidence}%
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
                  <div className="bpm-large">{beatInfo.bpm > 0 ? beatInfo.bpm : '--'}</div>
                  <div className="bpm-label">BPM</div>
                  {beatInfo.confidence > 0 && (
                    <div className="confidence">
                      Confidence: {beatInfo.confidence}%
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
