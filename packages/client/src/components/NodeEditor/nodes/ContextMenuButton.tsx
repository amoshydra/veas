import { useContextMenu } from './useContextMenu.js';
import { NodeContextMenu } from './NodeContextMenu.js';
import { useNodeGraphStore } from '../../../stores/nodeGraph.js';

interface ContextMenuButtonProps {
  nodeId: string;
}

export function ContextMenuButton({ nodeId }: ContextMenuButtonProps) {
  const store = useNodeGraphStore();
  const { isOpen, toggle, close, menuRef } = useContextMenu();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="text-slate-400 hover:text-slate-200 p-1 rounded"
        title="More options"
      >
        <span className="text-xs">⋮</span>
      </button>
      {isOpen && (
        <NodeContextMenu
          nodeId={nodeId}
          onDelete={(id) => { store.removeNode(id); close(); }}
          onClose={close}
        />
      )}
    </div>
  );
}
