/**
 * User Profile Component
 * Provides interface for managing user identity, authentication, and security settings
 */

import React, { useState, useEffect } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonList,
  IonInput,
  IonText,
  IonToggle,
  IonIcon,
  IonAlert,
  IonBadge,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonProgressBar
} from '@ionic/react';
import {
  person,
  shield,
  key,
  fingerPrint,
  lockClosed,
  lockOpen,
  settingsOutline,
  refresh,
  copy,
  checkmark,
  warning,
  eye,
  eyeOff,
  save,
  time,
  moon,
  sunny,
  contrastOutline
} from 'ionicons/icons';

import { useResQLinkStore } from '../lib/store';

interface SecurityLevel {
  level: 'basic' | 'standard' | 'advanced' | 'maximum';
  label: string;
  description: string;
  features: string[];
}

const SECURITY_LEVELS: SecurityLevel[] = [
  {
    level: 'basic',
    label: 'Basic Security',
    description: 'Minimum security for casual use',
    features: ['User alias', 'Basic encryption', 'Peer identification']
  },
  {
    level: 'standard',
    label: 'Standard Security',
    description: 'Recommended for most users',
    features: ['Strong encryption', 'Key rotation', 'Contact verification', 'Session management']
  },
  {
    level: 'advanced',
    label: 'Advanced Security',
    description: 'Enhanced security for sensitive communications',
    features: ['Perfect forward secrecy', 'Advanced key management', 'Trust verification', 'Audit logs']
  },
  {
    level: 'maximum',
    label: 'Maximum Security',
    description: 'Maximum security for high-risk scenarios',
    features: ['Paranoid mode', 'Ephemeral keys', 'Zero knowledge', 'Plausible deniability']
  }
];

