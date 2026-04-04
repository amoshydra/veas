import { useState, useRef, useEffect } from 'react';

interface ContextMenuProps {
  nodeId: string;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function NodeContextMenu({ nodeId, onDelete, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-2 top-8 z-50 min-w-[120px] bg-slate-700 border border-slate-600 rounded-lg shadow-lg overflow-hidden"
    >
      <button
        onClick={() => onDelete(nodeId)}
        className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/20 transition-colors"
      >
        Delete node
      </button>
    </div>
  );
}
