import React, { useRef, useState, useEffect } from 'react';
import { DragState, LayoutElement, Viewport, UnitType, LayoutValue, LayoutConfig } from '../types';
import { RESIZE_HANDLES } from '../constants';
import { convertAbsoluteToOffset, getParentRect, fromPixels } from '../utils/layoutUtils';
import clsx from 'clsx';

interface CanvasProps {
  elements: LayoutElement[];
  viewport: Viewport;
  scale: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateElements: (elements: LayoutElement[]) => void;
  mode: 'editor' | 'preview' | 'yaml';
}

const UnitBadge: React.FC<{ label: string; value: LayoutValue; className?: string }> = ({ label, value, className }) => {
    const unitLabel = 
        value.unit === UnitType.PX ? 'px' :
        value.unit === UnitType.PERCENT_PARENT_W ? '% w' :
        value.unit === UnitType.PERCENT_PARENT_H ? '% h' :
        value.unit === UnitType.VW ? 'vw' :
        value.unit === UnitType.VH ? 'vh' : value.unit;

    return (
        <div className={clsx("absolute bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-[60] pointer-events-none flex gap-1 select-none items-center", className)}>
            <span className="opacity-75 uppercase font-bold text-[9px]">{label}</span>
            <span className="font-mono">{value.value < 1 && value.value > -1 ? value.value.toFixed(1) : value.value.toFixed(0)} <span className="text-blue-200">{unitLabel}</span></span>
        </div>
    );
}

