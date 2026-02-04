import React, { useState } from 'react';
import { LayoutElement } from '../types';
import { Layers, GripVertical, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface LayerPanelProps {
  elements: LayoutElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (sortedIds: string[]) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  elements,
  selectedId,
  onSelect,
  onReorder
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Sort by zIndex descending (Visually Top first)
  // Higher zIndex = Closer to user = Top of list
  const sortedElements = [...elements].sort((a, b) => (b.layout.zIndex || 0) - (a.layout.zIndex || 0));

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId === targetId) return;

    // Create new order
    const fromIndex = sortedElements.findIndex(el => el.id === draggedId);
    const toIndex = sortedElements.findIndex(el => el.id === targetId);
    
    if (fromIndex === -1 || toIndex === -1) return;

    const newList = [...sortedElements];
    const [movedItem] = newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, movedItem);
    
    // Pass just the IDs in the new order
    onReorder(newList.map(el => el.id));
  };

  if (!isExpanded) {
      return (
        <button
            onClick={() => setIsExpanded(true)}
            className="w-10 h-10 bg-gray-900 border border-gray-800 rounded-lg shadow-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors pointer-events-auto"
            title="Show Layers"
        >
            <Layers size={20} />
        </button>
      );
  }

  return (
    <div className="w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-xl flex flex-col max-h-[300px] pointer-events-auto transition-all duration-200">
        <div 
            className="p-2 border-b border-gray-800 bg-gray-800/50 flex items-center gap-2 shrink-0 cursor-pointer hover:bg-gray-800/80 transition-colors"
            onClick={() => setIsExpanded(false)}
        >
            <Layers size={14} className="text-gray-400"/>
            <span className="text-xs font-bold text-gray-300">Layers</span>
            <span className="text-[10px] text-gray-500 ml-auto bg-black/20 px-1.5 py-0.5 rounded-full">{elements.length}</span>
            <ChevronDown size={14} className="text-gray-500" />
        </div>
        <div className="overflow-y-auto flex-1 p-1 space-y-0.5 custom-scrollbar">
            {sortedElements.map(el => (
                <div 
                    key={el.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, el.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, el.id)}
                    onClick={() => onSelect(el.id)}
                    className={clsx(
                        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs group border border-transparent select-none transition-colors",
                        selectedId === el.id 
                            ? "bg-blue-600/20 text-blue-200 border-blue-500/30" 
                            : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                    )}
                >
                    <GripVertical size={12} className={clsx("cursor-grab opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-400", selectedId === el.id && "opacity-50")} />
                    <span className="truncate flex-1 font-medium">{el.name}</span>
                    <span className="text-[9px] opacity-40 font-mono bg-black/20 px-1 rounded">z:{el.layout.zIndex}</span>
                </div>
            ))}
            {sortedElements.length === 0 && (
                <div className="p-4 text-center text-xs text-gray-600 italic">No elements</div>
            )}
        </div>
    </div>
  )
}