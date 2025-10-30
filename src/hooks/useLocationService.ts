/**
 * React hook for LocationService integration
 * Provides reactive location tracking, geofencing, and GPS functionality
 */

import { useState, useEffect, useCallback } from 'react';
import LocationService, {
  GeofenceZone,
  LocationHistory,
  LocationServiceConfig
} from '../services/LocationService';
import { Location } from '../lib/schema';

export interface UseLocationServiceReturn {
  // Location state
  currentLocation: Location | null;
  isTracking: boolean;
  isLoading: boolean;
  error: string | null;

  // Location methods
  getCurrentLocation: () => Promise<Location | null>;
  startTracking: () => Promise<boolean>;
  stopTracking: () => Promise<void>;

  // Configuration
  config: LocationServiceConfig;
  updateConfig: (updates: Partial<LocationServiceConfig>) => void;

  // Geofencing
  geofences: GeofenceZone[];
  addGeofence: (zone: GeofenceZone) => void;
  removeGeofence: (zoneId: string) => void;

  // Location history
  locationHistory: LocationHistory[];
  clearLocationHistory: () => void;

  // Emergency features
  getEmergencyLocationSummary: () => string;

  // Permission management
  hasPermission: boolean;
  requestPermissions: () => Promise<boolean>;
}

export const useLocationService = (): UseLocationServiceReturn => {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [config, setConfig] = useState<LocationServiceConfig>(LocationService.getConfig());
  const [geofences, setGeofences] = useState<GeofenceZone[]>([]);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);

  // Initialize service and check permissions
  useEffect(() => {
    const initializeService = async () => {
      try {
        const initialized = await LocationService.initialize();
        const permissions = await LocationService.checkPermissions();
        setHasPermission(permissions);

        if (!initialized || !permissions) {
          setError('Location services not available or permission denied');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize location services');
      }
    };

    initializeService();
  }, []);

  // Load initial data
  useEffect(() => {
    setGeofences(LocationService.getGeofences());
    setLocationHistory(LocationService.getLocationHistory());
  }, []);

  // Listen for geofence events
  useEffect(() => {
    const handleGeofenceEntered = (event: CustomEvent) => {
      console.log('Geofence entered:', event.detail);
      // You could add state updates here for UI notifications
    };

    const handleEmergencyZone = (event: CustomEvent) => {
      console.log('Emergency zone entered:', event.detail);
      // Handle emergency zone entry (alerts, notifications, etc.)
    };

    window.addEventListener('geofenceEntered', handleGeofenceEntered as EventListener);
    window.addEventListener('emergencyZoneEntered', handleEmergencyZone as EventListener);

    return () => {
      window.removeEventListener('geofenceEntered', handleGeofenceEntered as EventListener);
      window.removeEventListener('emergencyZoneEntered', handleEmergencyZone as EventListener);
    };
  }, []);

  // Get current location
  const getCurrentLocation = useCallback(async (): Promise<Location | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const location = await LocationService.getCurrentLocation();
      setCurrentLocation(location);
      return location;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get current location';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start location tracking
  const startTracking = useCallback(async (): Promise<boolean> => {
    setError(null);

    try {
      const success = await LocationService.startTracking();
      setIsTracking(success);

      if (!success) {
        setError('Failed to start location tracking');
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start location tracking';
      setError(errorMessage);
      return false;
    }
  }, []);

  // Stop location tracking
  const stopTracking = useCallback(async (): Promise<void> => {
    try {
      await LocationService.stopTracking();
      setIsTracking(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop location tracking';
      setError(errorMessage);
    }
  }, []);

  // Update configuration
  const updateConfig = useCallback((updates: Partial<LocationServiceConfig>): void => {
    LocationService.updateConfig(updates);
    setConfig(LocationService.getConfig());
  }, []);

  // Add geofence
  const addGeofence = useCallback((zone: GeofenceZone): void => {
    LocationService.addGeofence(zone);
    setGeofences(LocationService.getGeofences());
  }, []);

  // Remove geofence
  const removeGeofence = useCallback((zoneId: string): void => {
    LocationService.removeGeofence(zoneId);
    setGeofences(LocationService.getGeofences());
  }, []);

  // Clear location history
  const clearLocationHistory = useCallback((): void => {
    LocationService.clearLocationHistory();
    setLocationHistory([]);
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await LocationService.requestPermissions();
      setHasPermission(granted);

      if (!granted) {
        setError('Location permissions denied');
      }

      return granted;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request permissions';
      setError(errorMessage);
      return false;
    }
  }, []);

  // Get emergency location summary
  const getEmergencyLocationSummary = useCallback((): string => {
    return LocationService.getEmergencyLocationSummary();
  }, []);

  return {
    // Location state
    currentLocation,
    isTracking,
    isLoading,
    error,

    // Location methods
    getCurrentLocation,
    startTracking,
    stopTracking,

    // Configuration
    config,
    updateConfig,

    // Geofencing
    geofences,
    addGeofence,
    removeGeofence,

    // Location history
    locationHistory,
    clearLocationHistory,

    // Emergency features
    getEmergencyLocationSummary,

    // Permission management
    hasPermission,
    requestPermissions
  };
};

export default useLocationService;