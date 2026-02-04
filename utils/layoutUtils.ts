import { LayoutElement, UnitType, Viewport, LayoutValue, AnchorX, AnchorY } from '../types';

/**
 * Resolves a unit value to a raw pixel length (magnitude only).
 */
const resolveLength = (
    val: LayoutValue,
    viewport: Viewport,
    parentRect: { width: number; height: number }
): number => {
    switch (val.unit) {
        case UnitType.PX:
            return val.value;
        case UnitType.PERCENT_PARENT_W:
            return (val.value / 100) * parentRect.width;
        case UnitType.PERCENT_PARENT_H:
            return (val.value / 100) * parentRect.height;
        case UnitType.VW:
            return (val.value / 100) * viewport.width;
        case UnitType.VH:
            return (val.value / 100) * viewport.height;
        default:
            return val.value;
    }
};

/**
 * Converts a specific DSL value + Anchor to absolute canvas coordinate.
 */
export const convertOffsetToAbsolute = (
  val: LayoutValue,
  anchor: AnchorX | AnchorY,
  axis: 'x' | 'y',
  elementSize: number,
  viewport: Viewport,
  parentRect: { x: number; y: number; width: number; height: number }
): number => {
  const length = resolveLength(val, viewport, parentRect);
  
  // Is this value global (relative to viewport) or local?
  const isGlobal = val.unit === UnitType.VW || val.unit === UnitType.VH;
  const refRect = isGlobal 
    ? { x: 0, y: 0, width: viewport.width, height: viewport.height } 
    : parentRect;

  if (axis === 'x') {
      const a = anchor as AnchorX;
      if (a === 'left') return refRect.x + length;
      if (a === 'right') return refRect.x + refRect.width - length - elementSize;
      if (a === 'center') return refRect.x + (refRect.width / 2) + length - (elementSize / 2);
  } else {
      const a = anchor as AnchorY;
      if (a === 'top') return refRect.y + length;
      if (a === 'bottom') return refRect.y + refRect.height - length - elementSize;
      if (a === 'center') return refRect.y + (refRect.height / 2) + length - (elementSize / 2);
  }
  return 0;
};

/**
 * Converts an absolute canvas coordinate back to a relative offset value based on anchor.
 */
export const convertAbsoluteToOffset = (
  absPos: number,
  anchor: AnchorX | AnchorY,
  axis: 'x' | 'y',
  elementSize: number,
  targetUnit: UnitType,
  viewport: Viewport,
  parentRect: { x: number; y: number; width: number; height: number }
): number => {
    // Determine the reference frame
    const isGlobal = targetUnit === UnitType.VW || targetUnit === UnitType.VH;
    const refRect = isGlobal 
        ? { x: 0, y: 0, width: viewport.width, height: viewport.height } 
        : parentRect;

    let pixelOffset = 0;

    if (axis === 'x') {
        const a = anchor as AnchorX;
        if (a === 'left') pixelOffset = absPos - refRect.x;
        else if (a === 'right') pixelOffset = refRect.x + refRect.width - absPos - elementSize;
        else if (a === 'center') pixelOffset = (absPos + elementSize / 2) - (refRect.x + refRect.width / 2);
    } else {
        const a = anchor as AnchorY;
        if (a === 'top') pixelOffset = absPos - refRect.y;
        else if (a === 'bottom') pixelOffset = refRect.y + refRect.height - absPos - elementSize;
        else if (a === 'center') pixelOffset = (absPos + elementSize / 2) - (refRect.y + refRect.height / 2);
    }

    // Convert pixelOffset to target unit
    switch (targetUnit) {
        case UnitType.PX:
            return pixelOffset;
        case UnitType.PERCENT_PARENT_W:
            return parentRect.width === 0 ? 0 : (pixelOffset / parentRect.width) * 100;
        case UnitType.PERCENT_PARENT_H:
            return parentRect.height === 0 ? 0 : (pixelOffset / parentRect.height) * 100;
        case UnitType.VW:
            return viewport.width === 0 ? 0 : (pixelOffset / viewport.width) * 100;
        case UnitType.VH:
            return viewport.height === 0 ? 0 : (pixelOffset / viewport.height) * 100;
        default:
            return pixelOffset;
    }
};

/**
 * Legacy helper for Width/Height calculations (magnitude only)
 */
export const toPixels = (val: LayoutValue, viewport: Viewport, parentRect: { width: number; height: number }): number => {
    return resolveLength(val, viewport, parentRect);
};

export const fromPixels = (pixels: number, targetUnit: UnitType, viewport: Viewport, parentRect: { width: number; height: number }): number => {
    switch (targetUnit) {
        case UnitType.PX:
          return pixels;
        case UnitType.PERCENT_PARENT_W:
          return parentRect.width === 0 ? 0 : (pixels / parentRect.width) * 100;
        case UnitType.PERCENT_PARENT_H:
          return parentRect.height === 0 ? 0 : (pixels / parentRect.height) * 100;
        case UnitType.VW:
          return viewport.width === 0 ? 0 : (pixels / viewport.width) * 100;
        case UnitType.VH:
          return viewport.height === 0 ? 0 : (pixels / viewport.height) * 100;
        default:
          return pixels;
      }
};

