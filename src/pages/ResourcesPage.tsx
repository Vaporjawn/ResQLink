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
  IonChip,
  IonSegment,
  IonSegmentButton,
  IonModal,
  IonButton,
  IonButtons
} from '@ionic/react';
import { add, people, medical, home, car, restaurant, settings, time, close } from 'ionicons/icons';
import { useResQLinkStore } from '../lib/store';
import LocationSettings from '../components/LocationSettings';
import LocationHistoryViewer from '../components/LocationHistoryViewer';

const ResourcesPage: React.FC = () => {
  const {
    resourcePins,
    meshStatus
  } = useResQLinkStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddResource, setShowAddResource] = useState(false);
  const [showLocationSettings, setShowLocationSettings] = useState(false);
  const [showLocationHistory, setShowLocationHistory] = useState(false);

  const handleAddResource = (data: { name: string; category: string; description?: string }) => {
    if (!data.name?.trim()) return;

    console.log('Adding resource:', data.name, data.category);
    // Resource creation logic will be implemented when store methods are available
    setShowAddResource(false);
  };

  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'clinic': return medical;
      case 'shelter': return home;
      case 'water': return car;
      case 'food': return restaurant;
      default: return add;
    }
  };

  const filteredResources = selectedCategory === 'all'
    ? resourcePins
    : resourcePins.filter((resource) => resource.type === selectedCategory);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Resources</IonTitle>
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
            <IonItem button onClick={() => setShowLocationSettings(true)} aria-label="Open location settings">
              <IonIcon icon={settings} slot="start" aria-hidden="true" />
              <IonLabel>
                <h3>Location Settings</h3>
                <p>Configure GPS tracking and geofencing</p>
              </IonLabel>
            </IonItem>
            <IonItem button onClick={() => setShowLocationHistory(true)} aria-label="View location history">
              <IonIcon icon={time} slot="start" aria-hidden="true" />
              <IonLabel>
                <h3>Location History</h3>
                <p>View movement timeline and statistics</p>
              </IonLabel>
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Category Filter */}
        <IonCard>
          <IonCardContent>
            <IonSegment
              value={selectedCategory}
              onIonChange={(e) => setSelectedCategory(e.detail.value as string)}
            >
              <IonSegmentButton value="all" aria-label="Show all resources">
                <IonLabel>All</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="clinic" aria-label="Show clinic resources">
                <IonIcon icon={medical} aria-hidden="true" />
                <IonLabel>Clinic</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="shelter" aria-label="Show shelter resources">
                <IonIcon icon={home} aria-hidden="true" />
                <IonLabel>Shelter</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="water" aria-label="Show water resources">
                <IonIcon icon={car} aria-hidden="true" />
                <IonLabel>Water</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="food" aria-label="Show food resources">
                <IonIcon icon={restaurant} aria-hidden="true" />
                <IonLabel>Food</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonCardContent>
        </IonCard>

        {/* Resources List */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              Available Resources ({filteredResources.length})
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {filteredResources.length === 0 ? (
              <IonItem>
                <IonLabel>
                  <h3>No resources found</h3>
                  <p>Add or search for resources to help with disaster response</p>
                </IonLabel>
              </IonItem>
            ) : (
              <IonList>
                {filteredResources.map((resource, index) => (
                  <IonItem
                    key={`${resource.lat}-${resource.lon}-${index}`}
                    button
                    aria-label={`${resource.name}, ${resource.type}, ${resource.expiresAt === 0 || Date.now() < resource.expiresAt ? 'Active' : 'Expired'}`}
                  >
                    <IonIcon icon={getResourceIcon(resource.type)} slot="start" aria-hidden="true" />
                    <IonLabel>
                      <h3>{resource.name}</h3>
                      <p>Type: {resource.type}</p>
                      <p>Location: {resource.lat.toFixed(4)}, {resource.lon.toFixed(4)}</p>
                      {resource.description && <p>{resource.description}</p>}
                    </IonLabel>
                    <IonBadge
                      color={resource.expiresAt === 0 || Date.now() < resource.expiresAt ? 'success' : 'medium'}
                      slot="end"
                    >
                      {resource.expiresAt === 0 || Date.now() < resource.expiresAt ? 'Active' : 'Expired'}
                    </IonBadge>
                  </IonItem>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>

        {/* Floating Action Button */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowAddResource(true)} aria-label="Add new resource">
            <IonIcon icon={add} aria-hidden="true" />
          </IonFabButton>
        </IonFab>

        {/* Add Resource Alert */}
        <IonAlert
          isOpen={showAddResource}
          onDidDismiss={() => setShowAddResource(false)}
          header="Add New Resource"
          inputs={[
            {
              name: 'name',
              type: 'text',
              placeholder: 'Resource Name'
            },
            {
              name: 'category',
              type: 'text',
              placeholder: 'Type (clinic, shelter, water, food)'
            },
            {
              name: 'description',
              type: 'textarea',
              placeholder: 'Resource Description (optional)'
            }
          ]}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => setShowAddResource(false),
            },
            {
              text: 'Add',
              handler: (data) => {
                handleAddResource(data);
              },
            },
          ]}
        />

        {/* Location Settings Modal */}
        <IonModal isOpen={showLocationSettings} onDidDismiss={() => setShowLocationSettings(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Location Settings</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowLocationSettings(false)} aria-label="Close location settings">
                  <IonIcon icon={close} aria-hidden="true" />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <LocationSettings />
          </IonContent>
        </IonModal>

        {/* Location History Modal */}
        <IonModal isOpen={showLocationHistory} onDidDismiss={() => setShowLocationHistory(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Location History</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowLocationHistory(false)} aria-label="Close location history">
                  <IonIcon icon={close} aria-hidden="true" />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <LocationHistoryViewer />
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default ResourcesPage;