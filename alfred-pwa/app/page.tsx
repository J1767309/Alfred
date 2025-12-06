import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Redirect to today's conversations
    const today = format(new Date(), 'yyyy-MM-dd');
    redirect(`/conversations/date/${today}`);
  } else {
    redirect('/login');
  }
}
