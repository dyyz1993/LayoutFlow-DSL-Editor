import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas } from './components/Canvas';
import { PropertyPanel } from './components/PropertyPanel';
import { LayerPanel } from './components/LayerPanel';
import { LayoutElement, Viewport, UnitType } from './types';
import { VIEWPORTS, DEFAULT_LAYOUT } from './constants';
import { calculateRuntimePositions } from './utils/layoutUtils';
import * as yaml from 'js-yaml';
import { Layout, FileText, Square, Circle, Plus, Code, Eye, Laptop, Minus, Search, Smartphone, Monitor, Tv, Tablet, Scan, Play } from 'lucide-react';
import clsx from 'clsx';

const INITIAL_ELEMENTS_RAW: LayoutElement[] = [
  {
    id: 'box-1',
    type: 'rect',
    name: 'Header',
    layout: {
      x: { value: 0, unit: UnitType.PX },
      y: { value: 0, unit: UnitType.PX },
      width: { value: 100, unit: UnitType.VW },
      height: { value: 80, unit: UnitType.PX },
      zIndex: 1,
      anchorX: 'left',
      anchorY: 'top'
    }
  },
  {
    id: 'box-2',
    type: 'rect',
    name: 'Container',
    layout: {
      x: { value: 0, unit: UnitType.PX },
      y: { value: 100, unit: UnitType.PX },
      width: { value: 80, unit: UnitType.PERCENT_PARENT_W },
      height: { value: 400, unit: UnitType.PX },
      zIndex: 2,
      anchorX: 'center', 
      anchorY: 'top'
    }
  },
   {
    id: 'box-3',
    type: 'circle',
    name: 'Floater',
    layout: {
      x: { value: 20, unit: UnitType.PX },
      y: { value: 20, unit: UnitType.PX },
      width: { value: 50, unit: UnitType.PX },
      height: { value: 50, unit: UnitType.PX },
      zIndex: 3,
      anchorX: 'right', 
      anchorY: 'bottom' 
    }
  }
];

const getViewportIcon = (name: string) => {
    switch (name) {
        case 'Mobile': return <Smartphone size={14} />;
        case 'Tablet': return <Tablet size={14} />;
        case 'Desktop': return <Monitor size={14} />;
        case 'Wide': return <Tv size={14} />;
        default: return <Monitor size={14} />;
    }
};

