import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonButton,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonTextarea,
  IonCheckbox,
  IonList,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonAlert,
  IonLoading,
  IonToast,
  IonActionSheet,
  IonButtons
} from '@ionic/react';
import {
  add,
  locate,
  layers,
  close,
  save,
  trash,
  warning,
  person,
  radio,
  business,
  home,
  medkit,
  restaurant,
  car,
  flash
} from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Geolocation } from '@capacitor/geolocation';
import { useResQLinkStore } from '../lib/store';
import { throttle } from '../lib/utils';
import {
  ResourceType,
  ResourceStatus,
  ResourceMapPin,
  ResourcePin,
} from '../lib/schema';

import './ResourceMap.css';

interface ResourceMapProps {
  onBack?: () => void;
}

// Using ResourceMapPin interface from schema.ts

// Adapter function to convert ResourcePin (mesh networking) to ResourceMapPin (UI)
const resourcePinToMapPin = (pin: ResourcePin): ResourceMapPin => {
  return {
    id: `${pin.createdAt}-${pin.lat}-${pin.lon}`, // Create unique ID from timestamp and coords
    type: pin.type as ResourceType, // Cast string to ResourceType enum
    status: 'available' as ResourceStatus, // Default status since mesh pins don't have this
    title: pin.name,
    description: pin.description || '',
    location: {
      latitude: pin.lat,
      longitude: pin.lon,
      altitude: 0,
      accuracy: 0,
      timestamp: pin.createdAt
    },
    reportedBy: {
      contactId: pin.signedBy,
      alias: 'Unknown', // Not available in mesh interface
      timestamp: pin.createdAt
    },
    priority: 'medium' as const, // Default priority
    tags: [],
    broadcastToMesh: true, // Already came from mesh
    createdAt: pin.createdAt,
    updatedAt: pin.createdAt,
    validUntil: pin.expiresAt
  };
};

