/**
 * Location Settings Component
 * Provides interface for configuring GPS services, geofencing, and location tracking
 */

import React, { useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonList,
  IonRange,
  IonSelect,
  IonSelectOption,
  IonText,
  IonToggle,
  IonIcon,
  IonAlert,
  IonBadge,
  IonInput,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/react';
import {
  location,
  settings,
  shield,
  time,
  map,
  batteryHalf,
  warning,
  add,
  trash
} from 'ionicons/icons';

import { useLocationService } from '../hooks/useLocationService';
import { GeofenceZone } from '../services/LocationService';

export const LocationSettings: React.FC = () => {
  const {
    config,
    updateConfig,
    isTracking,
    startTracking,
    stopTracking,
    currentLocation,
    getCurrentLocation,
    hasPermission,
    requestPermissions,
    geofences,
    addGeofence,
    removeGeofence,
    locationHistory,
    clearLocationHistory,
    getEmergencyLocationSummary,
    error
  } = useLocationService();

  const [showPermissionAlert, setShowPermissionAlert] = useState(false);
  const [showHistoryClearAlert, setShowHistoryClearAlert] = useState(false);
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [newGeofence, setNewGeofence] = useState<Partial<GeofenceZone>>({
    name: '',
    center: { lat: 0, lon: 0 },
    radiusMeters: 1000,
    type: 'emergency',
    isActive: true
  });

  const handleTrackingToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!hasPermission) {
        setShowPermissionAlert(true);
        return;
      }
      await startTracking();
    } else {
      await stopTracking();
    }
  };

  const handlePermissionRequest = async () => {
    const granted = await requestPermissions();
    if (granted) {
      setShowPermissionAlert(false);
    }
  };

  const handleAddGeofence = () => {
    if (newGeofence.name && newGeofence.center) {
      const geofence: GeofenceZone = {
        id: `geofence_${Date.now()}`,
        name: newGeofence.name,
        center: newGeofence.center,
        radiusMeters: newGeofence.radiusMeters || 1000,
        type: newGeofence.type || 'emergency',
        isActive: true
      };

      addGeofence(geofence);
      setShowGeofenceModal(false);
      setNewGeofence({
        name: '',
        center: { lat: 0, lon: 0 },
        radiusMeters: 1000,
        type: 'emergency',
        isActive: true
      });
    }
  };

  const useCurrentLocationForGeofence = async () => {
    const location = await getCurrentLocation();
    if (location) {
      setNewGeofence(prev => ({
        ...prev,
        center: { lat: location.latitude, lon: location.longitude }
      }));
    }
  };

  return (
    <>
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>
            <IonIcon icon={location} /> Location Services
          </IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          {error && (
            <IonText color="danger">
              <p>{error}</p>
            </IonText>
          )}

          {/* Permission Status */}
          <IonItem>
            <IonIcon icon={shield} slot="start" />
            <IonLabel>
              <h3>Location Permissions</h3>
              <p>{hasPermission ? 'Granted' : 'Not granted'}</p>
            </IonLabel>
            <IonBadge color={hasPermission ? 'success' : 'danger'} slot="end">
              {hasPermission ? 'OK' : 'Required'}
            </IonBadge>
            {!hasPermission && (
              <IonButton fill="clear" size="small" onClick={handlePermissionRequest}>
                Request
              </IonButton>
            )}
          </IonItem>

          {/* Current Location */}
          <IonItem>
            <IonIcon icon={map} slot="start" />
            <IonLabel>
              <h3>Current Location</h3>
              <p>
                {currentLocation
                  ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
                  : 'Not available'
                }
              </p>
            </IonLabel>
            <IonButton fill="clear" size="small" onClick={getCurrentLocation}>
              Update
            </IonButton>
          </IonItem>

          {/* Emergency Summary */}
          <IonItem>
            <IonIcon icon={warning} slot="start" />
            <IonLabel>
              <h3>Emergency Location</h3>
              <p style={{ fontSize: '0.8em', fontFamily: 'monospace' }}>
                {getEmergencyLocationSummary()}
              </p>
            </IonLabel>
          </IonItem>
        </IonCardContent>
      </IonCard>

      {/* Tracking Settings */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>
            <IonIcon icon={settings} /> Tracking Settings
          </IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonList>
            {/* Real-time Tracking */}
            <IonItem>
              <IonIcon icon={time} slot="start" />
              <IonLabel>
                <h3>Real-time Tracking</h3>
                <p>Continuous location updates</p>
              </IonLabel>
              <IonToggle
                checked={isTracking}
                onIonChange={(e) => handleTrackingToggle(e.detail.checked)}
              />
            </IonItem>

            {/* High Accuracy */}
            <IonItem>
              <IonLabel>
                <h3>High Accuracy GPS</h3>
                <p>Uses GPS satellites for better precision</p>
              </IonLabel>
              <IonToggle
                checked={config.enableHighAccuracy}
                onIonChange={(e) => updateConfig({ enableHighAccuracy: e.detail.checked })}
              />
            </IonItem>

            {/* Background Tracking */}
            <IonItem>
              <IonLabel>
                <h3>Background Tracking</h3>
                <p>Continue tracking when app is in background</p>
              </IonLabel>
              <IonToggle
                checked={config.backgroundTracking}
                onIonChange={(e) => updateConfig({ backgroundTracking: e.detail.checked })}
              />
            </IonItem>

            {/* Battery Optimization */}
            <IonItem>
              <IonIcon icon={batteryHalf} slot="start" />
              <IonLabel>
                <h3>Battery Optimization</h3>
                <p>Reduce power consumption</p>
              </IonLabel>
              <IonToggle
                checked={config.batteryOptimized}
                onIonChange={(e) => updateConfig({ batteryOptimized: e.detail.checked })}
              />
            </IonItem>

            {/* Tracking Interval */}
            <IonItem>
              <IonLabel>
                <h3>Update Interval</h3>
                <p>{Math.round(config.trackingInterval / 1000)} seconds</p>
              </IonLabel>
              <IonRange
                min={5}
                max={300}
                step={5}
                value={config.trackingInterval / 1000}
                onIonInput={(e) => updateConfig({ trackingInterval: (e.detail.value as number) * 1000 })}
              />
            </IonItem>
          </IonList>
        </IonCardContent>
      </IonCard>

      {/* Geofencing */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>
            <IonIcon icon={shield} /> Geofencing
            <IonButton
              fill="clear"
              size="small"
              onClick={() => setShowGeofenceModal(true)}
            >
              <IonIcon icon={add} />
            </IonButton>
          </IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonItem>
            <IonLabel>
              <h3>Geofencing Enabled</h3>
              <p>Monitor entry/exit of defined zones</p>
            </IonLabel>
            <IonToggle
              checked={config.geofencingEnabled}
              onIonChange={(e) => updateConfig({ geofencingEnabled: e.detail.checked })}
            />
          </IonItem>

          {geofences.length > 0 ? (
            <IonList>
              {geofences.map((zone) => (
                <IonItem key={zone.id}>
                  <IonLabel>
                    <h3>{zone.name}</h3>
                    <p>
                      {zone.type.toUpperCase()} - {Math.round(zone.radiusMeters)}m radius
                    </p>
                  </IonLabel>
                  <IonBadge color={zone.isActive ? 'success' : 'medium'} slot="end">
                    {zone.isActive ? 'Active' : 'Inactive'}
                  </IonBadge>
                  <IonButton
                    fill="clear"
                    color="danger"
                    size="small"
                    onClick={() => removeGeofence(zone.id)}
                  >
                    <IonIcon icon={trash} />
                  </IonButton>
                </IonItem>
              ))}
            </IonList>
          ) : (
            <IonText color="medium">
              <p>No geofences configured</p>
            </IonText>
          )}
        </IonCardContent>
      </IonCard>

      {/* Location History */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>
            <IonIcon icon={time} /> Location History
          </IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonItem>
            <IonLabel>
              <h3>Location History</h3>
              <p>Store location history for emergency response</p>
            </IonLabel>
            <IonToggle
              checked={config.locationHistoryEnabled}
              onIonChange={(e) => updateConfig({ locationHistoryEnabled: e.detail.checked })}
            />
          </IonItem>

          <IonItem>
            <IonLabel>
              <h3>History Entries</h3>
              <p>{locationHistory.length} of {config.maxHistoryEntries} stored</p>
            </IonLabel>
            <IonButton
              fill="clear"
              color="danger"
              size="small"
              onClick={() => setShowHistoryClearAlert(true)}
              disabled={locationHistory.length === 0}
            >
              Clear
            </IonButton>
          </IonItem>

          <IonItem>
            <IonLabel>
              <h3>Max History Entries</h3>
              <p>{config.maxHistoryEntries} entries</p>
            </IonLabel>
            <IonRange
              min={10}
              max={500}
              step={10}
              value={config.maxHistoryEntries}
              onIonInput={(e) => updateConfig({ maxHistoryEntries: e.detail.value as number })}
            />
          </IonItem>
        </IonCardContent>
      </IonCard>

      {/* Permission Alert */}
      <IonAlert
        isOpen={showPermissionAlert}
        onDidDismiss={() => setShowPermissionAlert(false)}
        header="Location Permissions Required"
        message="Location tracking requires permission to access your device location. This helps provide emergency services and resource sharing."
        buttons={[
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Grant Permission',
            handler: handlePermissionRequest
          }
        ]}
      />

      {/* Clear History Alert */}
      <IonAlert
        isOpen={showHistoryClearAlert}
        onDidDismiss={() => setShowHistoryClearAlert(false)}
        header="Clear Location History"
        message="Are you sure you want to clear all location history? This cannot be undone."
        buttons={[
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Clear',
            role: 'destructive',
            handler: clearLocationHistory
          }
        ]}
      />

      {/* Add Geofence Modal */}
      <IonModal isOpen={showGeofenceModal} onDidDismiss={() => setShowGeofenceModal(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Add Geofence</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowGeofenceModal(false)}>Close</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList>
            <IonItem>
              <IonLabel position="stacked">Zone Name</IonLabel>
              <IonInput
                value={newGeofence.name}
                onIonInput={(e) => setNewGeofence(prev => ({ ...prev, name: e.detail.value! }))}
                placeholder="Enter zone name"
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Zone Type</IonLabel>
              <IonSelect
                value={newGeofence.type}
                onIonChange={(e) => setNewGeofence(prev => ({ ...prev, type: e.detail.value }))}
              >
                <IonSelectOption value="emergency">Emergency Zone</IonSelectOption>
                <IonSelectOption value="safe">Safe Zone</IonSelectOption>
                <IonSelectOption value="restricted">Restricted Zone</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Radius (meters)</IonLabel>
              <IonRange
                min={100}
                max={10000}
                step={100}
                value={newGeofence.radiusMeters}
                onIonInput={(e) => setNewGeofence(prev => ({ ...prev, radiusMeters: e.detail.value as number }))}
              />
              <IonLabel slot="end">{newGeofence.radiusMeters}m</IonLabel>
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Center Location</IonLabel>
              <IonGrid>
                <IonRow>
                  <IonCol>
                    <IonInput
                      type="number"
                      value={newGeofence.center?.lat}
                      onIonInput={(e) => setNewGeofence(prev => ({
                        ...prev,
                        center: { ...prev.center!, lat: parseFloat(e.detail.value!) }
                      }))}
                      placeholder="Latitude"
                    />
                  </IonCol>
                  <IonCol>
                    <IonInput
                      type="number"
                      value={newGeofence.center?.lon}
                      onIonInput={(e) => setNewGeofence(prev => ({
                        ...prev,
                        center: { ...prev.center!, lon: parseFloat(e.detail.value!) }
                      }))}
                      placeholder="Longitude"
                    />
                  </IonCol>
                </IonRow>
              </IonGrid>
              <IonButton
                fill="clear"
                size="small"
                onClick={useCurrentLocationForGeofence}
              >
                Use Current Location
              </IonButton>
            </IonItem>

            <IonItem>
              <IonButton
                expand="block"
                onClick={handleAddGeofence}
                disabled={!newGeofence.name || !newGeofence.center?.lat || !newGeofence.center?.lon}
              >
                <IonIcon icon={add} slot="start" />
                Add Geofence
              </IonButton>
            </IonItem>
          </IonList>
        </IonContent>
      </IonModal>
    </>
  );
};

export default LocationSettings;