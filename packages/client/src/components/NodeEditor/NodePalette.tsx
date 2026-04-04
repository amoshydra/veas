import { useState } from 'react';
import { NODE_DEFINITIONS, NODE_CATEGORIES } from '../../types/nodeGraph.js';
import type { NodeType, NodeCategory } from '../../types/nodeGraph.js';
import { useNodeGraphStore } from '../../stores/nodeGraph.js';
import { v4 as uuidv4 } from 'uuid';

export default function NodePalette() {
  const [expandedCategory, setExpandedCategory] = useState<NodeCategory | null>('input-output');
  const store = useNodeGraphStore();

  const handleAddNode = (type: NodeType) => {
    const def = NODE_DEFINITIONS[type];
    const newNode = {
      id: uuidv4(),
      type,
      position: {
        x: 200 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      },
      data: {
        config: { ...def.defaultConfig },
        status: 'idle' as const,
        definition: def,
      },
    };
    store.addNode(newNode);
  };

  const categories: NodeCategory[] = ['input-output', 'transform', 'filter', 'audio', 'advanced'];

  return (
    <div className="w-[200px] border-r border-slate-700 bg-slate-900 flex flex-col h-full">
      <div className="p-3 border-b border-slate-700">
        <h3 className="font-semibold text-sm text-slate-200">Node Palette</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {categories.map((cat) => (
          <div key={cat} className="border-b border-slate-800">
            <button
              onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
              className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-slate-800 flex items-center justify-between"
            >
              <span>{NODE_CATEGORIES[cat]}</span>
              <span className="text-slate-600">{expandedCategory === cat ? '▼' : '▶'}</span>
            </button>
            {expandedCategory === cat && (
              <div className="px-2 pb-2 space-y-1">
                {Object.values(NODE_DEFINITIONS)
                  .filter((def) => def.category === cat)
                  .map((def) => (
                    <button
                      key={def.type}
                      onClick={() => def.implemented && handleAddNode(def.type)}
                      disabled={!def.implemented}
                      className={`w-full px-2 py-1.5 text-left text-sm rounded flex items-center gap-2 transition-colors ${
                        def.implemented
                          ? 'text-slate-300 hover:bg-slate-700'
                          : 'text-slate-500 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span>{def.icon}</span>
                      <span>{def.label}</span>
                      {!def.implemented && <span className="text-[10px] text-slate-600 ml-auto">soon</span>}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
