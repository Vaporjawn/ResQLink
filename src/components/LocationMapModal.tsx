import React, { useEffect, useRef } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonButtons,
  IonIcon,
  IonContent
} from '@ionic/react';
import { close, locationOutline } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface LocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  title?: string;
}

export const LocationMapModal: React.FC<LocationMapModalProps> = ({
  isOpen,
  onClose,
  latitude,
  longitude,
  title = 'Location'
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);

  // Initialize map when modal opens
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;

    // Clean up existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }

    // Small delay to ensure container is rendered
    const timeout = setTimeout(() => {
      if (!mapContainer.current) return;

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
                  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors'
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
          center: [longitude, latitude],
          zoom: 15
        });

        map.current = mapInstance;

        // Add navigation controls
        mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Create custom marker element
        const markerElement = document.createElement('div');
        markerElement.style.cssText = `
          width: 32px;
          height: 32px;
          background-color: #3880ff;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
        `;
        markerElement.innerHTML = '<ion-icon name="location-outline"></ion-icon>';

        // Add marker
        const markerInstance = new maplibregl.Marker(markerElement)
          .setLngLat([longitude, latitude])
          .addTo(mapInstance);

        marker.current = markerInstance;

        // Fit map to show the location with some padding
        mapInstance.on('load', () => {
          mapInstance.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1000
          });
        });

      } catch (error) {
        console.error('Error initializing location map:', error);
      }
    }, 100);

    return () => {
      clearTimeout(timeout);
    };
  }, [isOpen, latitude, longitude]);

  // Clean up map when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
    }
  }, [isOpen]);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <IonIcon icon={locationOutline} style={{ marginRight: '8px' }} />
            {title}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div 
          ref={mapContainer} 
          style={{ 
            width: '100%', 
            height: '100%',
            minHeight: '400px'
          }} 
        />
        <div 
          style={{ 
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '12px',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IonIcon icon={locationOutline} />
            <span>
              <strong>Coordinates:</strong> {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </span>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default LocationMapModal;