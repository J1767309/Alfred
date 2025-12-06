'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Entity, EntityType } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EntityForm from '@/components/entities/EntityForm';
import EntityCard from '@/components/entities/EntityCard';

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | undefined>(undefined);
  const [filter, setFilter] = useState<EntityType | 'all'>('all');
  const supabase = createClient();

  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error loading entities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: {
    name: string;
    type: EntityType;
    relationship: string;
    notes: string;
    context: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (editingEntity) {
      const { error } = await supabase
        .from('entities')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingEntity.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('entities')
        .insert({
          ...data,
          user_id: user.id,
        });

      if (error) throw error;
    }

    setIsModalOpen(false);
    setEditingEntity(undefined);
    loadEntities();
  };

  const handleDelete = async (entity: Entity) => {
    if (!confirm(`Are you sure you want to delete "${entity.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('entities')
        .delete()
        .eq('id', entity.id);

      if (error) throw error;
      loadEntities();
    } catch (error) {
      console.error('Error deleting entity:', error);
    }
  };

  const handleEdit = (entity: Entity) => {
    setEditingEntity(entity);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntity(undefined);
  };

  const filteredEntities = filter === 'all'
    ? entities
    : entities.filter(e => e.type === filter);

  const groupedEntities = {
    person: filteredEntities.filter(e => e.type === 'person'),
    organization: filteredEntities.filter(e => e.type === 'organization'),
    place: filteredEntities.filter(e => e.type === 'place'),
    other: filteredEntities.filter(e => e.type === 'other'),
  };

  return (
    <>
      <Header
        title="Entities"
        subtitle="People, organizations, and places Alfred should know about"
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Entity
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Filter tabs */}
        <div className="flex space-x-2 mb-6">
          {(['all', 'person', 'organization', 'place', 'other'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === type
                  ? 'bg-alfred-primary text-white'
                  : 'bg-dark-card text-gray-400 hover:text-white'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              <span className="ml-2 text-xs opacity-70">
                ({type === 'all' ? entities.length : groupedEntities[type].length})
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-dark-hover rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-dark-hover rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-dark-hover rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No entities yet</h3>
            <p className="text-gray-400 mb-4">
              Add people, organizations, and places that Alfred should know about
            </p>
            <Button onClick={() => setIsModalOpen(true)}>Add Your First Entity</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntities.map((entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                onClick={() => handleEdit(entity)}
                onDelete={() => handleDelete(entity)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingEntity ? 'Edit Entity' : 'Add Entity'}
        size="lg"
      >
        <EntityForm
          entity={editingEntity}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
        />
      </Modal>
    </>
  );
}
