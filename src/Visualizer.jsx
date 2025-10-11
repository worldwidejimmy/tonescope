import { useEffect, useRef } from 'react'
import './Visualizer.css'

function Visualizer({ analyser, currentNote, isActive }) {
  const waveformCanvasRef = useRef(null)
  const spectrumCanvasRef = useRef(null)
  const animationRef = useRef(null)

  useEffect(() => {
    if (!analyser || !isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      return
    }

    const waveformCanvas = waveformCanvasRef.current
    const spectrumCanvas = spectrumCanvasRef.current

    if (!waveformCanvas || !spectrumCanvas) return

    const waveformCtx = waveformCanvas.getContext('2d')
    const spectrumCtx = spectrumCanvas.getContext('2d')

    // Set canvas sizes
    const setCanvasSizes = () => {
      waveformCanvas.width = waveformCanvas.offsetWidth
      waveformCanvas.height = waveformCanvas.offsetHeight
      spectrumCanvas.width = spectrumCanvas.offsetWidth
      spectrumCanvas.height = spectrumCanvas.offsetHeight
    }
    setCanvasSizes()
    window.addEventListener('resize', setCanvasSizes)

    const bufferLength = analyser.frequencyBinCount
    const timeDataArray = new Uint8Array(bufferLength)
    const freqDataArray = new Uint8Array(bufferLength)

    // Get sample rate for frequency calculations
    const sampleRate = analyser.context.sampleRate

    const draw = () => {
      analyser.getByteTimeDomainData(timeDataArray)
      analyser.getByteFrequencyData(freqDataArray)

      // Draw Waveform
      drawWaveform(waveformCtx, waveformCanvas, timeDataArray, bufferLength)

      // Draw Frequency Spectrum with frequency labels
      drawSpectrum(spectrumCtx, spectrumCanvas, freqDataArray, bufferLength, sampleRate)

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', setCanvasSizes)
    }
  }, [analyser, currentNote, isActive])

  const drawWaveform = (ctx, canvas, dataArray, bufferLength) => {
    const width = canvas.width
    const height = canvas.height

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.fillRect(0, 0, width, height)

    ctx.lineWidth = 2
    ctx.strokeStyle = '#667eea'
    ctx.beginPath()

    const sliceWidth = width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0
      const y = (v * height) / 2

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }

  const drawSpectrum = (ctx, canvas, dataArray, bufferLength, sampleRate) => {
    const width = canvas.width
    const height = canvas.height

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.fillRect(0, 0, width, height)

    const barWidth = (width / bufferLength) * 2.5
    let x = 0

    // Calculate Nyquist frequency (max frequency we can represent)
    const nyquist = sampleRate / 2

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height

      // Create gradient for bars
      const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height)
      gradient.addColorStop(0, '#fa709a')
      gradient.addColorStop(0.5, '#fee140')
      gradient.addColorStop(1, '#667eea')

      ctx.fillStyle = gradient
      ctx.fillRect(x, height - barHeight, barWidth, barHeight)

      x += barWidth + 1
    }

    // Draw frequency labels
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '10px system-ui'
    ctx.textAlign = 'center'

    // Label key frequencies
    const labelFreqs = [100, 500, 1000, 2000, 5000, 10000]
    labelFreqs.forEach(freq => {
      if (freq <= nyquist) {
        // Calculate position in spectrum
        const binIndex = Math.floor((freq / nyquist) * bufferLength)
        const xPos = (binIndex / bufferLength) * width * 0.4 // 0.4 accounts for barWidth multiplier

        // Draw frequency label at bottom
        ctx.fillText(`${freq >= 1000 ? (freq / 1000) + 'k' : freq}Hz`, xPos, height - 5)
      }
    })
  }

  return (
    <div className="visualizer-container">
      <div className="viz-row">
        <div className="viz-panel">
          <h4>Waveform</h4>
          <canvas ref={waveformCanvasRef} className="viz-canvas"></canvas>
        </div>
        <div className="viz-panel">
          <h4>Frequency Spectrum</h4>
          <canvas ref={spectrumCanvasRef} className="viz-canvas"></canvas>
        </div>
      </div>
      {/* Chromatic Circle temporarily hidden for compact layout */}
      {/* <div className="viz-row">
        <div className="viz-panel note-circle-panel">
          <h4>Chromatic Circle</h4>
          <canvas ref={noteCircleCanvasRef} className="viz-canvas note-circle"></canvas>
        </div>
      </div> */}
    </div>
  )
}

export default Visualizer
