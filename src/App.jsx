import { useState, useRef, useEffect } from 'react'
import { PitchDetector, frequencyToNote, KeyDetector, BeatDetector } from './utils/audioUtils'
import './App.css'

function App() {
  const [isListening, setIsListening] = useState(false)
  const [currentNote, setCurrentNote] = useState(null)
  const [detectedKey, setDetectedKey] = useState({ key: 'Not detected', confidence: 0 })
  const [error, setError] = useState(null)
  const [noteHistory, setNoteHistory] = useState([])
  
  // Beat detection state
  const [beatDetectionEnabled, setBeatDetectionEnabled] = useState(false)
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

        // Add to key detector
        keyDetectorRef.current.addNote(noteInfo.noteName)
        
        // Update detected key
        const key = keyDetectorRef.current.detectKey()
        setDetectedKey(key)
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

  const toggleBeatDetection = () => {
    setBeatDetectionEnabled(prev => !prev)
    if (beatDetectorRef.current) {
      beatDetectorRef.current.reset()
    }
    setBeatInfo({ bpm: 0, confidence: 0 })
    setIsBeat(false)
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
            <button className="btn btn-danger" onClick={stopListening}>
              ⏹️ Stop Listening
            </button>
          )}
          
          {isListening && (
            <>
              <button className="btn btn-secondary" onClick={resetDetection}>
                🔄 Reset Detection
              </button>
              <button 
                className={`btn ${beatDetectionEnabled ? 'btn-beat-active' : 'btn-beat'}`} 
                onClick={toggleBeatDetection}
              >
                {beatDetectionEnabled ? '🎵 Beat: ON' : '🥁 Beat: OFF'}
              </button>
            </>
          )}
        </div>

        <div className="display-container">
          <div className="note-display">
            <h2>Current Note</h2>
            {currentNote ? (
              <div className="note-info">
                <div className="note-large">{currentNote.note}</div>
                <div className="frequency">{currentNote.frequency} Hz</div>
                <div className="cents">
                  {currentNote.cents > 0 ? '+' : ''}{currentNote.cents} cents
                </div>
              </div>
            ) : (
              <div className="note-placeholder">
                {isListening ? 'Listening...' : 'Not listening'}
              </div>
            )}
          </div>

          <div className="key-display">
            <h2>Detected Key</h2>
            <div className="key-info">
              <div className="key-large">{detectedKey.key}</div>
              {detectedKey.confidence > 0 && (
                <div className="confidence">
                  Confidence: {detectedKey.confidence}%
                </div>
              )}
            </div>
          </div>

          {beatDetectionEnabled && (
            <div className={`beat-display ${isBeat ? 'pulse' : ''}`}>
              <h2>Beat Detection</h2>
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
            </div>
          )}
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