export const UserProfile: React.FC = () => {
  const {
    keyPair,
    isInitialized,
    settings,
    initializeNode,
    updateSettings,
    setTheme,
    meshStatus
  } = useResQLinkStore();

  // Component state
  const [showKeyDetails, setShowKeyDetails] = useState(false);
  const [showRegenerateAlert, setShowRegenerateAlert] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [editingAlias, setEditingAlias] = useState(false);
  const [tempAlias, setTempAlias] = useState(settings.userAlias);
  const [selectedSecurityLevel, setSelectedSecurityLevel] = useState<SecurityLevel['level']>('standard');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Security metrics
  const [securityScore, setSecurityScore] = useState(0);
  const [lastKeyRotation, setLastKeyRotation] = useState<Date | null>(null);

  useEffect(() => {
    // Calculate security score based on current configuration
    let score = 0;
    if (isInitialized && keyPair) score += 25;
    if (settings.userAlias !== 'Anonymous') score += 15;
    if (keyPair?.createdAt && Date.now() - keyPair.createdAt < 30 * 24 * 60 * 60 * 1000) score += 20; // Keys less than 30 days old
    if (meshStatus.peerCount > 0) score += 20;
    if (settings.gatewayEnabled) score += 10;
    if (settings.includeLocationDefault === false) score += 10; // Privacy consideration

    setSecurityScore(Math.min(score, 100));

    // Check last key rotation
    if (keyPair?.createdAt) {
      setLastKeyRotation(new Date(keyPair.createdAt));
    }
  }, [keyPair, settings, meshStatus, isInitialized]);

  const handleSaveAlias = () => {
    if (tempAlias.trim()) {
      updateSettings({ userAlias: tempAlias.trim() });
      setEditingAlias(false);
    }
  };

  const handleRegenerateKeys = async () => {
    try {
      await initializeNode();
      setShowRegenerateAlert(false);
      setLastKeyRotation(new Date());
    } catch (error) {
      console.error('Failed to regenerate keys:', error);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatKeyDisplay = (key: string, showFull: boolean = false): string => {
    if (!key) return 'Not available';
    if (showFull) return key;
    return `${key.substring(0, 8)}...${key.substring(key.length - 8)}`;
  };

  const getSecurityLevelColor = (level: SecurityLevel['level']): string => {
    switch (level) {
      case 'basic': return 'warning';
      case 'standard': return 'primary';
      case 'advanced': return 'success';
      case 'maximum': return 'dark';
      default: return 'medium';
    }
  };

  const getSecurityScoreColor = (): string => {
    if (securityScore >= 80) return 'success';
    if (securityScore >= 60) return 'warning';
    return 'danger';
  };

  const renderIdentitySection = () => (
    <IonCard>
      <IonCardHeader>
        <IonCardTitle>
          <IonIcon icon={person} className="ion-margin-end" />
          User Identity
        </IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <IonList>
          {/* User Alias */}
          <IonItem>
            <IonIcon icon={person} slot="start" />
            <IonLabel position="stacked">Display Name</IonLabel>
            {editingAlias ? (
              <IonInput
                value={tempAlias}
                onIonInput={(e) => setTempAlias(e.detail.value!)}
                placeholder="Enter your display name"
                maxlength={32}
              />
            ) : (
              <IonText>{settings.userAlias}</IonText>
            )}
            <IonButton
              fill="clear"
              slot="end"
              onClick={editingAlias ? handleSaveAlias : () => setEditingAlias(true)}
            >
              <IonIcon icon={editingAlias ? save : settingsOutline} />
            </IonButton>
          </IonItem>

          {/* Service ID */}
          <IonItem>
            <IonIcon icon={fingerPrint} slot="start" />
            <IonLabel>
              <h3>Service ID</h3>
              <p>{meshStatus.serviceId || 'Not initialized'}</p>
            </IonLabel>
            <IonButton
              fill="clear"
              slot="end"
              onClick={() => copyToClipboard(meshStatus.serviceId || '', 'serviceId')}
              disabled={!meshStatus.serviceId}
            >
              <IonIcon icon={copySuccess === 'serviceId' ? checkmark : copy} />
            </IonButton>
          </IonItem>

          {/* Initialization Status */}
          <IonItem>
            <IonIcon icon={isInitialized ? lockClosed : lockOpen} slot="start" />
            <IonLabel>
              <h3>Identity Status</h3>
              <p>{isInitialized ? 'Initialized and secured' : 'Not initialized'}</p>
            </IonLabel>
            <IonBadge color={isInitialized ? 'success' : 'danger'}>
              {isInitialized ? 'Secure' : 'Unsecured'}
            </IonBadge>
          </IonItem>

          {/* Initialize Button */}
          {!isInitialized && (
            <IonItem>
              <IonButton
                expand="block"
                color="primary"
                onClick={initializeNode}
              >
                <IonIcon icon={key} slot="start" />
                Initialize Secure Identity
              </IonButton>
            </IonItem>
          )}
        </IonList>
      </IonCardContent>
    </IonCard>
  );

  const renderSecuritySection = () => (
    <IonCard>
      <IonCardHeader>
        <IonCardTitle>
          <IonIcon icon={shield} className="ion-margin-end" />
          Security Status
        </IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <IonList>
          {/* Security Score */}
          <IonItem>
            <IonIcon icon={shield} slot="start" />
            <IonLabel>
              <h3>Security Score</h3>
              <p>Overall security assessment</p>
              <IonProgressBar
                value={securityScore / 100}
                color={getSecurityScoreColor()}
                className="ion-margin-top"
              />
              <IonText color={getSecurityScoreColor()}>
                <small>{securityScore}/100 - {
                  securityScore >= 80 ? 'Excellent' :
                  securityScore >= 60 ? 'Good' :
                  securityScore >= 40 ? 'Fair' : 'Poor'
                }</small>
              </IonText>
            </IonLabel>
          </IonItem>

          {/* Last Key Rotation */}
          <IonItem>
            <IonIcon icon={time} slot="start" />
            <IonLabel>
              <h3>Key Age</h3>
              <p>
                {lastKeyRotation
                  ? `Keys generated ${lastKeyRotation.toLocaleDateString()}`
                  : 'No keys generated'
                }
              </p>
            </IonLabel>
            {lastKeyRotation && (
              <IonChip
                color={
                  Date.now() - lastKeyRotation.getTime() > 30 * 24 * 60 * 60 * 1000
                    ? 'warning'
                    : 'success'
                }
              >
                {
                  Date.now() - lastKeyRotation.getTime() > 30 * 24 * 60 * 60 * 1000
                    ? 'Aging'
                    : 'Fresh'
                }
              </IonChip>
            )}
          </IonItem>

          {/* Connected Peers */}
          <IonItem>
            <IonIcon icon={person} slot="start" />
            <IonLabel>
              <h3>Network Status</h3>
              <p>{meshStatus.peerCount} connected peers</p>
            </IonLabel>
            <IonBadge color={meshStatus.peerCount > 0 ? 'success' : 'medium'}>
              {meshStatus.peerCount > 0 ? 'Connected' : 'Isolated'}
            </IonBadge>
          </IonItem>

          {/* Security Settings Button */}
          <IonItem button onClick={() => setShowSecurityModal(true)}>
            <IonIcon icon={settingsOutline} slot="start" />
            <IonLabel>
              <h3>Security Settings</h3>
              <p>Configure security level and preferences</p>
            </IonLabel>
          </IonItem>
        </IonList>
      </IonCardContent>
    </IonCard>
  );

  const renderCryptographicKeys = () => (
    <IonCard>
      <IonCardHeader>
        <IonCardTitle>
          <IonIcon icon={key} className="ion-margin-end" />
          Cryptographic Keys
        </IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <IonList>
          {/* Key Visibility Toggle */}
          <IonItem>
            <IonIcon icon={showKeyDetails ? eye : eyeOff} slot="start" />
            <IonLabel>Show Key Details</IonLabel>
            <IonToggle
              checked={showKeyDetails}
              onIonChange={(e) => setShowKeyDetails(e.detail.checked)}
            />
          </IonItem>

          {keyPair && (
            <>
              {/* Ed25519 Public Key */}
              <IonItem>
                <IonIcon icon={key} slot="start" />
                <IonLabel>
                  <h3>Signing Key (Public)</h3>
                  <p className="ion-text-wrap">
                    {formatKeyDisplay(keyPair.ed25519Pub, showKeyDetails)}
                  </p>
                </IonLabel>
                <IonButton
                  fill="clear"
                  slot="end"
                  onClick={() => copyToClipboard(keyPair.ed25519Pub, 'ed25519Pub')}
                >
                  <IonIcon icon={copySuccess === 'ed25519Pub' ? checkmark : copy} />
                </IonButton>
              </IonItem>

              {/* X25519 Public Key */}
              <IonItem>
                <IonIcon icon={lockClosed} slot="start" />
                <IonLabel>
                  <h3>Encryption Key (Public)</h3>
                  <p className="ion-text-wrap">
                    {formatKeyDisplay(keyPair.x25519Pub, showKeyDetails)}
                  </p>
                </IonLabel>
                <IonButton
                  fill="clear"
                  slot="end"
                  onClick={() => copyToClipboard(keyPair.x25519Pub, 'x25519Pub')}
                >
                  <IonIcon icon={copySuccess === 'x25519Pub' ? checkmark : copy} />
                </IonButton>
              </IonItem>

              {/* Key Actions */}
              <IonItem>
                <IonButton
                  expand="block"
                  fill="outline"
                  color="warning"
                  onClick={() => setShowRegenerateAlert(true)}
                >
                  <IonIcon icon={refresh} slot="start" />
                  Regenerate Keys
                </IonButton>
              </IonItem>
            </>
          )}

          {!keyPair && (
            <IonItem>
              <IonIcon icon={warning} slot="start" color="warning" />
              <IonLabel>
                <h3>No Keys Available</h3>
                <p>Initialize your identity to generate cryptographic keys</p>
              </IonLabel>
            </IonItem>
          )}
        </IonList>
      </IonCardContent>
    </IonCard>
  );

  const renderSecurityModal = () => (
    <IonModal isOpen={showSecurityModal} onDidDismiss={() => setShowSecurityModal(false)}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Security Settings</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowSecurityModal(false)}>
              <IonIcon icon={checkmark} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem>
            <IonLabel>
              <h2>Security Level</h2>
              <p>Choose your preferred security configuration</p>
            </IonLabel>
          </IonItem>

          {SECURITY_LEVELS.map((level) => (
            <IonItem key={level.level}>
              <IonLabel>
                <h3>{level.label}</h3>
                <p>{level.description}</p>
                <div className="ion-margin-top">
                  {level.features.map((feature, index) => (
                    <IonChip key={index} color={getSecurityLevelColor(level.level)}>
                      <IonLabel>{feature}</IonLabel>
                    </IonChip>
                  ))}
                </div>
              </IonLabel>
              <IonToggle
                checked={selectedSecurityLevel === level.level}
                onIonChange={(e) => e.detail.checked && setSelectedSecurityLevel(level.level)}
              />
            </IonItem>
          ))}

          {/* Theme Settings */}
          <IonItem>
            <IonLabel>
              <h2>Appearance</h2>
              <p>Choose your preferred theme</p>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonIcon
              icon={
                settings.theme === 'light' ? sunny :
                settings.theme === 'dark' ? moon :
                contrastOutline
              }
              slot="start"
            />
            <IonLabel>
              <h3>Theme</h3>
              <p>
                {settings.theme === 'light' ? 'Light Mode' :
                 settings.theme === 'dark' ? 'Dark Mode' :
                 'Auto (System)'}
              </p>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonLabel>Light</IonLabel>
            <IonIcon icon={sunny} slot="start" />
            <IonToggle
              checked={settings.theme === 'light'}
              onIonChange={(e) => e.detail.checked && setTheme('light')}
            />
          </IonItem>

          <IonItem>
            <IonLabel>Dark</IonLabel>
            <IonIcon icon={moon} slot="start" />
            <IonToggle
              checked={settings.theme === 'dark'}
              onIonChange={(e) => e.detail.checked && setTheme('dark')}
            />
          </IonItem>

          <IonItem>
            <IonLabel>Auto (Follow System)</IonLabel>
            <IonIcon icon={contrastOutline} slot="start" />
            <IonToggle
              checked={settings.theme === 'auto'}
              onIonChange={(e) => e.detail.checked && setTheme('auto')}
            />
          </IonItem>

          {/* High Contrast Mode */}
          <IonItem>
            <IonIcon icon={contrastOutline} slot="start" />
            <IonLabel>
              <h3>High Contrast Mode</h3>
              <p>Enhanced contrast for accessibility</p>
            </IonLabel>
            <IonToggle
              checked={settings.highContrast}
              onIonChange={(e) => updateSettings({ highContrast: e.detail.checked })}
            />
          </IonItem>

          {/* Privacy Settings */}
          <IonItem>
            <IonIcon icon={shield} slot="start" />
            <IonLabel>Include Location by Default</IonLabel>
            <IonToggle
              checked={settings.includeLocationDefault}
              onIonChange={(e) => updateSettings({ includeLocationDefault: e.detail.checked })}
            />
          </IonItem>

          {/* Gateway Settings */}
          <IonItem>
            <IonIcon icon={settingsOutline} slot="start" />
            <IonLabel>Gateway Uplink</IonLabel>
            <IonToggle
              checked={settings.gatewayEnabled}
              onIonChange={(e) => updateSettings({ gatewayEnabled: e.detail.checked })}
            />
          </IonItem>
        </IonList>
      </IonContent>
    </IonModal>
  );

  return (
    <>
      <IonGrid>
        <IonRow>
          <IonCol size="12">
            {renderIdentitySection()}
          </IonCol>
        </IonRow>

        <IonRow>
          <IonCol size="12">
            {renderSecuritySection()}
          </IonCol>
        </IonRow>

        <IonRow>
          <IonCol size="12">
            {renderCryptographicKeys()}
          </IonCol>
        </IonRow>
      </IonGrid>

      {/* Key Regeneration Alert */}
      <IonAlert
        isOpen={showRegenerateAlert}
        onDidDismiss={() => setShowRegenerateAlert(false)}
        header="Regenerate Keys"
        subHeader="Security Warning"
        message="Regenerating keys will create a new cryptographic identity. Other users will need to re-verify your identity. Continue?"
        buttons={[
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Regenerate',
            role: 'destructive',
            handler: handleRegenerateKeys
          }
        ]}
      />

      {/* Security Settings Modal */}
      {renderSecurityModal()}
    </>
  );
};

export default UserProfile;