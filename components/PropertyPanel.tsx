import React, { useMemo } from 'react';
import { Axis, LayoutElement, LayoutValue, UnitType, Viewport, AnchorX, AnchorY } from '../types';
import { fromPixels, getParentRect, calculateRuntimePositions, convertAbsoluteToOffset } from '../utils/layoutUtils';
import { 
    Box, Maximize2, Move, 
    AlignLeft, AlignCenter, AlignRight, 
    AlignStartVertical, AlignEndVertical,
    Layers, LayoutTemplate, SquareDashedKanban, Crosshair, AlignVerticalJustifyCenter, Square
} from 'lucide-react';
import clsx from 'clsx';

interface PropertyPanelProps {
  selectedId: string | null;
  elements: LayoutElement[];
  viewport: Viewport;
  onUpdate: (id: string, newLayout: Partial<LayoutElement['layout']>) => void;
}

// Helper to determine the logical unit category
type UnitCategory = 'px' | 'percent' | 'viewport';

const getUnitCategory = (unit: UnitType): UnitCategory => {
    if (unit === UnitType.PX) return 'px';
    if (unit === UnitType.VW || unit === UnitType.VH) return 'viewport';
    return 'percent';
};

const PropertyRow: React.FC<{
  label: string;
  icon?: React.ReactNode;
  value: LayoutValue;
  axis: Axis; // 'x', 'y', 'width', 'height'
  onChange: (val: LayoutValue) => void;
  currentPixels: number; // The high-precision absolute magnitude/offset currently rendered
  viewport: Viewport;
  parentRect: { width: number; height: number };
}> = ({ label, icon, value, axis, onChange, currentPixels, viewport, parentRect }) => {
  
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // User manual input
    const floatVal = parseFloat(e.target.value);
    onChange({ ...value, value: isNaN(floatVal) ? 0 : floatVal });
  };

  const currentCategory = getUnitCategory(value.unit);

  const handleUnitClick = (targetCategory: UnitCategory) => {
      let nextUnit = UnitType.PX;

      // Cycle logic for sub-units
      if (targetCategory === 'px') {
          nextUnit = UnitType.PX;
      } else if (targetCategory === 'percent') {
          if (currentCategory === 'percent') {
              nextUnit = value.unit === UnitType.PERCENT_PARENT_W ? UnitType.PERCENT_PARENT_H : UnitType.PERCENT_PARENT_W;
          } else {
              nextUnit = (axis === 'x' || axis === 'width') ? UnitType.PERCENT_PARENT_W : UnitType.PERCENT_PARENT_H;
          }
      } else if (targetCategory === 'viewport') {
          if (currentCategory === 'viewport') {
              nextUnit = value.unit === UnitType.VW ? UnitType.VH : UnitType.VW;
          } else {
              nextUnit = (axis === 'x' || axis === 'width') ? UnitType.VW : UnitType.VH;
          }
      }

      // CRITICAL: Convert current visual pixels to the new unit value
      // This ensures the element does not visually move/resize.
      const newValue = fromPixels(currentPixels, nextUnit, viewport, parentRect);
      onChange({ value: newValue, unit: nextUnit });
  };

  // Display formatting: Allow typing, but show reasonable precision
  // We use key to force re-render input when value changes externally to prevent stale state if we used local state
  const displayValue = Number.isInteger(value.value) ? value.value.toString() : value.value.toFixed(2);

  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
            {icon}
            <span>{label}</span>
          </div>
          <span className="text-[10px] text-gray-600 font-mono">
             {currentPixels.toFixed(1)}px
          </span>
      </div>
      
      <div className="flex gap-2 h-8">
        <input
          type="number"
          step="0.1"
          value={displayValue}
          onChange={handleValueChange}
          className="bg-gray-800 border border-gray-700 rounded-lg flex-1 min-w-0 px-3 text-sm text-white focus:outline-none focus:border-blue-500 font-mono text-right transition-colors"
        />
        
        {/* Unit Toggle Group */}
        <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shrink-0 select-none">
            {/* PX Button */}
            <button 
                onClick={() => handleUnitClick('px')}
                className={clsx(
                    "w-8 flex items-center justify-center transition-colors border-r border-gray-700 last:border-0 hover:bg-gray-700",
                    value.unit === UnitType.PX ? "bg-blue-600 text-white hover:bg-blue-500" : "text-gray-400"
                )}
                title="Pixels"
            >
                <Box size={14} />
            </button>
            
            {/* Percent Button (Toggles %W / %H) */}
            <button 
                onClick={() => handleUnitClick('percent')}
                className={clsx(
                    "w-9 flex items-center justify-center transition-colors border-r border-gray-700 last:border-0 hover:bg-gray-700",
                    currentCategory === 'percent' ? "bg-blue-600 text-white hover:bg-blue-500" : "text-gray-400"
                )}
                title={value.unit === UnitType.PERCENT_PARENT_H ? "% Parent Height" : "% Parent Width"}
            >
                <span className="text-[10px] font-bold">
                    {currentCategory === 'percent' 
                        ? (value.unit === UnitType.PERCENT_PARENT_W ? '%W' : '%H') 
                        : (axis === 'x' || axis === 'width' ? '%W' : '%H')
                    }
                </span>
            </button>
            
            {/* Viewport Button (Toggles VW / VH) */}
            <button 
                onClick={() => handleUnitClick('viewport')}
                className={clsx(
                    "w-9 flex items-center justify-center transition-colors border-r border-gray-700 last:border-0 hover:bg-gray-700",
                    currentCategory === 'viewport' ? "bg-blue-600 text-white hover:bg-blue-500" : "text-gray-400"
                )}
                title={value.unit === UnitType.VH ? "Viewport Height" : "Viewport Width"}
            >
                 <span className="text-[10px] font-bold uppercase">
                    {currentCategory === 'viewport' 
                        ? (value.unit === UnitType.VW ? 'vw' : 'vh') 
                        : (axis === 'x' || axis === 'width' ? 'vw' : 'vh')
                    }
                </span>
            </button>
        </div>
      </div>
    </div>
  );
};

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedId,
  elements,
  viewport,
  onUpdate,
}) => {
  // Compute runtime elements to get current logical/visual info
  const runtimeElements = useMemo(() => calculateRuntimePositions(elements, viewport), [elements, viewport]);
  const selectedEl = runtimeElements.find((e) => e.id === selectedId);

  // Identify purely visual parent (for UI hint only)
  const visualParent = useMemo(() => {
    if (!selectedEl || !selectedEl._runtime) return null;
    const candidates = runtimeElements.filter(p => 
        p.id !== selectedEl.id && 
        p._runtime && 
        p._runtime.x <= selectedEl._runtime!.x &&
        p._runtime.y <= selectedEl._runtime!.y &&
        p._runtime.x + p._runtime.width >= selectedEl._runtime!.x + selectedEl._runtime!.width &&
        p._runtime.y + p._runtime.height >= selectedEl._runtime!.y + selectedEl._runtime!.height
    );
    candidates.sort((a,b) => (a._runtime!.width * a._runtime!.height) - (b._runtime!.width * b._runtime!.height));
    return candidates[0] || null;
  }, [selectedEl, runtimeElements]);

  if (!selectedEl || !selectedEl._runtime) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-800 p-8 text-gray-500 text-sm flex flex-col items-center justify-center h-full text-center">
        <LayoutTemplate size={40} className="mb-4 opacity-20" />
        <p>Select an element to edit layout properties.</p>
      </div>
    );
  }

  // Get the Logical Parent Rect for calculations
  // This must match the Layout Engine's parenting logic so conversions are accurate
  const logicalParentRect = getParentRect(selectedEl._runtime.parentId, runtimeElements, viewport);

  // Helper to get CURRENT PRECISE PIXEL OFFSET/SIZE
  // This is the source of truth for converting units
  const getPixels = (prop: Axis) => {
      if (prop === 'width') return selectedEl._runtime!.width;
      if (prop === 'height') return selectedEl._runtime!.height;
      if (prop === 'x') {
         return convertAbsoluteToOffset(
             selectedEl._runtime!.x, 
             selectedEl.layout.anchorX || 'left', 
             'x', 
             selectedEl._runtime!.width, 
             UnitType.PX, 
             viewport, 
             logicalParentRect
         );
      }
      if (prop === 'y') {
         return convertAbsoluteToOffset(
             selectedEl._runtime!.y, 
             selectedEl.layout.anchorY || 'top', 
             'y', 
             selectedEl._runtime!.height, 
             UnitType.PX, 
             viewport, 
             logicalParentRect
         );
      }
      return 0;
  };

  const updateProp = (prop: keyof LayoutElement['layout'], newVal: LayoutValue) => {
    onUpdate(selectedEl.id, { [prop]: newVal });
  };

  // Logic to switch Anchors without moving the Element
  const handleChangeAnchor = (axis: 'x' | 'y', newAnchor: AnchorX | AnchorY) => {
      // 1. Get current Absolute Position
      const currentAbs = axis === 'x' ? selectedEl._runtime!.x : selectedEl._runtime!.y;
      const size = axis === 'x' ? selectedEl._runtime!.width : selectedEl._runtime!.height;
      
      // 2. Calculate what the Offset Value needs to be for the NEW anchor
      //    to keep the element at 'currentAbs'
      const newOffsetValue = convertAbsoluteToOffset(
          currentAbs,
          newAnchor,
          axis,
          size,
          axis === 'x' ? selectedEl.layout.x.unit : selectedEl.layout.y.unit, // Keep current unit
          viewport,
          logicalParentRect
      );

      if (axis === 'x') {
          onUpdate(selectedEl.id, { 
              anchorX: newAnchor as AnchorX,
              x: { ...selectedEl.layout.x, value: newOffsetValue }
          });
      } else {
          onUpdate(selectedEl.id, { 
              anchorY: newAnchor as AnchorY,
              y: { ...selectedEl.layout.y, value: newOffsetValue }
          });
      }
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-y-auto shrink-0 custom-scrollbar">
      
      {/* Header Info */}
      <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 rounded uppercase">{selectedEl.type}</span>
            <input 
                className="bg-transparent text-sm font-bold text-white focus:outline-none focus:border-b border-blue-500 w-full"
                value={selectedEl.name}
                onChange={(e) => onUpdate(selectedEl.id, { name: e.target.value })}
            />
        </div>
        <div className="text-xs text-blue-400 mt-1 flex items-center gap-1">
          <Layers size={10} />
          <span>Inside: </span>
          <span className="font-semibold text-blue-300">{visualParent ? visualParent.name : 'Canvas (Root)'}</span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Alignment / Anchor Section */}
        <div className="bg-gray-800/30 rounded-lg border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 border-b border-gray-800">
                <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                    <Crosshair size={12} /> Anchor & Position
                </span>
            </div>
            
            <div className="p-3 grid grid-cols-2 gap-4">
                 {/* X Axis */}
                 <div className="flex flex-col gap-1">
                     <span className="text-[9px] text-gray-500 uppercase font-bold text-center">Horizontal</span>
                     <div className="flex bg-gray-900 rounded border border-gray-700 p-0.5">
                        <button 
                            onClick={() => handleChangeAnchor('x', 'left')} 
                            className={clsx("flex-1 p-1.5 rounded flex justify-center transition-colors", (selectedEl.layout.anchorX || 'left') === 'left' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
                            title="Anchor Left"
                        >
                            <AlignLeft size={16} />
                        </button>
                        <div className="w-px bg-gray-800 my-1"/>
                        <button 
                            onClick={() => handleChangeAnchor('x', 'center')} 
                            className={clsx("flex-1 p-1.5 rounded flex justify-center transition-colors", selectedEl.layout.anchorX === 'center' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
                            title="Anchor Center"
                        >
                            <AlignCenter size={16} />
                        </button>
                        <div className="w-px bg-gray-800 my-1"/>
                        <button 
                            onClick={() => handleChangeAnchor('x', 'right')} 
                            className={clsx("flex-1 p-1.5 rounded flex justify-center transition-colors", selectedEl.layout.anchorX === 'right' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
                            title="Anchor Right"
                        >
                            <AlignRight size={16} />
                        </button>
                     </div>
                 </div>

                 {/* Y Axis */}
                 <div className="flex flex-col gap-1">
                     <span className="text-[9px] text-gray-500 uppercase font-bold text-center">Vertical</span>
                     <div className="flex bg-gray-900 rounded border border-gray-700 p-0.5">
                        <button 
                            onClick={() => handleChangeAnchor('y', 'top')} 
                            className={clsx("flex-1 p-1.5 rounded flex justify-center transition-colors", (selectedEl.layout.anchorY || 'top') === 'top' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
                            title="Anchor Top"
                        >
                            <AlignStartVertical size={16} />
                        </button>
                        <div className="w-px bg-gray-800 my-1"/>
                        <button 
                            onClick={() => handleChangeAnchor('y', 'center')} 
                            className={clsx("flex-1 p-1.5 rounded flex justify-center transition-colors", selectedEl.layout.anchorY === 'center' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
                            title="Anchor Center"
                        >
                            <AlignVerticalJustifyCenter size={16} />
                        </button>
                        <div className="w-px bg-gray-800 my-1"/>
                        <button 
                            onClick={() => handleChangeAnchor('y', 'bottom')} 
                            className={clsx("flex-1 p-1.5 rounded flex justify-center transition-colors", selectedEl.layout.anchorY === 'bottom' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")}
                            title="Anchor Bottom"
                        >
                            <AlignEndVertical size={16} />
                        </button>
                     </div>
                 </div>
            </div>
            
            <div className="bg-blue-900/20 py-1 px-3 border-t border-blue-900/30">
                <p className="text-[10px] text-blue-300 text-center">
                    Element anchored to <strong>{visualParent ? visualParent.name : 'Canvas'}</strong>
                </p>
            </div>
        </div>

        {/* Position Section */}
        <div>
           <div className="flex items-center gap-2 text-white mb-3 pb-1 border-b border-gray-800">
              <Move size={14} className="text-blue-500" /> <span className="text-sm font-bold">Offset</span>
           </div>
           
            <PropertyRow
                label={selectedEl.layout.anchorX === 'right' ? 'Right' : selectedEl.layout.anchorX === 'center' ? 'Center X' : 'Left'}
                axis="x"
                value={selectedEl.layout.x}
                onChange={(v) => updateProp('x', v)}
                currentPixels={getPixels('x')}
                viewport={viewport}
                parentRect={logicalParentRect}
            />
            <PropertyRow
                label={selectedEl.layout.anchorY === 'bottom' ? 'Bottom' : selectedEl.layout.anchorY === 'center' ? 'Center Y' : 'Top'}
                axis="y"
                value={selectedEl.layout.y}
                onChange={(v) => updateProp('y', v)}
                currentPixels={getPixels('y')}
                viewport={viewport}
                parentRect={logicalParentRect}
            />
        </div>

        {/* Size Section */}
        <div>
           <div className="flex items-center gap-2 text-white mb-3 pb-1 border-b border-gray-800">
              <Maximize2 size={14} className="text-blue-500" /> <span className="text-sm font-bold">Size</span>
           </div>
           <PropertyRow
                label="Width"
                axis="width"
                value={selectedEl.layout.width}
                onChange={(v) => updateProp('width', v)}
                currentPixels={getPixels('width')}
                viewport={viewport}
                parentRect={logicalParentRect}
            />
            <PropertyRow
                label="Height"
                axis="height"
                value={selectedEl.layout.height}
                onChange={(v) => updateProp('height', v)}
                currentPixels={getPixels('height')}
                viewport={viewport}
                parentRect={logicalParentRect}
            />
        </div>
        
        {/* Layer & Settings Section */}
        <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase">Layer & Container</span>
                <SquareDashedKanban size={12} className="text-gray-600" />
            </div>
            
            <div className="space-y-3">
                 <div>
                    <span className="text-[10px] text-gray-500 block mb-1">Z-Index</span>
                    <input 
                        type="number" 
                        value={selectedEl.layout.zIndex} 
                        onChange={(e) => onUpdate(selectedEl.id, { zIndex: parseInt(e.target.value) })}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-full text-white focus:border-blue-500 outline-none"
                    />
                </div>

                <label className="flex items-center gap-2 bg-gray-800/50 p-2 rounded border border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors">
                    <input 
                        type="checkbox"
                        checked={selectedEl.layout.isContainer !== false}
                        onChange={(e) => onUpdate(selectedEl.id, { isContainer: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-200">Is Container?</span>
                        <span className="text-[9px] text-gray-500">Allow other elements inside</span>
                    </div>
                </label>
            </div>
        </div>
      </div>
      
      {/* Footer / Legend */}
      <div className="mt-auto p-4 bg-gray-950 border-t border-gray-800 text-[10px] text-gray-500 leading-relaxed">
        <strong className="text-gray-400 block mb-1">Unit Legend:</strong>
        <div className="grid grid-cols-2 gap-y-1">
             <div className="flex items-center gap-1.5"><Box size={10} className="text-blue-500"/> <span>px: Pixels</span></div>
             <div className="flex items-center gap-1.5"><span className="font-bold text-blue-500 text-[9px]">%W</span> <span>%: Parent Width</span></div>
             <div className="flex items-center gap-1.5"><span className="font-bold text-blue-500 text-[9px]">%H</span> <span>%: Parent Height</span></div>
             <div className="flex items-center gap-1.5"><span className="font-bold text-blue-500 text-[9px]">VW</span> <span>vw: Viewport W</span></div>
             <div className="flex items-center gap-1.5"><span className="font-bold text-blue-500 text-[9px]">VH</span> <span>vh: Viewport H</span></div>
        </div>
      </div>
    </div>
  );
};