const MeasurementOverlay: React.FC<{ 
    targetRect: {x:number, y:number, w:number, h:number}, 
    parentRect: {x:number, y:number, w:number, h:number, name?: string},
    layout: LayoutConfig 
}> = ({ targetRect, parentRect, layout }) => {
    
    // Anchor Visuals
    const anchorX = layout.anchorX || 'left';
    const anchorY = layout.anchorY || 'top';
    const isGlobalX = layout.x.unit === UnitType.VW || layout.x.unit === UnitType.VH;
    const isGlobalY = layout.y.unit === UnitType.VW || layout.y.unit === UnitType.VH;

    // Determine X Reference Edge
    let lineXStart = 0; // Where on element to start
    let lineXEnd = 0;   // Where on parent/viewport to end
    let showLineX = false;

    // Parent/Container Bounds
    const containerX = isGlobalX ? 0 : parentRect.x;
    const containerW = isGlobalX ? window.innerWidth : parentRect.w; 

    if (anchorX === 'left') {
        lineXStart = targetRect.x;
        lineXEnd = containerX;
        showLineX = true;
    } else if (anchorX === 'right') {
        lineXStart = targetRect.x + targetRect.w;
        lineXEnd = containerX + containerW;
        showLineX = true;
    } else if (anchorX === 'center') {
        lineXStart = targetRect.x + targetRect.w / 2;
        lineXEnd = containerX + containerW / 2;
        showLineX = true;
    }

    // Determine Y Reference Edge
    const containerY = isGlobalY ? 0 : parentRect.y;
    const containerH = isGlobalY ? window.innerHeight : parentRect.h;

    let lineYStart = 0;
    let lineYEnd = 0;
    let showLineY = false;

    if (anchorY === 'top') {
        lineYStart = targetRect.y;
        lineYEnd = containerY;
        showLineY = true;
    } else if (anchorY === 'bottom') {
        lineYStart = targetRect.y + targetRect.h;
        lineYEnd = containerY + containerH;
        showLineY = true;
    } else if (anchorY === 'center') {
        lineYStart = targetRect.y + targetRect.h / 2;
        lineYEnd = containerY + containerH / 2;
        showLineY = true;
    }

    // Determine the distance for display
    const distX = Math.abs(lineXStart - lineXEnd);
    const distY = Math.abs(lineYStart - lineYEnd);

    return (
        <div className="absolute inset-0 pointer-events-none z-0">
             {/* X Anchor Line */}
             {showLineX && distX > 1 && (
                 <div 
                    className="absolute border-b border-red-500 border-dashed flex items-end justify-center pb-0.5"
                    style={{
                        left: Math.min(lineXStart, lineXEnd), 
                        top: targetRect.y + targetRect.h / 2,
                        width: distX,
                        height: 1
                    }}
                 >
                     <div className={clsx("absolute -top-4 text-[9px] font-bold text-red-500 bg-gray-950/50 px-1 rounded", anchorX === 'left' ? "left-0" : anchorX === 'right' ? "right-0" : "left-1/2 -translate-x-1/2")}>
                        {distX.toFixed(0)}
                     </div>
                    {/* Dots */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                 </div>
             )}
             
             {/* Y Anchor Line */}
             {showLineY && distY > 1 && (
                 <div 
                    className="absolute border-l border-red-500 border-dashed flex items-center justify-start pl-0.5"
                    style={{
                        top: Math.min(lineYStart, lineYEnd),
                        left: targetRect.x + targetRect.w / 2,
                        height: distY,
                        width: 1
                    }}
                 >
                     <div className={clsx("absolute -left-6 text-[9px] font-bold text-red-500 bg-gray-950/50 px-1 rounded", anchorY === 'top' ? "top-0" : anchorY === 'bottom' ? "bottom-0" : "top-1/2 -translate-y-1/2")}>
                        {distY.toFixed(0)}
                     </div>
                     {/* Dots */}
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                     <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                 </div>
             )}
             
             {/* Parent Outline Highlight (When relative to parent) */}
             {!isGlobalX && !isGlobalY && parentRect.name !== 'Canvas' && (
                 <div 
                    className="absolute border border-dashed border-purple-500/50 bg-purple-500/5"
                    style={{
                        left: parentRect.x,
                        top: parentRect.y,
                        width: parentRect.w,
                        height: parentRect.h
                    }}
                 >
                     <div className="absolute -top-5 left-0 bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                         Relative to: {parentRect.name}
                     </div>
                 </div>
             )}
        </div>
    );
};

// --- PREVIEW MODE RENDERER ---
const CSSPreviewNode: React.FC<{ element: LayoutElement; allElements: LayoutElement[] }> = ({ element, allElements }) => {
    // Find children
    const children = allElements.filter(e => e._runtime?.parentId === element.id);
    // Sort children by z-index
    children.sort((a,b) => (a.layout.zIndex || 0) - (b.layout.zIndex || 0));

    // Resolve CSS values
    const getCssValue = (val: LayoutValue, axis: 'w' | 'h') => {
        if (val.unit === UnitType.PX) return `${val.value}px`;
        if (val.unit === UnitType.PERCENT_PARENT_W) return `${val.value}%`;
        if (val.unit === UnitType.PERCENT_PARENT_H) return `${val.value}%`;
        if (val.unit === UnitType.VW) return `${val.value}vw`;
        if (val.unit === UnitType.VH) return `${val.value}vh`;
        return '0px';
    };

    // Calculate Anchor Styles
    const style: React.CSSProperties = {
        position: 'absolute',
        width: getCssValue(element.layout.width, 'w'),
        height: getCssValue(element.layout.height, 'h'),
        borderRadius: element.type === 'circle' ? '50%' : '0px',
        border: '1px solid rgba(0,0,0,0.1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden' // Clip children visually if needed
    };

    // Anchoring Logic (CSS)
    const { x, y, anchorX, anchorY } = element.layout;
    
    // X Axis
    if (anchorX === 'left') {
        style.left = getCssValue(x, 'w');
    } else if (anchorX === 'right') {
        style.right = getCssValue(x, 'w');
    } else if (anchorX === 'center') {
        style.left = '50%';
        style.transform = `translateX(calc(-50% + ${getCssValue(x, 'w')}))`;
    }

    // Y Axis
    if (anchorY === 'top') {
        style.top = getCssValue(y, 'h');
    } else if (anchorY === 'bottom') {
        style.bottom = getCssValue(y, 'h');
    } else if (anchorY === 'center') {
        style.top = '50%';
        const xTrans = style.transform ? style.transform : '';
        style.transform = `${xTrans} translateY(calc(-50% + ${getCssValue(y, 'h')}))`;
    }

    return (
        <div style={style} title={element.name} className="box-border">
            <span className="text-[10px] text-blue-500 opacity-50 absolute top-0 left-1 pointer-events-none">{element.name}</span>
            {children.map(child => (
                <CSSPreviewNode key={child.id} element={child} allElements={allElements} />
            ))}
        </div>
    );
};


export const Canvas: React.FC<CanvasProps> = ({
  elements,
  viewport,
  scale,
  selectedId,
  onSelect,
  onUpdateElements,
  mode
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Local state for smooth dragging (only commits to main state on mouseUp)
  const [dragState, setDragState] = useState<DragState | null>(null);
  // We keep a temporary "Visual" override for the dragged element
  const [tempRect, setTempRect] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);

  // EDITOR MODE: Use _runtime positions directly. Do not recalculate on render.
  // We trust App.tsx to have set _runtime correctly on load/change.
  const displayElements = elements; 

  const handleMouseDown = (e: React.MouseEvent, id: string, handle?: string) => {
    if (mode !== 'editor') return;
    e.stopPropagation();
    onSelect(id);

    const el = displayElements.find((x) => x.id === id);
    if (!el || !el._runtime) return;

    setDragState({
      isDragging: !handle,
      isResizing: !!handle,
      startX: e.clientX,
      startY: e.clientY,
      initialRect: {
        x: el._runtime.x,
        y: el._runtime.y,
        width: el._runtime.width,
        height: el._runtime.height,
      },
      handle,
    });
    setTempRect({
      id,
      x: el._runtime.x,
      y: el._runtime.y,
      w: el._runtime.width,
      h: el._runtime.height,
    });
  };

  // Global mouse move/up handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !tempRect) return;

      // ADJUST DELTA BY SCALE
      const deltaX = (e.clientX - dragState.startX) / scale;
      const deltaY = (e.clientY - dragState.startY) / scale;

      if (dragState.isDragging) {
        setTempRect({
          ...tempRect,
          x: dragState.initialRect.x + deltaX,
          y: dragState.initialRect.y + deltaY,
        });
      } else if (dragState.isResizing && dragState.handle) {
        let newX = dragState.initialRect.x;
        let newY = dragState.initialRect.y;
        let newW = dragState.initialRect.width;
        let newH = dragState.initialRect.height;

        const h = dragState.handle;
        if (h.includes('e')) newW = Math.max(10, dragState.initialRect.width + deltaX);
        if (h.includes('w')) {
            const wChange = Math.min(dragState.initialRect.width - 10, deltaX);
            newX += wChange;
            newW -= wChange;
        }
        if (h.includes('s')) newH = Math.max(10, dragState.initialRect.height + deltaY);
        if (h.includes('n')) {
            const hChange = Math.min(dragState.initialRect.height - 10, deltaY);
            newY += hChange;
            newH -= hChange;
        }

        setTempRect({ id: tempRect.id, x: newX, y: newY, w: newW, h: newH });
      }
    };

    const handleMouseUp = () => {
      if (dragState && tempRect) {
        const el = elements.find((x) => x.id === tempRect.id);
        
        if (el) {
          // 1. Calculate the FINAL ABSOLUTE position where the user dropped it
          const finalAbsX = tempRect.x;
          const finalAbsY = tempRect.y;
          const finalAbsW = tempRect.w;
          const finalAbsH = tempRect.h;
          
          const cx = finalAbsX + finalAbsW / 2;
          const cy = finalAbsY + finalAbsH / 2;

          // 2. Identify the logical Parent based on purely visual overlap
          //    Logic must match layoutUtils Pass 2
          const potentialParents = displayElements.filter((p) => {
            if (p.id === el.id) return false;
            // Filter only parents with valid runtime rects
            if (!p._runtime) return false;
            
            // Explicit Container Flag Check
            if (p.layout.isContainer === false) return false;

            const pRect = p._runtime;
            return (
                cx >= pRect.x &&
                cx <= pRect.x + pRect.width &&
                cy >= pRect.y &&
                cy <= pRect.y + pRect.height
            );
          });

          // Sort by Z-Index descending (highest wins) then Size (smallest area wins)
          potentialParents.sort((a, b) => {
             const zDiff = (b.layout.zIndex || 0) - (a.layout.zIndex || 0);
             if (zDiff !== 0) return zDiff;
             const aArea = (a._runtime?.width || 0) * (a._runtime?.height || 0);
             const bArea = (b._runtime?.width || 0) * (b._runtime?.height || 0);
             return aArea - bArea;
          });

          const newParent = potentialParents[0];
          const newParentId = newParent ? newParent.id : null;

          // 3. AUTO-CORRECT Z-INDEX
          // If we decided it's a parent, but current Z is lower, bump it.
          let newZIndex = el.layout.zIndex;
          if (newParent && (el.layout.zIndex <= newParent.layout.zIndex)) {
              newZIndex = newParent.layout.zIndex + 1;
          }

          // 4. Get Parent Geometry (for layout config calculation)
          const parentRect = getParentRect(newParentId, displayElements, viewport);
          
          const newLayout = { ...el.layout, zIndex: newZIndex };

          // 5. Back-Calculate offsets for CONFIG ONLY
          const xOffset = convertAbsoluteToOffset(
              finalAbsX, 
              newLayout.anchorX || 'left', 
              'x', 
              finalAbsW, 
              newLayout.x.unit, 
              viewport, 
              parentRect
          );
          
          const yOffset = convertAbsoluteToOffset(
              finalAbsY, 
              newLayout.anchorY || 'top', 
              'y', 
              finalAbsH, 
              newLayout.y.unit, 
              viewport, 
              parentRect
          );

          newLayout.x.value = xOffset;
          newLayout.y.value = yOffset;
          newLayout.width.value = fromPixels(finalAbsW, newLayout.width.unit, viewport, parentRect);
          newLayout.height.value = fromPixels(finalAbsH, newLayout.height.unit, viewport, parentRect);

          // 6. Update State
          // CRITICAL: We explicitly write the `_runtime` values here to match the drag result exactly.
          const newElements = elements.map(e => {
            if (e.id === el.id) {
               return { 
                   ...e, 
                   layout: newLayout,
                   _runtime: {
                       x: finalAbsX,
                       y: finalAbsY,
                       width: finalAbsW,
                       height: finalAbsH,
                       parentId: newParentId
                   }
               };
            }
            return e;
          });
          
          onUpdateElements(newElements);
        }
      }
      setDragState(null);
      setTempRect(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, tempRect, elements, displayElements, viewport, onUpdateElements, scale, mode]);

  return (
    <div 
        className="flex-1 bg-gray-950 overflow-auto flex relative p-12 custom-scrollbar"
        onClick={() => onSelect(null)}
    >
      <div
        ref={canvasRef}
        className="bg-white relative shadow-2xl transition-all duration-150 ease-out origin-top-left shrink-0 m-auto" 
        style={{
          width: viewport.width,
          height: viewport.height,
          backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          transform: `scale(${scale})`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'editor' && displayElements.map((el) => {
          // Use temporary rect if dragging this specific element
          const isInteracting = tempRect?.id === el.id;
          const rect = isInteracting ? tempRect : el._runtime;
          
          if (!rect) return null;

          const isSelected = selectedId === el.id;
          
          // For overlays, we need to know the parent. 
          const committedParentId = el._runtime?.parentId;
          
          const parentEl = committedParentId ? displayElements.find(p => p.id === committedParentId) : null;
          const parentRect = parentEl && parentEl._runtime ? 
            { x: parentEl._runtime.x, y: parentEl._runtime.y, w: parentEl._runtime.width, h: parentEl._runtime.height, name: parentEl.name } : 
            { x: 0, y: 0, w: viewport.width, h: viewport.height, name: 'Canvas' };

          return (
            <div
              key={el.id}
              className={clsx(
                "absolute box-border select-none group",
                isSelected ? "z-50" : "z-10",
                "cursor-move"
              )}
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w || rect.width,
                height: rect.h || rect.height,
              }}
              onMouseDown={(e) => handleMouseDown(e, el.id)}
              onClick={(e) => e.stopPropagation()}
            >
              {isSelected && !dragState?.isDragging && (
                  <MeasurementOverlay 
                    targetRect={rect} 
                    parentRect={parentRect} 
                    layout={el.layout} 
                  />
              )}

              {/* Element Visual */}
              <div 
                className={clsx(
                    "w-full h-full border-2 transition-colors overflow-hidden flex items-center justify-center text-xs text-black/50 font-mono relative",
                    isSelected ? "border-blue-500 bg-blue-500/10" : "border-gray-400 bg-gray-100 hover:border-blue-300",
                    el.type === 'circle' ? 'rounded-full' : 'rounded-sm'
                )}
              >
                 {el.name}
              </div>

              {/* Selection Decorators */}
              {isSelected && (
                <>
                  <UnitBadge label={el.layout.anchorX === 'right' ? "Right" : el.layout.anchorX === 'center' ? "Center X" : "Left"} value={el.layout.x} className={clsx("-top-8", el.layout.anchorX === 'right' ? "right-0" : el.layout.anchorX === 'center' ? "left-1/2 -translate-x-1/2" : "left-0")} />
                  <UnitBadge label={el.layout.anchorY === 'bottom' ? "Bottom" : el.layout.anchorY === 'center' ? "Center Y" : "Top"} value={el.layout.y} className={clsx("-left-24", el.layout.anchorY === 'bottom' ? "bottom-0" : el.layout.anchorY === 'center' ? "top-1/2 -translate-y-1/2" : "top-0")} />
                  <UnitBadge label="w" value={el.layout.width} className="-bottom-8 left-1/2 -translate-x-1/2" />
                  <UnitBadge label="h" value={el.layout.height} className="top-1/2 -right-24 -translate-y-1/2" />

                  {RESIZE_HANDLES.map((h) => (
                    <div
                      key={h}
                      onMouseDown={(e) => handleMouseDown(e, el.id, h)}
                      className={clsx(
                        "absolute w-3 h-3 bg-white border border-blue-500 rounded-full z-50",
                        h === 'nw' && "-top-1.5 -left-1.5 cursor-nw-resize",
                        h === 'n' && "-top-1.5 left-1/2 -translate-x-1/2 cursor-n-resize",
                        h === 'ne' && "-top-1.5 -right-1.5 cursor-ne-resize",
                        h === 'e' && "top-1/2 -right-1.5 -translate-y-1/2 cursor-e-resize",
                        h === 'se' && "-bottom-1.5 -right-1.5 cursor-se-resize",
                        h === 's' && "bottom-1.5 left-1/2 -translate-x-1/2 -translate-y-0 cursor-s-resize",
                        h === 'sw' && "-bottom-1.5 -left-1.5 cursor-sw-resize",
                        h === 'w' && "top-1/2 -left-1.5 -translate-y-1/2 cursor-w-resize"
                      )}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}

        {/* PREVIEW MODE - NESTED CSS RENDERING */}
        {mode === 'preview' && (
            <div className="w-full h-full relative">
                {displayElements.filter(el => !el._runtime?.parentId || el._runtime.parentId === 'root').map(el => (
                    <CSSPreviewNode key={el.id} element={el} allElements={displayElements} />
                ))}
            </div>
        )}
      </div>
    </div>
  );
};