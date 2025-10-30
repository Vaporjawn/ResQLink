import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonList,
  IonIcon,
  IonBadge,
  IonFab,
  IonFabButton,
  IonAlert,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip
} from '@ionic/react';
import { add, people, locationSharp } from 'ionicons/icons';
import { useResQLinkStore } from '../lib/store';
import './GroupsPage.css';

const GroupsPage: React.FC = () => {
  const {
    groups,
    meshStatus
  } = useResQLinkStore();

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);

  const handleCreateGroup = (data: { name: string; description?: string }) => {
    if (!data.name?.trim()) return;

    console.log('Creating group:', data.name);
    // Group creation logic will be implemented when store methods are available
    setShowCreateGroup(false);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Groups</IonTitle>
          <IonChip slot="end" color={meshStatus.active ? 'success' : 'danger'} aria-label={`${meshStatus.peerCount} peers ${meshStatus.active ? 'online' : 'offline'}`}>
            <IonIcon icon={people} aria-hidden="true" />
            <IonLabel>{meshStatus.peerCount} peers</IonLabel>
          </IonChip>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        {/* Connection Status */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Mesh Status</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem aria-label={`Network status: ${meshStatus.active ? 'Connected' : 'Disconnected'}, ${meshStatus.peerCount} peers online`}>
              <IonIcon icon={people} slot="start" aria-hidden="true" />
              <IonLabel>
                <h3>Network Status</h3>
                <p>{meshStatus.active ? 'Connected' : 'Disconnected'}</p>
                <p>{meshStatus.peerCount} peer(s) online</p>
              </IonLabel>
              <IonBadge color={meshStatus.active ? 'success' : 'danger'} slot="end">
                {meshStatus.active ? 'ONLINE' : 'OFFLINE'}
              </IonBadge>
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Groups List */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>My Groups ({groups.length})</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {groups.length === 0 ? (
              <IonItem>
                <IonLabel>
                  <h3>No groups yet</h3>
                  <p>Create or join a group to start collaboration</p>
                </IonLabel>
              </IonItem>
            ) : (
              <IonList>
                {groups.map((group) => (
                  <IonItem key={group.id} button aria-label={`Open group ${group.name}`}>
                    <IonIcon icon={people} slot="start" aria-hidden="true" />
                    <IonLabel>
                      <h3>{group.name}</h3>
                      <p>Group ID: {group.id}</p>
                    </IonLabel>
                    <IonBadge color="primary" slot="end">
                      Active
                    </IonBadge>
                  </IonItem>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>

        {/* Floating Action Buttons */}
        <IonFab vertical="bottom" horizontal="start" slot="fixed">
          <IonFabButton onClick={() => setShowCreateGroup(true)} aria-label="Create new group">
            <IonIcon icon={add} aria-hidden="true" />
          </IonFabButton>
        </IonFab>

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowJoinGroup(true)} aria-label="Join nearby group">
            <IonIcon icon={locationSharp} aria-hidden="true" />
          </IonFabButton>
        </IonFab>

        {/* Create Group Alert */}
        <IonAlert
          isOpen={showCreateGroup}
          onDidDismiss={() => setShowCreateGroup(false)}
          header="Create New Group"
          inputs={[
            {
              name: 'name',
              type: 'text',
              placeholder: 'Group Name'
            },
            {
              name: 'description',
              type: 'textarea',
              placeholder: 'Group Description (optional)'
            }
          ]}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => setShowCreateGroup(false),
            },
            {
              text: 'Create',
              handler: (data) => {
                handleCreateGroup(data);
              },
            },
          ]}
        />

        {/* Join Group Alert */}
        <IonAlert
          isOpen={showJoinGroup}
          onDidDismiss={() => setShowJoinGroup(false)}
          header="Join Group"
          message="Searching for nearby groups..."
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => setShowJoinGroup(false),
            }
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default GroupsPage;