interface ResourceFormData {
  type: ResourceType;
  status: ResourceStatus;
  title: string;
  description: string;
  contact?: {
    name?: string;
    phone?: string;
    radio?: string;
  };
  capacity?: {
    current: number;
    maximum: number;
    unit: string;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  validUntil?: number;
  broadcastToMesh: boolean;
}

// Resource type icons mapping
const resourceIcons: Record<ResourceType, string> = {
  medical: medkit,
  shelter: home,
  food: restaurant,
  rescue: person,
  transport: car,
  communication: radio,
  hazard: warning,
  utility: flash,
  supplies: business
};

// Resource status colors
const statusColors: Record<ResourceStatus, string> = {
  available: 'success',
  limited: 'warning',
  requested: 'primary',
  unavailable: 'danger',
  verified: 'success',
  reported: 'medium'
};

// Priority colors
const priorityColors = {
  low: 'medium',
  medium: 'warning',
  high: 'danger',
  critical: 'danger'
};

export const ResourceMap: React.FC<ResourceMapProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBack
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());

  const {
    resourcePins,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentLocation,
    addResourcePin,
    removeResourcePin,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getResourcePinsNearby,
    updateLocation
  } = useResQLinkStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<ResourceMapPin | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [pinToDelete, setPinToDelete] = useState<ResourceMapPin | null>(null);
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Set<ResourceType>>(
    new Set(['medical', 'shelter', 'food', 'rescue', 'transport', 'communication', 'hazard', 'utility', 'supplies'])
  );
  const [clickLocation, setClickLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [formData, setFormData] = useState<ResourceFormData>({
    type: 'medical',
    status: 'available',
    title: '',
    description: '',
    priority: 'medium',
    tags: [],
    broadcastToMesh: true
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      // Initialize MapLibre GL JS map
      const mapInstance = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                // Pakistan-focused OSM tile server with offline capability
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            },
            'pakistan-terrain': {
              type: 'raster',
              tiles: [
                // Terrain tiles for Pakistan region
                'https://services.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}'
              ],
              tileSize: 256,
              attribution: '© Esri'
            }
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm-tiles'
            }
          ],
          glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'
        },
        center: [69.3451, 30.3753], // Pakistan center coordinates
        zoom: 6,
        minZoom: 4,
        maxZoom: 18
      });

      map.current = mapInstance;

      // Add navigation controls
      mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Add geolocate control
      const geolocate = new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true
      });
      mapInstance.addControl(geolocate, 'top-right');

      // Handle map clicks for adding new resources
      mapInstance.on('click', (e) => {
        setClickLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        setFormData(prev => ({
          ...prev,
          title: '',
          description: ''
        }));
        setIsFormOpen(true);
      });

      // Get user location when map loads
      mapInstance.on('load', () => {
        getCurrentLocation();
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      setToast({ message: 'Error initializing map', color: 'danger' });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoize visible pins to avoid recalculating on every render
  const visiblePins = useMemo(() => {
    return resourcePins.filter(pin => visibleLayers.has(pin.type as ResourceType));
  }, [resourcePins, visibleLayers]);

  // Throttled marker update function to reduce DOM operations
  const updateMarkers = useMemo(() => throttle(() => {
    if (!map.current) return;

    // Track which markers should exist
    const shouldExist = new Set<string>();

    visiblePins.forEach(pin => {
      const mapPin = resourcePinToMapPin(pin);
      shouldExist.add(mapPin.id);

      // Reuse existing marker if possible
      if (markers.current.has(mapPin.id)) {
        // Marker already exists, just update position if needed
        const existingMarker = markers.current.get(mapPin.id)!;
        existingMarker.setLngLat([mapPin.location.longitude, mapPin.location.latitude]);
        return;
      }

      // Create new marker only if it doesn't exist
      const el = document.createElement('div');
      el.className = 'resource-marker';
      el.innerHTML = `
        <div class="marker-icon marker-${mapPin.type} marker-${mapPin.status} marker-priority-${mapPin.priority}">
          <ion-icon name="${resourceIcons[mapPin.type as ResourceType]}"></ion-icon>
        </div>
      `;

      const marker = new maplibregl.Marker(el)
        .setLngLat([mapPin.location.longitude, mapPin.location.latitude])
        .addTo(map.current!);

      // Add click handler for marker
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedPin(mapPin);
        setIsDetailsOpen(true);
      });

      markers.current.set(mapPin.id, marker);
    });

    // Remove markers that should no longer exist
    const toRemove: string[] = [];
    markers.current.forEach((marker, id) => {
      if (!shouldExist.has(id)) {
        marker.remove();
        toRemove.push(id);
      }
    });
    toRemove.forEach(id => markers.current.delete(id));
  }, 100), [visiblePins]); // Throttle to 100ms

  // Update markers when visible pins change
  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      const { latitude, longitude } = position.coords;
      updateLocation(latitude, longitude);

      if (map.current) {
        map.current.flyTo({
          center: [longitude, latitude],
          zoom: 12,
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setToast({ message: 'Could not get current location', color: 'warning' });
    } finally {
      setIsLoading(false);
    }
  }, [updateLocation]);

  // Handle form submission
  const handleSubmitResource = useCallback(() => {
    if (!clickLocation || !formData.title.trim()) {
      setToast({ message: 'Please fill in required fields', color: 'warning' });
      return;
    }

    try {
      const now = Date.now();
      const newPin: ResourcePin = {
        type: formData.type,
        name: formData.title.trim(),
        lat: clickLocation.lat,
        lon: clickLocation.lng,
        description: formData.description.trim(),
        expiresAt: 0, // Never expires for now
        signedBy: 'temp-key', // In real app, use actual signing key
        signature: 'temp-signature', // In real app, create actual signature
        createdAt: now
      };

      addResourcePin(newPin);
      setToast({ message: 'Resource added successfully', color: 'success' });
      setIsFormOpen(false);
      setClickLocation(null);

      // Reset form
      setFormData({
        type: 'medical',
        status: 'available',
        title: '',
        description: '',
        priority: 'medium',
        tags: [],
        broadcastToMesh: true
      });
    } catch (error) {
      console.error('Error adding resource:', error);
      setToast({ message: 'Error adding resource', color: 'danger' });
    }
  }, [clickLocation, formData, addResourcePin]);

  // Handle resource deletion
  const handleDeleteResource = useCallback(() => {
    if (!pinToDelete) return;

    try {
      removeResourcePin(pinToDelete.createdAt);
      setToast({ message: 'Resource deleted successfully', color: 'success' });
      setShowAlert(false);
      setIsDetailsOpen(false);
      setPinToDelete(null);
      setSelectedPin(null);
    } catch (error) {
      console.error('Error deleting resource:', error);
      setToast({ message: 'Error deleting resource', color: 'danger' });
    }
  }, [pinToDelete, removeResourcePin]);

  // Toggle layer visibility
  const toggleLayer = (type: ResourceType) => {
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  // Layer action sheet options
  const layerOptions = [
    { text: 'Medical', handler: () => toggleLayer('medical') },
    { text: 'Shelter', handler: () => toggleLayer('shelter') },
    { text: 'Food & Water', handler: () => toggleLayer('food') },
    { text: 'Rescue Teams', handler: () => toggleLayer('rescue') },
    { text: 'Transport', handler: () => toggleLayer('transport') },
    { text: 'Communication', handler: () => toggleLayer('communication') },
    { text: 'Hazards', handler: () => toggleLayer('hazard') },
    { text: 'Utilities', handler: () => toggleLayer('utility') },
    { text: 'Supplies', handler: () => toggleLayer('supplies') },
    { text: 'Cancel', role: 'cancel' }
  ];

  return (
    <IonContent>
      {/* Map container */}
      <div ref={mapContainer} className="map-container" />

      {/* Floating Action Buttons */}
      <IonFab vertical="bottom" horizontal="end" slot="fixed">
        <IonFabButton>
          <IonIcon icon={add} />
        </IonFabButton>
      </IonFab>

      <IonFab vertical="bottom" horizontal="start" slot="fixed">
        <IonFabButton onClick={getCurrentLocation}>
          <IonIcon icon={locate} />
        </IonFabButton>
      </IonFab>

      <IonFab vertical="top" horizontal="end" slot="fixed" style={{ marginTop: '60px' }}>
        <IonFabButton onClick={() => setShowLayersMenu(true)}>
          <IonIcon icon={layers} />
        </IonFabButton>
      </IonFab>

      {/* Resource Form Modal */}
      <IonModal isOpen={isFormOpen} onDidDismiss={() => setIsFormOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Add Resource</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setIsFormOpen(false)}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonList>
            {/* Resource Type */}
            <IonItem>
              <IonLabel position="stacked">Resource Type</IonLabel>
              <IonSelect
                value={formData.type}
                onIonChange={(e) => setFormData(prev => ({ ...prev, type: e.detail.value as ResourceType }))}
              >
                <IonSelectOption value="medical">Medical</IonSelectOption>
                <IonSelectOption value="shelter">Shelter</IonSelectOption>
                <IonSelectOption value="food">Food & Water</IonSelectOption>
                <IonSelectOption value="rescue">Rescue Teams</IonSelectOption>
                <IonSelectOption value="transport">Transport</IonSelectOption>
                <IonSelectOption value="communication">Communication</IonSelectOption>
                <IonSelectOption value="hazard">Hazard</IonSelectOption>
                <IonSelectOption value="utility">Utilities</IonSelectOption>
                <IonSelectOption value="supplies">Supplies</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* Status */}
            <IonItem>
              <IonLabel position="stacked">Status</IonLabel>
              <IonSelect
                value={formData.status}
                onIonChange={(e) => setFormData(prev => ({ ...prev, status: e.detail.value }))}
              >
                <IonSelectOption value="available">Available</IonSelectOption>
                <IonSelectOption value="limited">Limited Supply</IonSelectOption>
                <IonSelectOption value="requested">Requested</IonSelectOption>
                <IonSelectOption value="unavailable">Unavailable</IonSelectOption>
                <IonSelectOption value="verified">Verified</IonSelectOption>
                <IonSelectOption value="reported">Reported</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* Title */}
            <IonItem>
              <IonLabel position="stacked">Title *</IonLabel>
              <IonInput
                value={formData.title}
                onIonInput={(e) => setFormData(prev => ({ ...prev, title: e.detail.value! }))}
                placeholder="Enter resource title"
              />
            </IonItem>

            {/* Description */}
            <IonItem>
              <IonLabel position="stacked">Description</IonLabel>
              <IonTextarea
                value={formData.description}
                onIonInput={(e) => setFormData(prev => ({ ...prev, description: e.detail.value! }))}
                placeholder="Enter detailed description"
                rows={3}
              />
            </IonItem>

            {/* Priority */}
            <IonItem>
              <IonLabel position="stacked">Priority</IonLabel>
              <IonSelect
                value={formData.priority}
                onIonChange={(e) => setFormData(prev => ({ ...prev, priority: e.detail.value }))}
              >
                <IonSelectOption value="low">Low</IonSelectOption>
                <IonSelectOption value="medium">Medium</IonSelectOption>
                <IonSelectOption value="high">High</IonSelectOption>
                <IonSelectOption value="critical">Critical</IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* Broadcast to Mesh */}
            <IonItem>
              <IonLabel>Broadcast to Mesh Network</IonLabel>
              <IonCheckbox
                slot="end"
                checked={formData.broadcastToMesh}
                onIonChange={(e) => setFormData(prev => ({ ...prev, broadcastToMesh: e.detail.checked }))}
              />
            </IonItem>
          </IonList>

          <div className="form-buttons">
            <IonButton expand="block" onClick={handleSubmitResource}>
              <IonIcon icon={save} slot="start" />
              Add Resource
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      {/* Resource Details Modal */}
      <IonModal isOpen={isDetailsOpen} onDidDismiss={() => setIsDetailsOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Resource Details</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setIsDetailsOpen(false)}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {selectedPin && (
            <IonCard>
              <IonCardHeader>
                <div className="resource-header">
                  <IonIcon icon={resourceIcons[selectedPin.type]} className="resource-type-icon" />
                  <div>
                    <IonCardTitle>{selectedPin.title}</IonCardTitle>
                    <div className="resource-badges">
                      <IonChip color={statusColors[selectedPin.status]}>
                        {selectedPin.status}
                      </IonChip>
                      <IonChip color={priorityColors[selectedPin.priority]}>
                        {selectedPin.priority} priority
                      </IonChip>
                    </div>
                  </div>
                </div>
              </IonCardHeader>
              <IonCardContent>
                {selectedPin.description && (
                  <p>{selectedPin.description}</p>
                )}

                <IonGrid>
                  <IonRow>
                    <IonCol size="6">
                      <strong>Type:</strong>
                    </IonCol>
                    <IonCol size="6">
                      {selectedPin.type}
                    </IonCol>
                  </IonRow>

                  <IonRow>
                    <IonCol size="6">
                      <strong>Location:</strong>
                    </IonCol>
                    <IonCol size="6">
                      {selectedPin.location.latitude.toFixed(6)}, {selectedPin.location.longitude.toFixed(6)}
                    </IonCol>
                  </IonRow>

                  {selectedPin.capacity && (
                    <IonRow>
                      <IonCol size="6">
                        <strong>Capacity:</strong>
                      </IonCol>
                      <IonCol size="6">
                        {selectedPin.capacity.current}/{selectedPin.capacity.maximum} {selectedPin.capacity.unit}
                      </IonCol>
                    </IonRow>
                  )}

                  {selectedPin.contact && (
                    <>
                      {selectedPin.contact.name && (
                        <IonRow>
                          <IonCol size="6">
                            <strong>Contact:</strong>
                          </IonCol>
                          <IonCol size="6">
                            {selectedPin.contact.name}
                          </IonCol>
                        </IonRow>
                      )}
                      {selectedPin.contact.phone && (
                        <IonRow>
                          <IonCol size="6">
                            <strong>Phone:</strong>
                          </IonCol>
                          <IonCol size="6">
                            {selectedPin.contact.phone}
                          </IonCol>
                        </IonRow>
                      )}
                      {selectedPin.contact.radio && (
                        <IonRow>
                          <IonCol size="6">
                            <strong>Radio:</strong>
                          </IonCol>
                          <IonCol size="6">
                            {selectedPin.contact.radio}
                          </IonCol>
                        </IonRow>
                      )}
                    </>
                  )}

                  <IonRow>
                    <IonCol size="6">
                      <strong>Reported by:</strong>
                    </IonCol>
                    <IonCol size="6">
                      {selectedPin.reportedBy.alias}
                    </IonCol>
                  </IonRow>

                  {selectedPin.verification && (
                    <IonRow>
                      <IonCol size="6">
                        <strong>Verified by:</strong>
                      </IonCol>
                      <IonCol size="6">
                        {selectedPin.verification.verifierAlias}
                      </IonCol>
                    </IonRow>
                  )}
                </IonGrid>

                {selectedPin.tags.length > 0 && (
                  <div className="resource-tags">
                    <strong>Tags:</strong>
                    <div>
                      {selectedPin.tags.map((tag, index) => (
                        <IonChip key={index} color="secondary">
                          {tag}
                        </IonChip>
                      ))}
                    </div>
                  </div>
                )}

                <div className="resource-actions">
                  <IonButton
                    fill="outline"
                    color="danger"
                    onClick={() => {
                      setPinToDelete(selectedPin);
                      setShowAlert(true);
                    }}
                  >
                    <IonIcon icon={trash} slot="start" />
                    Delete
                  </IonButton>
                </div>
              </IonCardContent>
            </IonCard>
          )}
        </IonContent>
      </IonModal>

      {/* Layer Selection Action Sheet */}
      <IonActionSheet
        isOpen={showLayersMenu}
        onDidDismiss={() => setShowLayersMenu(false)}
        header="Toggle Map Layers"
        buttons={layerOptions}
      />

      {/* Delete Confirmation Alert */}
      <IonAlert
        isOpen={showAlert}
        onDidDismiss={() => setShowAlert(false)}
        header="Delete Resource"
        message="Are you sure you want to delete this resource? This action cannot be undone."
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Delete', handler: handleDeleteResource }
        ]}
      />

      {/* Loading indicator */}
      <IonLoading isOpen={isLoading} message="Getting location..." />

      {/* Toast messages */}
      <IonToast
        isOpen={!!toast}
        onDidDismiss={() => setToast(null)}
        message={toast?.message}
        duration={3000}
        color={toast?.color}
      />
    </IonContent>
  );
};

export default ResourceMap;