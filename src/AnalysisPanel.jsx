import { useEffect, useRef } from 'react';
import './AnalysisPanel.css';

export default function AnalysisPanel({ keyData, beatData, audioContext }) {
  const keyCanvasRef = useRef(null);
  const bpmCanvasRef = useRef(null);

  // Draw key histogram
  useEffect(() => {
    const canvas = keyCanvasRef.current;
    if (!canvas || !keyData?.histogram) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    ctx.clearRect(0, 0, width, height);
    
    const histogram = keyData.histogram.slice(0, 10); // Show top 10
    if (histogram.length === 0) return;
    
    const barWidth = width / histogram.length;
    const maxConfidence = Math.max(...histogram.map(h => h.confidence));
    
    histogram.forEach((item, index) => {
      const barHeight = (item.confidence / maxConfidence) * (height - 40);
      const x = index * barWidth;
      const y = height - barHeight - 20;
      
      // Color based on whether it's the detected key
      const isDetected = item.key === keyData.key;
      ctx.fillStyle = isDetected 
        ? 'rgba(74, 222, 128, 0.8)' 
        : 'rgba(148, 163, 184, 0.5)';
      
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
      
      // Draw key label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x + barWidth / 2, height - 5);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(item.key, 0, 0);
      ctx.restore();
      
      // Draw confidence value
      if (barHeight > 15) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.confidence}%`, x + barWidth / 2, y + 15);
      }
    });
  }, [keyData]);

  // Draw BPM histogram
  useEffect(() => {
    const canvas = bpmCanvasRef.current;
    if (!canvas || !beatData?.histogram) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    ctx.clearRect(0, 0, width, height);
    
    const histogram = beatData.histogram.slice(0, 10); // Show top 10
    if (histogram.length === 0) return;
    
    const barWidth = Math.min(width / histogram.length, 50);
    const maxPercentage = Math.max(...histogram.map(h => h.percentage));
    
    histogram.forEach((item, index) => {
      const barHeight = (item.percentage / maxPercentage) * (height - 40);
      const x = index * barWidth + 10;
      const y = height - barHeight - 20;
      
      // Color based on whether it's the current BPM
      const isCurrent = item.bpm === beatData.bpm;
      ctx.fillStyle = isCurrent 
        ? 'rgba(251, 191, 36, 0.8)' 
        : 'rgba(148, 163, 184, 0.5)';
      
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
      
      // Draw BPM label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${item.bpm}`, x + barWidth / 2, height - 5);
      
      // Draw percentage
      if (barHeight > 15) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.percentage}%`, x + barWidth / 2, y + 15);
      }
    });
  }, [beatData]);

  // Get audio context info
  const getAudioInfo = () => {
    if (!audioContext) return null;
    
    const sampleRate = audioContext.sampleRate;
    const bufferSize = 2048; // From analyser.fftSize
    const analysisWindow = (bufferSize / sampleRate * 1000).toFixed(1); // in milliseconds
    
    return {
      sampleRate,
      bufferSize,
      analysisWindow
    };
  };

  const audioInfo = getAudioInfo();

  return (
    <div className="analysis-panel">
      <div className="analysis-section">
        <div className="section-header">
          <h3>Key Detection Analysis</h3>
          {keyData && (
            <span className="detected-value">
              Detected: <strong>{keyData.key}</strong> ({keyData.confidence}%)
            </span>
          )}
        </div>
        <canvas 
          ref={keyCanvasRef} 
          width={600} 
          height={200}
          className="histogram-canvas"
        />
        <p className="histogram-description">
          Correlation scores for all possible keys (top 10 shown)
        </p>
      </div>

      <div className="analysis-section">
        <div className="section-header">
          <h3>BPM Detection Analysis</h3>
          {beatData && beatData.bpm > 0 && (
            <span className="detected-value">
              Detected: <strong>{beatData.bpm} BPM</strong> ({beatData.confidence}%)
            </span>
          )}
        </div>
        <canvas 
          ref={bpmCanvasRef} 
          width={600} 
          height={200}
          className="histogram-canvas"
        />
        <p className="histogram-description">
          Distribution of detected BPM values over recent samples
        </p>
      </div>

      {audioInfo && (
        <div className="audio-info">
          <h4>Audio Analysis Parameters</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Sample Rate:</span>
              <span className="info-value">{audioInfo.sampleRate} Hz</span>
            </div>
            <div className="info-item">
              <span className="info-label">Buffer Size:</span>
              <span className="info-value">{audioInfo.bufferSize} samples</span>
            </div>
            <div className="info-item">
              <span className="info-label">Analysis Window:</span>
              <span className="info-value">{audioInfo.analysisWindow} ms</span>
            </div>
            <div className="info-item">
              <span className="info-label">Update Rate:</span>
              <span className="info-value">~60 fps</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
