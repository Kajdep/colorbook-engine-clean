import React, { useRef, useEffect, useState } from 'react';
import { Palette, Brush, Eraser, Undo, Redo, Trash2, Download } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface DrawingPoint {
  x: number;
  y: number;
}

interface DrawingPath {
  points: DrawingPoint[];
  color: string;
  size: number;
  opacity: number;
  tool: 'draw' | 'erase';
}

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000',
  '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080',
  '#FFB6C1', '#98FB98', '#87CEEB', '#DDA0DD', '#F0E68C', '#FF6347'
];

const DrawingCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentTool, setCurrentTool] = useState<'draw' | 'erase'>('draw');
  const [brushSize, setBrushSize] = useState(5);
  const [opacity, setOpacity] = useState(100);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  
  const { addNotification } = useAppStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;
    
    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Save initial state
    saveCanvasState();
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [paths]);

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL();
    const newHistory = canvasHistory.slice(0, historyStep + 1);
    newHistory.push(dataUrl);
    setCanvasHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw all paths
    paths.forEach(path => {
      if (path.points.length < 2) return;
      
      ctx.globalCompositeOperation = path.tool === 'erase' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.size;
      ctx.globalAlpha = path.opacity / 100;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      
      ctx.stroke();
    });
    
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const newPath: DrawingPath = {
      points: [pos],
      color: currentColor,
      size: brushSize,
      opacity: opacity,
      tool: currentTool
    };
    
    setCurrentPath(newPath);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentPath) return;
    
    const pos = getMousePos(e);
    const updatedPath = {
      ...currentPath,
      points: [...currentPath.points, pos]
    };
    
    setCurrentPath(updatedPath);
    
    // Update paths for real-time drawing
    setPaths(prev => {
      const newPaths = [...prev];
      if (newPaths.length > 0 && newPaths[newPaths.length - 1] === currentPath) {
        newPaths[newPaths.length - 1] = updatedPath;
      } else {
        newPaths.push(updatedPath);
      }
      return newPaths;
    });
  };

  const stopDrawing = () => {
    if (!isDrawing || !currentPath) return;
    
    setIsDrawing(false);
    
    // Finalize the path
    setPaths(prev => {
      const newPaths = [...prev];
      const lastPathIndex = newPaths.findIndex(p => p === currentPath);
      
      if (lastPathIndex !== -1) {
        newPaths[lastPathIndex] = currentPath;
      } else {
        newPaths.push(currentPath);
      }
      
      return newPaths;
    });
    
    setCurrentPath(null);
    
    // Save state after drawing
    setTimeout(() => {
      saveCanvasState();
    }, 100);
  };

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      restoreFromHistory(historyStep - 1);
      addNotification({ type: 'info', message: 'Undone!' });
    }
  };

  const redo = () => {
    if (historyStep < canvasHistory.length - 1) {
      setHistoryStep(historyStep + 1);
      restoreFromHistory(historyStep + 1);
      addNotification({ type: 'info', message: 'Redone!' });
    }
  };

  const restoreFromHistory = (step: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasHistory[step]) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = canvasHistory[step];
  };

  const clearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the canvas?')) {
      setPaths([]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          saveCanvasState();
          addNotification({ type: 'info', message: 'Canvas cleared!' });
        }
      }
    }
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `coloring-page-${new Date().getTime()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    addNotification({ type: 'success', message: 'Canvas saved!' });
  };

  const loadTemplate = (templateName: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    
    switch (templateName) {
      case 'butterfly':
        // Butterfly body
        ctx.ellipse(centerX, centerY, 5, 80, 0, 0, 2 * Math.PI);
        // Wings
        ctx.ellipse(centerX - 40, centerY - 30, 30, 50, 0, 0, 2 * Math.PI);
        ctx.ellipse(centerX + 40, centerY - 30, 30, 50, 0, 0, 2 * Math.PI);
        ctx.ellipse(centerX - 35, centerY + 20, 20, 35, 0, 0, 2 * Math.PI);
        ctx.ellipse(centerX + 35, centerY + 20, 20, 35, 0, 0, 2 * Math.PI);
        break;
        
      case 'flower':
        // Center
        ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
        // Petals
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const petalX = centerX + Math.cos(angle) * 40;
          const petalY = centerY + Math.sin(angle) * 40;
          ctx.ellipse(petalX, petalY, 15, 30, angle, 0, 2 * Math.PI);
        }
        // Stem
        ctx.moveTo(centerX, centerY + 20);
        ctx.lineTo(centerX, centerY + 150);
        // Leaves
        ctx.ellipse(centerX - 20, centerY + 80, 10, 25, -Math.PI/4, 0, 2 * Math.PI);
        ctx.ellipse(centerX + 20, centerY + 100, 10, 25, Math.PI/4, 0, 2 * Math.PI);
        break;
        
      case 'star':
        const spikes = 5;
        const outerRadius = 60;
        const innerRadius = 30;
        for (let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / spikes;
          const pointX = centerX + Math.cos(angle) * radius;
          const pointY = centerY + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(pointX, pointY);
          else ctx.lineTo(pointX, pointY);
        }
        ctx.closePath();
        break;
        
      case 'heart':
        ctx.moveTo(centerX, centerY + 30);
        ctx.bezierCurveTo(centerX - 50, centerY - 30, centerX - 100, centerY + 20, centerX, centerY + 80);
        ctx.bezierCurveTo(centerX + 100, centerY + 20, centerX + 50, centerY - 30, centerX, centerY + 30);
        break;
        
      default:
        ctx.arc(centerX, centerY, 50, 0, 2 * Math.PI);
        ctx.moveTo(centerX - 30, centerY - 30);
        ctx.lineTo(centerX + 30, centerY + 30);
        ctx.moveTo(centerX + 30, centerY - 30);
        ctx.lineTo(centerX - 30, centerY + 30);
    }
    
    ctx.stroke();
    setPaths([]); // Clear paths array since we're drawing directly
    saveCanvasState();
    addNotification({ type: 'success', message: `${templateName} template loaded!` });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Palette size={32} className="text-purple-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Digital Drawing Canvas</h1>
          <p className="text-gray-600">Create custom coloring pages with professional drawing tools</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Drawing Tools */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Drawing Tools</h2>
          
          <div className="space-y-4">
            {/* Tool Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tool</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setCurrentTool('draw')}
                  className={`tool-btn flex items-center gap-2 justify-center p-3 ${currentTool === 'draw' ? 'active' : ''}`}
                >
                  <Brush size={16} />
                  Draw
                </button>
                <button 
                  onClick={() => setCurrentTool('erase')}
                  className={`tool-btn flex items-center gap-2 justify-center p-3 ${currentTool === 'erase' ? 'active' : ''}`}
                >
                  <Eraser size={16} />
                  Erase
                </button>
              </div>
            </div>

            {/* Brush Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brush Size: {brushSize}px
              </label>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opacity: {opacity}%
              </label>
              <input 
                type="range" 
                min="10" 
                max="100" 
                value={opacity}
                onChange={(e) => setOpacity(parseInt(e.target.value))}
                className="w-full" 
              />
            </div>

            {/* Color Palette */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Colors</label>
              <div className="color-grid grid grid-cols-6 gap-2">
                {COLORS.map((color, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentColor(color)}
                    className={`color-swatch cursor-pointer w-8 h-8 rounded border-2 transition-all ${
                      currentColor === color ? 'border-blue-500 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button 
                onClick={undo}
                disabled={historyStep <= 0}
                className="w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600 flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Undo size={16} />
                Undo
              </button>
              <button 
                onClick={redo}
                disabled={historyStep >= canvasHistory.length - 1}
                className="w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600 flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Redo size={16} />
                Redo
              </button>
              <button 
                onClick={clearCanvas}
                className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 flex items-center gap-2 justify-center"
              >
                <Trash2 size={16} />
                Clear
              </button>
              <button 
                onClick={saveCanvas}
                className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 flex items-center gap-2 justify-center"
              >
                <Download size={16} />
                Save
              </button>
            </div>
            
            {/* Templates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Templates</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => loadTemplate('butterfly')}
                  className="text-xs bg-purple-100 text-purple-600 p-2 rounded hover:bg-purple-200 transition-colors"
                >
                  🦋 Butterfly
                </button>
                <button 
                  onClick={() => loadTemplate('flower')}
                  className="text-xs bg-pink-100 text-pink-600 p-2 rounded hover:bg-pink-200 transition-colors"
                >
                  🌸 Flower
                </button>
                <button 
                  onClick={() => loadTemplate('star')}
                  className="text-xs bg-yellow-100 text-yellow-600 p-2 rounded hover:bg-yellow-200 transition-colors"
                >
                  ⭐ Star
                </button>
                <button 
                  onClick={() => loadTemplate('heart')}
                  className="text-xs bg-red-100 text-red-600 p-2 rounded hover:bg-red-200 transition-colors"
                >
                  ❤️ Heart
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Drawing Canvas</h2>
            <div className="text-sm text-gray-500">
              800 × 600 px • {currentTool === 'draw' ? 'Drawing' : 'Erasing'} with {currentColor}
            </div>
          </div>
          
          <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 overflow-auto">
            <canvas
              ref={canvasRef}
              className="drawing-canvas max-w-full h-auto cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{
                cursor: currentTool === 'draw' ? 'crosshair' : 'cell'
              }}
            />
          </div>
          
          <div className="mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded">
            <div className="flex justify-between items-center">
              <span>
                💡 Tips: Use different brush sizes for variety. Try the templates for quick starts!
              </span>
              <span>
                Paths: {paths.length} | History: {canvasHistory.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

};

export default DrawingCanvas;