/**
 * Resolves the parent rectangle (absolute runtime position)
 */
export const getParentRect = (
  parentId: string | null | undefined,
  elements: LayoutElement[],
  viewport: Viewport
): { x: number; y: number; width: number; height: number; name?: string } => {
  if (!parentId || parentId === 'root') {
    return { x: 0, y: 0, width: viewport.width, height: viewport.height, name: 'Canvas' };
  }
  const parent = elements.find((el) => el.id === parentId);
  if (parent && parent._runtime) {
    return {
      x: parent._runtime.x,
      y: parent._runtime.y,
      width: parent._runtime.width,
      height: parent._runtime.height,
      name: parent.name,
    };
  }
  return { x: 0, y: 0, width: viewport.width, height: viewport.height, name: 'Canvas' };
};

/**
 * Calculates the absolute runtime positions for all elements, resolving hierarchies
 */
export const calculateRuntimePositions = (
  elements: LayoutElement[],
  viewport: Viewport
): LayoutElement[] => {
  // Pass 1: Estimate DIMENSIONS & POSITIONS relative to VIEWPORT
  // This gives us the "visual geometry" to determine who is inside who.
  const estimatedElements = elements.map((el) => {
    const parentRect = { x: 0, y: 0, width: viewport.width, height: viewport.height };
    const width = toPixels(el.layout.width, viewport, parentRect);
    const height = toPixels(el.layout.height, viewport, parentRect);
    
    // Calculate estimated absolute position assuming viewport parent
    const x = convertOffsetToAbsolute(el.layout.x, el.layout.anchorX || 'left', 'x', width, viewport, parentRect);
    const y = convertOffsetToAbsolute(el.layout.y, el.layout.anchorY || 'top', 'y', height, viewport, parentRect);
    
    return {
      ...el,
      _runtime: { x, y, width, height, parentId: null }
    };
  });


  // Pass 2: Determine Parenting based on Containment
  // We don't check Z-Index strict inequality anymore for *validity*, but we use it for *priority*.
  const withParents = estimatedElements.map((child) => {
    const cx = child._runtime!.x + child._runtime!.width / 2;
    const cy = child._runtime!.y + child._runtime!.height / 2;

    const potentialParents = estimatedElements.filter((p) => {
      if (p.id === child.id) return false;
      
      // EXPLICIT CONTAINER CHECK
      // If isContainer is explicitly false, skip.
      // Default to true if undefined.
      if (p.layout.isContainer === false) return false;

      const pRect = p._runtime!;
      
      // Center Point Containment
      return (
        cx >= pRect.x &&
        cx <= pRect.x + pRect.width &&
        cy >= pRect.y &&
        cy <= pRect.y + pRect.height
      );
    });

    // Sort: 
    // 1. Z-Index Descending (Visually topmost container wins)
    // 2. Size Ascending (Smallest container wins - tighter fit)
    potentialParents.sort((a, b) => {
        const zDiff = (b.layout.zIndex || 0) - (a.layout.zIndex || 0);
        if (zDiff !== 0) return zDiff;
        // Secondary sort: smallest area wins
        const aArea = a._runtime!.width * a._runtime!.height;
        const bArea = b._runtime!.width * b._runtime!.height;
        return aArea - bArea;
    });

    const parent = potentialParents[0];

    if (parent) {
      return {
        ...child,
        _runtime: { ...child._runtime!, parentId: parent.id }
      };
    }
    return child;
  });

  // Pass 3: Final Recalculation with Known Parents
  // Topologically sort by zIndex (lowest first) so parents are calculated before children
  // Note: We use the Original Elements but attach the found ParentID
  const finalMap = new Map<string, LayoutElement>();
  
  const calculateElement = (id: string, stack: string[] = []) => {
      if (finalMap.has(id)) return finalMap.get(id)!;
      if (stack.includes(id)) return withParents.find(e => e.id === id)!; // Cycle detected

      const el = withParents.find(e => e.id === id)!;
      let parentRect = { x: 0, y: 0, width: viewport.width, height: viewport.height };

      if (el._runtime?.parentId) {
          const parentEl = calculateElement(el._runtime.parentId, [...stack, id]);
          if (parentEl && parentEl._runtime) {
              parentRect = {
                  x: parentEl._runtime.x,
                  y: parentEl._runtime.y,
                  width: parentEl._runtime.width,
                  height: parentEl._runtime.height
              };
          }
      }

      const width = toPixels(el.layout.width, viewport, parentRect);
      const height = toPixels(el.layout.height, viewport, parentRect);
      const x = convertOffsetToAbsolute(el.layout.x, el.layout.anchorX || 'left', 'x', width, viewport, parentRect);
      const y = convertOffsetToAbsolute(el.layout.y, el.layout.anchorY || 'top', 'y', height, viewport, parentRect);

      const res = {
          ...el,
          _runtime: {
              x, y, width, height, parentId: el._runtime!.parentId
          }
      };
      finalMap.set(id, res);
      return res;
  };

  withParents.forEach(el => calculateElement(el.id));
  
  // Return in original order but with updated runtime
  return elements.map(el => finalMap.get(el.id)!);
};