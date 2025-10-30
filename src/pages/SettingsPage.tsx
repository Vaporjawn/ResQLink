/**
 * SettingsPage Component
 * Provides user settings and preferences
 */

import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonListHeader,
  IonNote,
  IonIcon,
  IonInput,
  IonText
} from '@ionic/react';
import {
  contrastOutline,
  moonOutline,
  textOutline,
  accessibilityOutline,
  globeOutline,
  locationOutline,
  personOutline
} from 'ionicons/icons';
import { useResQLinkStore } from '../lib/store';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
  const settings = useResQLinkStore(state => state.settings);
  const updateSettings = useResQLinkStore(state => state.updateSettings);
  const [aliasError, setAliasError] = useState<string>('');

  const handleAliasChange = (value: string) => {
    // Validate display name
    if (value.trim().length === 0) {
      setAliasError('Display name cannot be empty');
    } else if (value.length > 50) {
      setAliasError('Display name must be 50 characters or less');
    } else {
      setAliasError('');
      updateSettings({ userAlias: value });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonList>
          {/* Profile Settings */}
          <IonListHeader>
            <IonIcon icon={personOutline} slot="start" aria-hidden="true" />
            <IonLabel>Profile</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel position="stacked">Display Name</IonLabel>
            <IonInput
              value={settings.userAlias}
              onIonInput={(e) => handleAliasChange(e.detail.value!)}
              placeholder="Enter your display name"
              aria-label="Display name input"
              aria-invalid={!!aliasError}
              aria-describedby={aliasError ? "alias-error" : undefined}
            />
            {aliasError && (
              <IonText id="alias-error" color="danger" role="alert" aria-live="assertive">
                <p className="ion-padding-start">{aliasError}</p>
              </IonText>
            )}
          </IonItem>

          {/* Accessibility Settings */}
          <IonListHeader>
            <IonIcon icon={accessibilityOutline} slot="start" aria-hidden="true" />
            <IonLabel>Accessibility</IonLabel>
          </IonListHeader>

          <IonItem>
            <IonIcon icon={contrastOutline} slot="start" aria-hidden="true" />
            <IonLabel>
              <h2>High Contrast Mode</h2>
              <p>Increase color contrast and border visibility</p>
            </IonLabel>
            <IonToggle
              checked={settings.highContrast}
              onIonChange={(e) => updateSettings({ highContrast: e.detail.checked })}
              aria-label="Toggle high contrast mode"
            />
          </IonItem>

          <IonItem>
            <IonIcon icon={moonOutline} slot="start" aria-hidden="true" />
            <IonLabel>
              <h2>Theme</h2>
              <p>Choose your preferred theme</p>
            </IonLabel>
            <IonSelect
              value={settings.theme}
              onIonChange={(e) => updateSettings({ theme: e.detail.value })}
              interface="popover"
              aria-label="Select theme preference"
            >
              <IonSelectOption value="light">Light</IonSelectOption>
              <IonSelectOption value="dark">Dark</IonSelectOption>
              <IonSelectOption value="auto">Auto (System)</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonIcon icon={textOutline} slot="start" aria-hidden="true" />
            <IonLabel>
              <h2>Font Size</h2>
              <p>Adjust text size for better readability</p>
            </IonLabel>
            <IonSelect
              value={settings.fontSize}
              onIonChange={(e) => updateSettings({ fontSize: e.detail.value })}
              interface="popover"
              aria-label="Select font size"
            >
              <IonSelectOption value="small">Small</IonSelectOption>
              <IonSelectOption value="medium">Medium</IonSelectOption>
              <IonSelectOption value="large">Large</IonSelectOption>
              <IonSelectOption value="xlarge">Extra Large</IonSelectOption>
              <IonSelectOption value="xxlarge">XXL</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem lines="none">
            <IonNote color="medium" className="ion-padding-top">
              <p>
                <strong>Accessibility Features:</strong>
              </p>
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li>High contrast mode improves visibility for low vision users</li>
                <li>All interactive elements support keyboard navigation</li>
                <li>Screen reader compatible with ARIA labels</li>
                <li>Respects system "reduce motion" preference</li>
              </ul>
            </IonNote>
          </IonItem>

          {/* General Settings */}
          <IonListHeader>
            <IonIcon icon={globeOutline} slot="start" aria-hidden="true" />
            <IonLabel>General</IonLabel>
          </IonListHeader>

          <IonItem>
            <IonLabel>
              <h2>Language</h2>
              <p>Choose your preferred language</p>
            </IonLabel>
            <IonSelect
              value={settings.language}
              onIonChange={(e) => updateSettings({ language: e.detail.value })}
              interface="popover"
              aria-label="Select language preference"
            >
              <IonSelectOption value="en">English</IonSelectOption>
              <IonSelectOption value="ur">Urdu (اردو)</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonIcon icon={locationOutline} slot="start" aria-hidden="true" />
            <IonLabel>
              <h2>Include Location by Default</h2>
              <p>Automatically attach your location to messages</p>
            </IonLabel>
            <IonToggle
              checked={settings.includeLocationDefault}
              onIonChange={(e) => updateSettings({ includeLocationDefault: e.detail.checked })}
              aria-label="Toggle include location by default"
            />
          </IonItem>
        </IonList>

        <div className="settings-footer ion-padding" role="contentinfo">
          <IonNote color="medium">
            <p>ResQLink v1.0.0 - Mesh Communication</p>
            <p>Built for emergency response and disaster relief</p>
          </IonNote>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
