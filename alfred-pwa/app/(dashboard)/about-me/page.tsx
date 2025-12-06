'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import TextArea from '@/components/ui/TextArea';

export default function AboutMePage() {
  const [aboutMe, setAboutMe] = useState('');
  const [originalAboutMe, setOriginalAboutMe] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('about_me')
        .eq('user_id', user.id)
        .single();

      if (data?.about_me) {
        setAboutMe(data.about_me);
        setOriginalAboutMe(data.about_me);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          about_me: aboutMe,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      setOriginalAboutMe(aboutMe);
      setMessage({ type: 'success', text: 'Profile saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = aboutMe !== originalAboutMe;

  return (
    <>
      <Header
        title="About Me"
        subtitle="Tell Alfred about yourself to get more personalized responses"
        actions={
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            loading={saving}
          >
            Save Changes
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          {message && (
            <div
              className={`mb-4 px-4 py-2 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                  : 'bg-red-500/10 border border-red-500/50 text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="bg-dark-card border border-dark-border rounded-xl p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-2">Your Profile</h2>
              <p className="text-gray-400 text-sm">
                Share information about yourself that will help Alfred better understand your context.
                Include details about your work, family, interests, goals, and anything else relevant.
              </p>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-dark-hover rounded w-3/4"></div>
                <div className="h-4 bg-dark-hover rounded w-1/2"></div>
                <div className="h-4 bg-dark-hover rounded w-5/6"></div>
              </div>
            ) : (
              <TextArea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                placeholder={`Example:

Professional Background:
- Role: VP of eCommerce and Revenue at Noble Investment Group
- Industry: Hospitality (manages digital strategy across 80+ hotels)
- Teaching: Adjunct faculty at Rochester Community and Technical College

Personal Context:
- Partner: Misa (in a committed relationship)
- Children: Ollie (12), Ryder, Naomi, Jade
- Interests: Photography, AI/automation, Revenue optimization

Communication Style:
- Uses humor to maintain connection during stress
- Values transparency and direct communication

Current Priorities:
- Career transition considerations
- Work-life integration
- Building legacy through teaching`}
                rows={20}
                className="font-mono text-sm"
              />
            )}

            <div className="mt-4 text-sm text-gray-500">
              <p>Tips for a great profile:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Include your professional role and key responsibilities</li>
                <li>Mention important relationships (family, colleagues)</li>
                <li>Share your communication style preferences</li>
                <li>List current priorities and goals</li>
                <li>Add any context that helps interpret your conversations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
