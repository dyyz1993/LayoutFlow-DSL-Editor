import { Viewport } from './types';

export const VIEWPORTS: Viewport[] = [
  { name: 'Desktop', width: 1280, height: 800, icon: 'monitor' },
  { name: 'Tablet', width: 768, height: 1024, icon: 'tablet' },
  { name: 'Mobile', width: 375, height: 667, icon: 'smartphone' },
  { name: 'Wide', width: 1920, height: 1080, icon: 'tv' },
];

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

export const DEFAULT_LAYOUT = {
  value: 0,
  unit: 'px'
};