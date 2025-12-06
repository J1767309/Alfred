'use client';

import { Entity } from '@/types/database';
import Card from '@/components/ui/Card';

interface EntityCardProps {
  entity: Entity;
  onClick: () => void;
  onDelete: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  person: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  organization: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  place: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  other: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
};

const typeColors: Record<string, string> = {
  person: 'bg-blue-500/20 text-blue-400',
  organization: 'bg-purple-500/20 text-purple-400',
  place: 'bg-green-500/20 text-green-400',
  other: 'bg-gray-500/20 text-gray-400',
};

export default function EntityCard({ entity, onClick, onDelete }: EntityCardProps) {
  return (
    <Card hover className="p-4 overflow-hidden">
      <div className="flex items-start gap-3">
        <div
          className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={onClick}
        >
          <div className={`p-2 rounded-lg shrink-0 ${typeColors[entity.type]}`}>
            {typeIcons[entity.type]}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="font-medium text-white truncate" title={entity.name}>
              {entity.name}
            </h3>
            {entity.relationship && (
              <p className="text-sm text-gray-400 truncate" title={entity.relationship}>
                {entity.relationship}
              </p>
            )}
            {entity.notes && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{entity.notes}</p>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-gray-500 hover:text-red-400 transition shrink-0"
          title="Delete entity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </Card>
  );
}
