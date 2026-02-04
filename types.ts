export enum UnitType {
  PX = 'px',
  PERCENT_PARENT_W = '%p_w', // Relative to parent width
  PERCENT_PARENT_H = '%p_h', // Relative to parent height
  VW = 'vw',
  VH = 'vh',
}

export type Axis = 'x' | 'y' | 'width' | 'height';
export type AnchorX = 'left' | 'center' | 'right';
export type AnchorY = 'top' | 'center' | 'bottom';

export interface LayoutValue {
  value: number;
  unit: UnitType;
}

export interface LayoutConfig {
  x: LayoutValue;
  y: LayoutValue;
  width: LayoutValue;
  height: LayoutValue;
  zIndex: number;
  anchorX: AnchorX;
  anchorY: AnchorY;
  isContainer?: boolean; // Controls if this element can be a parent
}

export interface LayoutElement {
  id: string;
  type: 'rect' | 'circle';
  name: string;
  layout: LayoutConfig;
  // Computed values for the editor runtime (absolute pixels)
  // These are not saved to YAML directly, but derived from it or used to update it
  _runtime?: {
    x: number;
    y: number;
    width: number;
    height: number;
    parentId: string | null; // Calculated dynamically based on containment
  };
}

export interface Viewport {
  name: string;
  width: number;
  height: number;
  icon: string;
}

export interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  startX: number;
  startY: number;
  initialRect: { x: number; y: number; width: number; height: number };
  handle?: string; // n, s, e, w, ne, nw, se, sw
}