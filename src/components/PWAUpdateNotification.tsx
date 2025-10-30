import React, { useEffect, useState } from 'react';
import { IonToast } from '@ionic/react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWAUpdateNotification Component
 *
 * Displays a notification when a new version of the PWA is available,
 * allowing users to update the app without losing data.
 *
 * Features:
 * - Auto-detects service worker updates
 * - Shows user-friendly update notification
 * - Allows graceful update with "Update" button
 * - Handles automatic refresh after update
 */
const PWAUpdateNotification: React.FC = () => {
  const [showUpdateToast, setShowUpdateToast] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration: ServiceWorkerRegistration | undefined) {
      console.log('Service Worker registered:', registration);

      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // 1 hour
      }
    },
    onRegisterError(error: unknown) {
      console.error('Service Worker registration error:', error);
    },
    onNeedRefresh() {
      setShowUpdateToast(true);
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowUpdateToast(true);
    }
  }, [needRefresh]);

  const handleUpdate = async () => {
    setShowUpdateToast(false);
    await updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setShowUpdateToast(false);
    setNeedRefresh(false);
  };

  return (
    <IonToast
      isOpen={showUpdateToast}
      message="New version available! Update now for the latest features."
      position="top"
      color="primary"
      duration={0} // Don't auto-dismiss
      buttons={[
        {
          text: 'Update',
          role: 'update',
          handler: handleUpdate
        },
        {
          text: 'Later',
          role: 'cancel',
          handler: handleDismiss
        }
      ]}
    />
  );
};

export default PWAUpdateNotification;