export default function App() {
  const [viewport, setViewport] = useState<Viewport>(VIEWPORTS[0]);
  
  // Initialize elements with calculated runtime positions immediately
  const [elements, setElements] = useState<LayoutElement[]>(() => {
      return calculateRuntimePositions(INITIAL_ELEMENTS_RAW, VIEWPORTS[0]);
  });
  
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'editor' | 'yaml' | 'preview'>('editor');
  
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Recalculate ALL positions when Viewport Changes
  useEffect(() => {
    setElements(prev => calculateRuntimePositions(prev, viewport));
  }, [viewport.width, viewport.height]);

  // Handle Property Updates from Panel
  // When properties change, we MUST recalculate to see where things move
  const updateElement = (id: string, newLayout: Partial<LayoutElement['layout']>) => {
    setElements((prev) => {
      const updated = prev.map((el) => {
        if (el.id === id) {
          return { ...el, layout: { ...el.layout, ...newLayout } };
        }
        return el;
      });
      // Recalculate positions based on the new config
      return calculateRuntimePositions(updated, viewport);
    });
  };

  // Handle Drag Updates from Canvas
  // When dragging, we trust the Canvas to provide the new _runtime AND the new layout.
  // We DO NOT run calculateRuntimePositions here, because we want to avoid the "jump".
  // The Canvas has already ensured _runtime matches the mouse position.
  const handleCanvasUpdate = (newElements: LayoutElement[]) => {
      setElements(newElements);
  };

  const addElement = (type: 'rect' | 'circle') => {
    const id = `el-${Date.now()}`;
    const newEl: LayoutElement = {
      id,
      type,
      name: type === 'rect' ? 'New Box' : 'New Circle',
      layout: {
        x: { value: 100, unit: UnitType.PX },
        y: { value: 100, unit: UnitType.PX },
        width: { value: 100, unit: UnitType.PX },
        height: { value: 100, unit: UnitType.PX },
        zIndex: elements.length + 1,
        anchorX: 'left',
        anchorY: 'top'
      }
    };
    // Add and recalculate to place it correctly
    setElements(prev => calculateRuntimePositions([...prev, newEl], viewport));
    setSelectedId(id);
  };

  const handleViewportResize = (dim: 'width' | 'height', val: string) => {
      const num = parseInt(val);
      if (!isNaN(num)) {
          setViewport(prev => ({ ...prev, [dim]: num, name: 'Custom' }));
      }
  };
  
  const handleFitCanvas = () => {
    if (workspaceRef.current) {
        const { clientWidth, clientHeight } = workspaceRef.current;
        const padding = 80;
        const availableW = clientWidth - padding;
        const availableH = clientHeight - padding;
        
        if (availableW > 0 && availableH > 0) {
            const scaleX = availableW / viewport.width;
            const scaleY = availableH / viewport.height;
            const newScale = Math.min(scaleX, scaleY, 1.0);
            setScale(Math.max(0.1, newScale));
        }
    }
  };

  // Auto-fit on init
  useEffect(() => {
      const timer = setTimeout(handleFitCanvas, 100);
      return () => clearTimeout(timer);
  }, []);

  const handleLayerReorder = (sortedIds: string[]) => {
      const total = sortedIds.length;
      setElements(prev => {
          const updated = prev.map(el => {
              const index = sortedIds.indexOf(el.id);
              if (index === -1) return el;
              return {
                  ...el,
                  layout: { ...el.layout, zIndex: total - index }
              };
          });
          // Re-run layout because z-index affects parenting
          return calculateRuntimePositions(updated, viewport);
      });
  };

  const yamlString = useMemo(() => {
    const cleanElements = elements.map(({ _runtime, ...rest }) => rest);
    return yaml.dump(cleanElements);
  }, [elements]);

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-white">
      {/* Top Toolbar */}
      <div className="h-14 border-b border-gray-800 bg-gray-900 flex items-center px-4 justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-blue-400 mr-4">
            <Layout size={20} />
            <span>LayoutFlow</span>
          </div>
          
          {mode === 'editor' && (
            <div className="flex bg-gray-800 rounded-md p-1 gap-1">
                {VIEWPORTS.map((vp) => (
                <button
                    key={vp.name}
                    onClick={() => setViewport(vp)}
                    className={clsx(
                    "px-3 py-1.5 text-xs rounded flex items-center gap-2 transition-colors",
                    viewport.name === vp.name ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"
                    )}
                >
                    {getViewportIcon(vp.name)}
                    {vp.name}
                </button>
                ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
            <button 
                onClick={() => setMode('editor')}
                className={clsx("px-3 py-1.5 text-xs border border-gray-700 rounded flex items-center gap-2", mode === 'editor' ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700")}
            >
                <Eye size={14} /> Editor
            </button>
            <button 
                onClick={() => setMode('preview')}
                className={clsx("px-3 py-1.5 text-xs border border-gray-700 rounded flex items-center gap-2", mode === 'preview' ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700")}
            >
                <Play size={14} /> Preview (CSS)
            </button>
            <button 
                onClick={() => setMode('yaml')}
                className={clsx("px-3 py-1.5 text-xs border border-gray-700 rounded flex items-center gap-2", mode === 'yaml' ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700")}
            >
                <Code size={14} /> YAML
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar (Tools) */}
        {mode === 'editor' && (
            <div className="w-14 border-r border-gray-800 bg-gray-900 flex flex-col items-center py-4 gap-4 shrink-0 z-30 relative">
            <button 
                onClick={() => addElement('rect')}
                title="Add Rectangle"
                className="p-2 bg-gray-800 text-gray-300 rounded hover:bg-blue-600 hover:text-white transition-colors"
            >
                <Square size={20} />
            </button>
            <button 
                onClick={() => addElement('circle')}
                title="Add Circle"
                className="p-2 bg-gray-800 text-gray-300 rounded hover:bg-blue-600 hover:text-white transition-colors"
            >
                <Circle size={20} />
            </button>
            </div>
        )}

        {/* Main Content Area */}
        {mode === 'editor' || mode === 'preview' ? (
            <div className="flex-1 flex relative overflow-hidden" ref={workspaceRef}>
                <Canvas 
                    elements={elements} 
                    viewport={viewport} 
                    scale={scale}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onUpdateElements={handleCanvasUpdate}
                    mode={mode}
                />
                
                {/* Layer Panel (Floating Bottom Left) - Only Editor */}
                {mode === 'editor' && (
                    <div className="absolute left-4 bottom-4 z-40">
                    <LayerPanel 
                        elements={elements}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onReorder={handleLayerReorder}
                    />
                    </div>
                )}
            </div>
        ) : (
            <div className="flex-1 bg-gray-950 p-8 overflow-auto">
                <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 rounded-lg p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
                        <h3 className="font-mono text-sm text-blue-400">layout.yaml</h3>
                        <span className="text-xs text-gray-500">Generated automatically</span>
                    </div>
                    <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {yamlString}
                    </pre>
                </div>
            </div>
        )}

        {/* Right Property Panel - Only Editor */}
        {mode === 'editor' && (
            <PropertyPanel 
                selectedId={selectedId}
                elements={elements}
                viewport={viewport}
                onUpdate={updateElement}
            />
        )}
      </div>

      {/* Bottom Status/Config Bar */}
      <div className="h-10 border-t border-gray-800 bg-gray-900 flex items-center px-4 justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 uppercase font-semibold">Canvas Size</span>
                <div className="flex items-center gap-1">
                    <input 
                        type="number" 
                        value={viewport.width} 
                        onChange={(e) => handleViewportResize('width', e.target.value)}
                        className="w-16 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-center focus:border-blue-500 outline-none" 
                    />
                    <span className="text-gray-600 text-xs">x</span>
                    <input 
                        type="number" 
                        value={viewport.height} 
                        onChange={(e) => handleViewportResize('height', e.target.value)}
                        className="w-16 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-center focus:border-blue-500 outline-none" 
                    />
                </div>
            </div>
        </div>

        <div className="flex items-center gap-2">
                <button onClick={handleFitCanvas} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white mr-2" title="Fit to Screen">
                <Scan size={14} />
                </button>

                <div className="h-4 w-px bg-gray-800 mx-1" />

                <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                <Minus size={14} />
                </button>
                <span className="text-xs text-gray-400 w-12 text-center select-none">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                <Plus size={14} />
                </button>
                <button onClick={() => setScale(1)} className="ml-2 text-xs text-blue-400 hover:text-blue-300">
                Reset
                </button>
        </div>
      </div>
    </div>
  );
}