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

  // VU meter state
  const [vuLevels, setVuLevels] = useState({ left: 0, right: 0 })
  const [channelCount, setChannelCount] = useState(1) // Track if mono or stereo

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

      // Get channel count from the audio source
      setChannelCount(source.channelCount)

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

    // Check volume level (squelch) first and update VU meters
    const analyser = pitchDetectorRef.current.getAnalyser();
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const averageVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    const volumePercent = (averageVolume / 255) * 100;
    
    // Update VU meters
    // For mono sources (channelCount === 1), both channels get the same value
    // For stereo sources, we show the combined analysis (Web Audio API mixes to mono in analyser)
    setVuLevels({
      left: volumePercent,
      right: volumePercent
    });
    
    const isAboveSquelch = volumePercent >= squelchThreshold;

    // Note detection (if enabled and above squelch)
    if (noteDetectionEnabled && isAboveSquelch) {
      const frequency = pitchDetectorRef.current.detectPitch()
      
      if (frequency > 0) {
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
      const pitchDetector = new PitchDetector(audioContextRef.current, fftSize)
      pitchDetectorRef.current = pitchDetector

      const keyDetector = new KeyDetector()
      keyDetectorRef.current = keyDetector

      const beatDetector = new BeatDetector(audioContextRef.current, fftSize)
      beatDetectorRef.current = beatDetector

      // Create and load audio player
      const audioPlayer = new AudioPlayer(audioContextRef.current)
      audioPlayerRef.current = audioPlayer

      const song = calibrationSongs.find(s => s.id === selectedSong)
      await audioPlayer.loadAudio(getAudioUrl(song.filename))

      // Connect audio player to all analyzers
      audioPlayer.connectToAnalyser(pitchDetector.getAnalyser())
      pitchDetector.getAnalyser().connect(beatDetector.getAnalyser())

      // Set channel count (audio files can be mono or stereo, default to stereo assumption)
      // Most audio files are stereo, but we'll detect from the source node
      const sourceNode = audioPlayer.sourceNode
      if (sourceNode && sourceNode.channelCount) {
        setChannelCount(sourceNode.channelCount)
      } else {
        // Default to stereo for audio files
        setChannelCount(2)
      }

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
    <div className="app compact-layout">
      <header className="header compact-header">
        <h1>🎵 ToneScope</h1>
      </header>

      <main className="main compact-main">
        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        {/* Compact Sidebar for Controls */}
        <div className="control-sidebar">
          <div className="controls-compact">
            {!isListening ? (
              <>
                <button className="btn btn-compact btn-primary" onClick={startListening}>
                  Listen
                </button>
              </>
            ) : calibrationMode ? (
              <>
                <button className="btn btn-compact btn-danger" onClick={stopCalibrationMode}>
                  Stop
                </button>
                <button 
                  className={`btn btn-compact ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={togglePlayback}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button className="btn btn-compact btn-secondary" onClick={resetDetection}>
                  Reset
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-compact btn-danger" onClick={stopListening}>
                  Stop
                </button>
                <button className="btn btn-compact btn-secondary" onClick={resetDetection}>
                  Reset
                </button>
              </>
            )}
          </div>
          
          {/* Calibration Mode Selector */}
          {!isListening && (
            <div className="calibration-compact">
              <label className="calibration-label">Calibration</label>
              <select 
                className="song-select-compact"
                value={selectedSong}
                onChange={(e) => setSelectedSong(e.target.value)}
              >
                <option value="">Select song...</option>
                {calibrationSongs.map(song => (
                  <option key={song.id} value={song.id}>
                    {song.name}
                  </option>
                ))}
              </select>
              <button 
                className="btn btn-compact btn-secondary"
                onClick={startCalibrationMode}
                disabled={!selectedSong || loadingAudio}
                style={{fontSize: '0.7rem', padding: '0.4rem'}}
              >
                {loadingAudio ? 'Loading...' : 'Select'}
              </button>
            </div>
          )}
          
          {isListening && (
            <div className="slider-controls-vertical">
              {/* VU Meters */}
              <div className="vu-meters-container">
                <label className="vertical-label">VU</label>
                <div className="vu-meters">
                  {/* Left/Mono channel */}
                  <div className="vu-meter">
                    <div className="vu-meter-track">
                      <div className="vu-meter-red-zone"></div>
                      <div 
                        className="vu-meter-fill" 
                        style={{height: `${Math.min(100, vuLevels.left)}%`}}
                      ></div>
                      <div 
                        className="vu-meter-squelch-line" 
                        style={{bottom: `${squelchThreshold * 2}%`}}
                      ></div>
                    </div>
                    <span className="vu-label">{channelCount === 1 ? 'M' : 'L'}</span>
                  </div>
                  
                  {/* Right channel - only show if stereo */}
                  {channelCount > 1 && (
                    <div className="vu-meter">
                      <div className="vu-meter-track">
                        <div className="vu-meter-red-zone"></div>
                        <div 
                          className="vu-meter-fill" 
                          style={{height: `${Math.min(100, vuLevels.right)}%`}}
                        ></div>
                        <div 
                          className="vu-meter-squelch-line" 
                          style={{bottom: `${squelchThreshold * 2}%`}}
                        ></div>
                      </div>
                      <span className="vu-label">R</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="slider-control-vertical">
                <label className="vertical-label">Squelch</label>
                <input 
                  type="range"
                  min="0"
                  max="50"
                  value={squelchThreshold}
                  onChange={(e) => setSquelchThreshold(Number(e.target.value))}
                  className="slider-vertical"
                  orient="vertical"
                />
                <span className="slider-value-vertical">{squelchThreshold}%</span>
              </div>
              
              <div className="slider-control-vertical">
                <label className="vertical-label">Rate</label>
                <input 
                  type="range"
                  min="5"
                  max="60"
                  value={updateRate}
                  onChange={(e) => setUpdateRate(Number(e.target.value))}
                  className="slider-vertical"
                  orient="vertical"
                />
                <span className="slider-value-vertical">{updateRate}Hz</span>
              </div>
              
              <div className="slider-control-vertical">
                <label className="vertical-label">FFT</label>
                <input 
                  type="range"
                  min="512"
                  max="8192"
                  step="512"
                  value={fftSize}
                  onChange={(e) => handleFftSizeChange(Number(e.target.value))}
                  className="slider-vertical"
                  orient="vertical"
                />
                <span className="slider-value-vertical">{fftSize}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Main Content Area */}
        <div className="content-area">

        {/* Always show detection displays */}
        <div className="display-container-compact">
          <div className="feature-panel-compact">
            <div className="feature-header-compact">
              <span>Note</span>
              <button 
                className={`btn-feature-toggle-compact ${noteDetectionEnabled ? 'active' : ''}`}
                onClick={toggleNoteDetection}
                title={noteDetectionEnabled ? "Note detection ON" : "Note detection OFF"}
                disabled={!isListening}
              >
                {noteDetectionEnabled ? '✓' : '✗'}
              </button>
            </div>
            <div className={`note-display-compact ${!noteDetectionEnabled ? 'disabled' : ''}`}>
              {noteDetectionEnabled && currentNote ? (
                <>
                  <div className="note-compact">{currentNote.note}</div>
                  <div className="freq-compact">{currentNote.frequency}Hz</div>
                </>
              ) : (
                <div className="placeholder-compact">--</div>
              )}
            </div>
          </div>

          <div className="feature-panel-compact">
            <div className="feature-header-compact">
              <span>Key</span>
              <button 
                className={`btn-feature-toggle-compact ${keyDetectionEnabled ? 'active' : ''}`}
                onClick={toggleKeyDetection}
                title={keyDetectionEnabled ? "Key detection ON" : "Key detection OFF"}
                disabled={!isListening}
              >
                {keyDetectionEnabled ? '✓' : '✗'}
              </button>
            </div>
            <div className={`key-display-compact ${!keyDetectionEnabled ? 'disabled' : ''}`}>
              {keyDetectionEnabled ? (
                <>
                  <div className="key-compact">{detectedKey.consensusKey || detectedKey.key}</div>
                  {detectedKey.consensusConfidence > 0 && (
                    <div className="conf-compact">{detectedKey.consensusConfidence}%</div>
                  )}
                </>
              ) : (
                <div className="placeholder-compact">--</div>
              )}
            </div>
          </div>

          <div className="feature-panel-compact">
            <div className="feature-header-compact">
              <span>BPM</span>
              <button 
                className={`btn-feature-toggle-compact ${beatDetectionEnabled ? 'active' : ''}`}
                onClick={toggleBeatDetection}
                title={beatDetectionEnabled ? "Beat detection ON" : "Beat detection OFF"}
                disabled={!isListening}
              >
                {beatDetectionEnabled ? '✓' : '✗'}
              </button>
            </div>
            <div className={`beat-display-compact ${isBeat && beatDetectionEnabled ? 'pulse' : ''} ${!beatDetectionEnabled ? 'disabled' : ''}`}>
              {beatDetectionEnabled ? (
                <>
                  <div className={`beat-indicator-compact ${isBeat ? 'active' : ''}`}></div>
                  <div className="bpm-compact">{beatInfo.consensusBPM || beatInfo.bpm || '--'}</div>
                  {beatInfo.consensusConfidence > 0 && (
                    <div className="conf-compact">{beatInfo.consensusConfidence}%</div>
                  )}
                </>
              ) : (
                <div className="placeholder-compact">--</div>
              )}
            </div>
          </div>
        </div>

        {/* Always show visualizer */}
        {pitchDetectorRef.current ? (
          <Visualizer 
            analyser={pitchDetectorRef.current.getAnalyser()} 
            currentNote={currentNote?.note}
            isActive={isListening}
          />
        ) : (
          <div className="placeholder-message">Start listening to see visualizations</div>
        )}

        {/* Always show analysis panels */}
        <AnalysisPanel 
          keyData={detectedKey}
          beatData={beatInfo}
          noteHistogram={noteHistogram}
          audioContext={audioContextRef.current}
          fftSize={fftSize}
        />

        {/* Recent notes history hidden - using histogram instead */}
        
        </div> {/* End content-area */}
      </main>

      <footer className="footer compact-footer">
        <p>Built with Web Audio API</p>
      </footer>
    </div>
  )
}

export default App
