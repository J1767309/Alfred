'use client';

import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import Button from '@/components/ui/Button';

export default function NotificationToggle() {
  const { isSupported, isSubscribed, error, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center space-x-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-white">Push Notifications</p>
        <p className="text-xs text-gray-400">
          {isSubscribed
            ? 'Receive notifications for daily summaries'
            : 'Enable to get notified when summaries are ready'}
        </p>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
      <Button
        variant={isSubscribed ? 'secondary' : 'primary'}
        size="sm"
        onClick={isSubscribed ? unsubscribe : subscribe}
      >
        {isSubscribed ? 'Disable' : 'Enable'}
      </Button>
    </div>
  );
}
