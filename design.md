# LayoutFlow DSL Editor - Design Document

## 1. Project Overview
LayoutFlow is a visual DSL editor designed to bridge the gap between free-form absolute positioning (design tools like Figma) and responsive, relative layout logic (CSS/Flutter). 

It allows users to layout elements visually using absolute drag-and-drop, while the system automatically calculates and maintains relative constraints (percentages, anchors, viewport units) in the background.

## 2. Core Philosophy
**"Editor is Absolute, Logic is Relative"**

*   **Editing State:** In the editor, every element is rendered flattened (siblings) using absolute pixel coordinates (`_runtime`). This ensures 60fps performance and prevents layout "jumping" while dragging.
*   **Storage State:** The actual data (`layout`) stores relative relationships (e.g., "50% of parent width", "anchored to bottom-right").
*   **Reconciliation:** 
    *   **On Drag/Resize:** We update the absolute visual position immediately, then back-calculate the relative configuration based on the new position and the current parent.
    *   **On Viewport Change:** We take the relative configuration and re-calculate the absolute positions for the new screen size.

## 3. User Interface Layout

The interface follows a standard IDE layout with a centralized infinite canvas.

```text
+-----------------------------------------------------------------------+
|  [Logo] LayoutFlow    [Mobile][Tablet][Desktop]      [Editor][Yaml]   |  <-- Top Toolbar
+-----------------------------------------------------------------------+
|  T |                                                     |            |
|  o |                                                     |  Property  |
|  o |                                                     |   Panel    |
|  l |                                                     |            |
|  s |                  Infinite Canvas                    | +--------+ |
|    |                                                     | | Name   | |
| [ ]|          +-----------------------------+            | |--------| |
| Rect|          |  Viewport (e.g. 1280x800)   |            | | Pos X  | |
|    |          |                             |            | | [10px] | |
| ( )|          |   +-------+                 |            | |--------| |
| Circ|          |   | Par-  |                 |            | | Size W | |
|    |          |   | ent   |    +-----+      |            | | [50% ] | |
|    |          |   |       |    |Child|      |            | |--------| |
|    |          |   +-------+    +-----+      |            | | Anchor | |
|    |          |                             |            | | [Left] | |
|    |          +-----------------------------+            | +--------+ |
|    |                                                     |            |
+----+-----------------------------------------------------+------------+
| [Layer Panel]                                            | Zoom: 100% |  <-- Bottom Bar
+-----------------------------------------------------------------------+
```

## 4. Architecture & Data Model

### 4.1. Coordinate Systems
1.  **Layout Config (DSL):** The "Source of Truth".
    *   `UnitType`: `px`, `vw`, `vh`, `%p_w` (percent parent width), `%p_h`.
    *   `Anchor`: `Top/Center/Bottom`, `Left/Center/Right`.
    *   `Value`: The scalar magnitude.
2.  **Runtime Rect (`_runtime`):** Computed values for rendering.
    *   `x, y`: Absolute pixels relative to the Canvas (0,0).
    *   `width, height`: Absolute pixel dimensions.
    *   `parentId`: The ID of the container this element currently logically resides in.

### 4.2. Parenting Logic (The "Containment" Algorithm)
Parent-child relationships are calculated dynamically, not strictly enforced by DOM nesting in the editor.

1.  **Geometric Containment:** An element is considered a child if its **Center Point (cx, cy)** falls within the bounding box of another element.
2.  **IsContainer Flag:** Elements have an `isContainer` boolean. If false, they are ignored during parent detection (useful for "overlay" elements or strictly leaf nodes).
3.  **Z-Index Priority:** If the center point overlaps multiple containers, the one with the **Highest Z-Index** (visually on top) wins.
4.  **Size Tie-Breaker:** If Z-indices are equal, the smaller container wins (tightest fit).

### 4.3. Unit Conversion & Precision
To prevent "drift" or "jumping" when switching units (e.g., converting `px` to `%`):

1.  **Read:** Get current precise absolute pixel position (`_runtime.x`).
2.  **Calculate:** Determine what % value equals that exact pixel amount relative to the current parent.
3.  **Write:** Update the config with the new unit and value.

**Formula:**
$$ \text{NewValue} = \text{FromPixels}(\text{CurrentPixels}, \text{TargetUnit}, \text{ParentRect}) $$

## 5. Interaction Flows

### A. Drag & Drop
1.  **Start:** Capture `mousedown`. Store initial absolute position.
2.  **Move:** Update temporary drag state. Visuals move 1:1 with mouse.
3.  **Release (MouseUp):**
    *   Calculate final absolute rectangle.
    *   Run **Parenting Logic** to find the new parent.
    *   Auto-adjust Z-Index (if child Z <= parent Z, bump child Z).
    *   Back-calculate `LayoutConfig` (offsets/anchors) based on the new parent's rect.
    *   Commit to state.

### B. Property Updates
1.  **User Input:** User changes `width` from `100px` to `50%`.
2.  **Calculation:** 
    *   Resolve parent width (e.g., 500px).
    *   Calculate new width: $500 \times 0.5 = 250px$.
3.  **Render:** Update `LayoutConfig`. Trigger `calculateRuntimePositions` to update visual `_runtime`.

### C. Viewport Switching
1.  **Action:** User clicks "Mobile" (375x667).
2.  **Process:**
    *   Iterate all elements.
    *   Resolve parent hierarchies (Topological sort).
    *   Recalculate `_runtime` pixels based on `LayoutConfig` percentages/Viewports against the new screen size.
3.  **Result:** Elements "reflow" according to their responsive rules.

## 6. Component Responsibility

*   **`App.tsx`**: State holder. Manages the global `elements` array and `viewport`. Handles the "Recalculate on Viewport Change" effect.
*   **`Canvas.tsx`**: 
    *   **Editor Mode:** Renders flat, absolute `div`s. Handles mouse events for dragging/resizing. Calculates drop targets.
    *   **Preview Mode:** Renders nested DOM structure using CSS `position: absolute` to verify real-world CSS behavior.
*   **`PropertyPanel.tsx`**: Handles data mutation. Contains the logic for "Switch Unit without Moving" (circular conversion).
*   **`layoutUtils.ts`**: The math core.
    *   `convertOffsetToAbsolute`: DSL -> Pixels.
    *   `convertAbsoluteToOffset`: Pixels -> DSL.
    *   `calculateRuntimePositions`: The main layout engine loop.

## 7. Supported DSL Features (YAML Representation)

```yaml
- id: container-1
  type: rect
  name: Main Card
  layout:
    x: { value: 50, unit: 'vw' }      # Centered relative to viewport
    y: { value: 50, unit: 'vh' }
    width: { value: 300, unit: 'px' }
    height: { value: 400, unit: 'px' }
    anchorX: center
    anchorY: center
    isContainer: true

- id: button-1
  type: rect
  name: Submit Btn
  layout:
    x: { value: 0, unit: 'px' }
    y: { value: 20, unit: 'px' }      # 20px from bottom
    width: { value: 80, unit: '%p_w' } # 80% of parent width
    height: { value: 50, unit: 'px' }
    anchorX: center
    anchorY: bottom                   # Anchored to bottom edge
    isContainer: false
```
