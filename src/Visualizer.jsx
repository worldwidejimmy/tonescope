import { useEffect, useRef } from 'react'
import './Visualizer.css'

function Visualizer({ analyser, currentNote, isActive }) {
  const waveformCanvasRef = useRef(null)
  const spectrumCanvasRef = useRef(null)
  const noteCircleCanvasRef = useRef(null)
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
    const noteCircleCanvas = noteCircleCanvasRef.current

    if (!waveformCanvas || !spectrumCanvas || !noteCircleCanvas) return

    const waveformCtx = waveformCanvas.getContext('2d')
    const spectrumCtx = spectrumCanvas.getContext('2d')
    const noteCircleCtx = noteCircleCanvas.getContext('2d')

    // Set canvas sizes
    const setCanvasSizes = () => {
      waveformCanvas.width = waveformCanvas.offsetWidth
      waveformCanvas.height = waveformCanvas.offsetHeight
      spectrumCanvas.width = spectrumCanvas.offsetWidth
      spectrumCanvas.height = spectrumCanvas.offsetHeight
      noteCircleCanvas.width = noteCircleCanvas.offsetWidth
      noteCircleCanvas.height = noteCircleCanvas.offsetHeight
    }
    setCanvasSizes()
    window.addEventListener('resize', setCanvasSizes)

    const bufferLength = analyser.frequencyBinCount
    const timeDataArray = new Uint8Array(bufferLength)
    const freqDataArray = new Uint8Array(bufferLength)

    const draw = () => {
      analyser.getByteTimeDomainData(timeDataArray)
      analyser.getByteFrequencyData(freqDataArray)

      // Draw Waveform
      drawWaveform(waveformCtx, waveformCanvas, timeDataArray, bufferLength)

      // Draw Frequency Spectrum
      drawSpectrum(spectrumCtx, spectrumCanvas, freqDataArray, bufferLength)

      // Draw Note Circle
      drawNoteCircle(noteCircleCtx, noteCircleCanvas, currentNote)

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

  const drawSpectrum = (ctx, canvas, dataArray, bufferLength) => {
    const width = canvas.width
    const height = canvas.height

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.fillRect(0, 0, width, height)

    const barWidth = (width / bufferLength) * 2.5
    let x = 0

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
  }

  const drawNoteCircle = (ctx, canvas, noteInfo) => {
    const width = canvas.width
    const height = canvas.height
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 20

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.fillRect(0, 0, width, height)

    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const angleStep = (Math.PI * 2) / 12

    // Draw circle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.stroke()

    // Draw notes
    notes.forEach((note, index) => {
      const angle = angleStep * index - Math.PI / 2
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)

      const isActive = noteInfo && noteInfo.noteName === note

      // Draw note circle
      ctx.beginPath()
      ctx.arc(x, y, isActive ? 20 : 12, 0, Math.PI * 2)
      
      if (isActive) {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20)
        gradient.addColorStop(0, '#fee140')
        gradient.addColorStop(1, '#fa709a')
        ctx.fillStyle = gradient
        ctx.shadowBlur = 20
        ctx.shadowColor = '#fa709a'
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.shadowBlur = 0
      }
      
      ctx.fill()

      // Draw note label
      ctx.fillStyle = isActive ? '#000' : '#fff'
      ctx.font = isActive ? 'bold 14px Arial' : '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(note, x, y)
    })

    ctx.shadowBlur = 0
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
      <div className="viz-row">
        <div className="viz-panel note-circle-panel">
          <h4>Chromatic Circle</h4>
          <canvas ref={noteCircleCanvasRef} className="viz-canvas note-circle"></canvas>
        </div>
      </div>
    </div>
  )
}

export default Visualizer
