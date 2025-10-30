import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonList,
  IonInput,
  IonButton,
  IonIcon,
  IonBadge,
  IonFab,
  IonFabButton,
  IonAlert,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import { send, warning, wifi, people as peopleIcon } from 'ionicons/icons';
import { useResQLinkStore } from '../lib/store';
import { MeshNetworkManager } from '../lib/mesh';
import { MsgType } from '../lib/schema';
import './MessagesPage.css';

const MessagesPage: React.FC = () => {
  const store = useResQLinkStore();
  const [newMessage, setNewMessage] = useState('');
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);
  const [meshManager] = useState(() => new MeshNetworkManager());

  // Initialize mesh networking on component mount
  useEffect(() => {
    const initializeMesh = async () => {
      try {
        await meshManager.initialize({
          serviceName: 'resqlink-mesh',
          displayName: store.settings.userAlias || 'ResQLink User',
          maxConnections: 8,
          discoveryTimeout: 30000,
          connectionTimeout: 15000,
          enableAutoReconnect: true,
          strategy: 'hybrid' as const
        });
        await meshManager.startDiscovery();
      } catch (error) {
        console.error('Failed to initialize mesh networking:', error);
      }
    };

    initializeMesh();

    return () => {
      meshManager.stopDiscovery();
    };
  }, [meshManager, store.settings.userAlias]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await store.sendMessage(
        'TEXT',
        { text: newMessage.trim() },
        [] // Broadcast to all contacts - empty array means broadcast
      );
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const sendEmergencyAlert = async () => {
    try {
      const location = store.currentLocation;
      await store.sendMessage(
        'SOS',
        {
          text: 'Emergency assistance needed at current location',
          lat: location?.lat,
          lon: location?.lon
        },
        [] // Broadcast to all contacts
      );
      setShowEmergencyAlert(false);
    } catch (error) {
      console.error('Failed to send emergency alert:', error);
    }
  };

  const getMessageTypeColor = (type: MsgType) => {
    switch (type) {
      case 'SOS': return 'danger';
      case 'RESOURCE': return 'warning';
      case 'TEXT': return 'medium';
      case 'ACK': return 'dark';
      default: return 'medium';
    }
  };

  const getMessageTypeIcon = (type: MsgType) => {
    switch (type) {
      case 'SOS': return warning;
      case 'RESOURCE': return peopleIcon;
      default: return send;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getDeliveryStatusText = (status: string) => {
    switch (status) {
      case 'acked': return '✓ Delivered';
      case 'sent': return '→ Sent';
      case 'relayed': return '↻ Relayed';
      case 'failed': return '✗ Failed';
      default: return '⏳ Queued';
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>ResQLink Mesh</IonTitle>
          <IonBadge slot="end" color={store.meshStatus.active ? 'success' : 'warning'} aria-label={`Network ${store.meshStatus.active ? 'connected' : 'disconnected'}, ${store.meshStatus.peerCount} peers online`}>
            <IonIcon icon={wifi} aria-hidden="true" />
            {store.meshStatus.peerCount} peers
          </IonBadge>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        {/* Pull to Refresh */}
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (event) => {
            // Simulate refresh - re-discover peers
            await meshManager.stopDiscovery();
            await new Promise(resolve => setTimeout(resolve, 1000));
            await meshManager.startDiscovery();
            event.detail.complete();
          }}
        >
          <IonRefresherContent
            pullingIcon="chevron-down-circle-outline"
            pullingText="Pull to refresh network"
            refreshingSpinner="crescent"
            refreshingText="Refreshing..."
          />
        </IonRefresher>

        {/* Network Status Card */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Network Status</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div className="network-status">
              <IonChip color={store.meshStatus.active ? 'success' : 'danger'} aria-label={`Network status: ${store.meshStatus.active ? 'Connected' : 'Offline'}`}>
                <IonIcon icon={wifi} aria-hidden="true" />
                <IonLabel>
                  {store.meshStatus.active ? 'Connected' : 'Offline'}
                </IonLabel>
              </IonChip>
              <IonChip color="medium" aria-label={`${store.meshStatus.peerCount} peers online`}>
                <IonIcon icon={peopleIcon} aria-hidden="true" />
                <IonLabel>{store.meshStatus.peerCount} Peers</IonLabel>
              </IonChip>
              <IonChip color="medium" aria-label={`${Object.keys(store.contacts).length} contacts available`}>
                <IonLabel>{Object.keys(store.contacts).length} Contacts</IonLabel>
              </IonChip>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Messages List */}
        <IonList>
          {store.messages.length === 0 ? (
            <IonItem>
              <IonLabel>
                <h2>No messages yet</h2>
                <p>Send your first message or emergency alert below</p>
              </IonLabel>
            </IonItem>
          ) : (
            store.messages
              .sort((a, b) => b.localTimestamp - a.localTimestamp)
              .slice(0, 20) // Show last 20 messages
              .map((message) => (
                <IonItem key={message.packet.id} aria-label={`${message.packet.type} message from ${message.isOutbound ? 'You' : 'Peer'}`}>
                  <IonIcon
                    icon={getMessageTypeIcon(message.packet.type)}
                    slot="start"
                    color={getMessageTypeColor(message.packet.type)}
                    aria-hidden="true"
                  />
                  <IonLabel>
                    <h2>
                      {message.isOutbound ? 'You' : `Peer ${message.packet.senderPub.slice(0, 8)}`}
                      <IonBadge color={getMessageTypeColor(message.packet.type)} className="priority-badge">
                        {message.packet.type}
                      </IonBadge>
                    </h2>
                    <h3>{message.decryptedBody?.text || '[Encrypted]'}</h3>
                    <p>
                      {formatTimestamp(message.localTimestamp)} •
                      {message.isOutbound ?
                       ` ${getDeliveryStatusText(message.deliveryStatus)}` :
                       ` ${message.hopCount} hops`}
                    </p>
                  </IonLabel>
                </IonItem>
              ))
          )}
        </IonList>

        {/* Message Input */}
        <div className="message-input-container">
          <IonItem>
            <IonInput
              value={newMessage}
              placeholder="Type your message..."
              onIonInput={(e) => setNewMessage(e.detail.value!)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              aria-label="Message input"
            />
            <IonButton
              fill="clear"
              slot="end"
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              aria-label="Send message"
            >
              <IonIcon icon={send} aria-hidden="true" />
            </IonButton>
          </IonItem>
        </div>

        {/* Emergency Alert FAB */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton
            color="danger"
            onClick={() => setShowEmergencyAlert(true)}
            aria-label="Send emergency alert to all contacts"
          >
            <IonIcon icon={warning} aria-hidden="true" />
          </IonFabButton>
        </IonFab>

        {/* Emergency Alert Confirmation */}
        <IonAlert
          isOpen={showEmergencyAlert}
          onDidDismiss={() => setShowEmergencyAlert(false)}
          header="Emergency Alert"
          message="Send emergency alert to all contacts? This will broadcast your location and request immediate assistance."
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel'
            },
            {
              text: 'Send Alert',
              handler: sendEmergencyAlert,
              cssClass: 'alert-button-confirm'
            }
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default MessagesPage;