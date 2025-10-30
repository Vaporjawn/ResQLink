/**
 * Enhanced GPS and Location Services for ResQLink
 * Provides unified location management with geofencing, history, and emergency features
 */

import { Geolocation, Position, PositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useResQLinkStore } from '../lib/store';
import { Location } from '../lib/schema';
import { trackLocationUpdate } from '../lib/performance';

export interface GeofenceZone {
  id: string;
  name: string;
  center: { lat: number; lon: number };
  radiusMeters: number;
  type: 'emergency' | 'safe' | 'restricted';
  isActive: boolean;
}

export interface LocationHistory {
  timestamp: number;
  location: Location;
  accuracy: number;
  movementSpeed?: number; // km/h
}

export interface LocationServiceConfig {
  enableHighAccuracy: boolean;
  trackingInterval: number; // ms
  backgroundTracking: boolean;
  geofencingEnabled: boolean;
  locationHistoryEnabled: boolean;
  maxHistoryEntries: number;
  batteryOptimized: boolean;
}

class LocationServiceClass {
  private watchId: string | null = null;
  private isTracking = false;
  private config: LocationServiceConfig;
  private geofences: GeofenceZone[] = [];
  private locationHistory: LocationHistory[] = [];
  private lastKnownLocation: Location | null = null;

  constructor() {
    this.config = {
      enableHighAccuracy: true,
      trackingInterval: 30000, // 30 seconds default
      backgroundTracking: false,
      geofencingEnabled: true,
      locationHistoryEnabled: true,
      maxHistoryEntries: 100,
      batteryOptimized: true
    };

    // Load saved configuration and data
    this.loadStoredData();
  }

  /**
   * Initialize location services with permission checks
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if geolocation is available
      if (!Capacitor.isNativePlatform() && !navigator.geolocation) {
        console.warn('Geolocation not available');
        return false;
      }

      // Request permissions
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          console.warn('Location permissions denied');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize location services:', error);
      return false;
    }
  }

  /**
   * Check location permissions
   */
  async checkPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        return permissions.location === 'granted';
      } else {
        // Web platform - permissions are checked on first use
        return true;
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.requestPermissions();
        return permissions.location === 'granted';
      } else {
        // Web platform - will be requested on first getCurrentPosition call
        return true;
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Get current location with enhanced accuracy and error handling
   */
  async getCurrentLocation(): Promise<Location | null> {
    try {
      const options: PositionOptions = {
        enableHighAccuracy: this.config.enableHighAccuracy,
        timeout: 15000,
        maximumAge: 5000 // Use cached position if less than 5 seconds old
      };

      let position: Position;

      if (Capacitor.isNativePlatform()) {
        position = await Geolocation.getCurrentPosition(options);
      } else {
        // Fallback to web API
        position = await this.getWebPosition(options);
      }

      const location: Location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude || 0,
        accuracy: position.coords.accuracy || 0,
        timestamp: Date.now(),
        address: '' // Will be populated by reverse geocoding if needed
      };

      // Update store
      const { updateLocation } = useResQLinkStore.getState();
      updateLocation(location.latitude, location.longitude);

      // Add to history if enabled
      if (this.config.locationHistoryEnabled) {
        this.addToLocationHistory(location, position.coords.accuracy || 0);
      }

      // Check geofences
      if (this.config.geofencingEnabled) {
        this.checkGeofences(location);
      }

      this.lastKnownLocation = location;
      return location;
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }

  /**
   * Start continuous location tracking
   */
  async startTracking(): Promise<boolean> {
    if (this.isTracking) {
      console.warn('Location tracking already active');
      return true;
    }

    try {
      const initialized = await this.initialize();
      if (!initialized) {
        return false;
      }

      const options: PositionOptions = {
        enableHighAccuracy: this.config.enableHighAccuracy,
        timeout: 10000,
        maximumAge: 1000
      };

      if (Capacitor.isNativePlatform()) {
        this.watchId = await Geolocation.watchPosition(options, (position, err) => {
          if (err) {
            console.error('Location watch error:', err);
            return;
          }

          if (position) {
            this.handleLocationUpdate(position);
          }
        });
      } else {
        // Web platform fallback with manual interval
        this.startWebTracking();
      }

      this.isTracking = true;
      console.log('Location tracking started');
      return true;
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  async stopTracking(): Promise<void> {
    if (!this.isTracking) {
      return;
    }

    try {
      if (this.watchId && Capacitor.isNativePlatform()) {
        await Geolocation.clearWatch({ id: this.watchId });
        this.watchId = null;
      }

      this.isTracking = false;
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Failed to stop location tracking:', error);
    }
  }

  /**
   * Add geofence zone
   */
  addGeofence(zone: GeofenceZone): void {
    const existingIndex = this.geofences.findIndex(z => z.id === zone.id);
    if (existingIndex >= 0) {
      this.geofences[existingIndex] = zone;
    } else {
      this.geofences.push(zone);
    }
    this.saveStoredData();
  }

  /**
   * Remove geofence zone
   */
  removeGeofence(zoneId: string): void {
    this.geofences = this.geofences.filter(z => z.id !== zoneId);
    this.saveStoredData();
  }

  /**
   * Get active geofences
   */
  getGeofences(): GeofenceZone[] {
    return this.geofences.filter(z => z.isActive);
  }

  /**
   * Get location history
   */
  getLocationHistory(): LocationHistory[] {
    return [...this.locationHistory].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear location history
   */
  clearLocationHistory(): void {
    this.locationHistory = [];
    this.saveStoredData();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<LocationServiceConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveStoredData();

    // Restart tracking with new settings if currently active
    if (this.isTracking) {
      this.stopTracking().then(() => {
        this.startTracking();
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): LocationServiceConfig {
    return { ...this.config };
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
  }

  /**
   * Get emergency location summary for quick sharing
   */
  getEmergencyLocationSummary(): string {
    if (!this.lastKnownLocation) {
      return 'Location not available';
    }

    const { latitude, longitude, accuracy, timestamp } = this.lastKnownLocation;
    const timeAgo = Math.round((Date.now() - timestamp) / 1000);
    const accuracyDisplay = accuracy ? Math.round(accuracy) : 0;

    return `📍 Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)} (±${accuracyDisplay}m) - ${timeAgo}s ago`;
  }

  // Private methods

  private async getWebPosition(options: PositionOptions): Promise<Position> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude,
              accuracy: position.coords.accuracy,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed
            },
            timestamp: position.timestamp
          } as Position);
        },
        (error) => reject(error),
        options
      );
    });
  }

  private startWebTracking(): void {
    const trackingInterval = setInterval(async () => {
      if (!this.isTracking) {
        clearInterval(trackingInterval);
        return;
      }

      try {
        const position = await this.getWebPosition({
          enableHighAccuracy: this.config.enableHighAccuracy,
          timeout: 10000,
          maximumAge: 1000
        });
        this.handleLocationUpdate(position);
      } catch (error) {
        console.error('Web tracking error:', error);
      }
    }, this.config.trackingInterval);
  }

  private handleLocationUpdate(position: Position): void {
    // Track location update frequency
    trackLocationUpdate();

    const location: Location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude || 0,
      accuracy: position.coords.accuracy || 0,
      timestamp: Date.now(),
      address: ''
    };

    // Update store
    const { updateLocation } = useResQLinkStore.getState();
    updateLocation(location.latitude, location.longitude);

    // Add to history
    if (this.config.locationHistoryEnabled) {
      this.addToLocationHistory(location, position.coords.accuracy || 0);
    }

    // Check geofences
    if (this.config.geofencingEnabled) {
      this.checkGeofences(location);
    }

    this.lastKnownLocation = location;
  }

  private addToLocationHistory(location: Location, accuracy: number): void {
    // Calculate movement speed if we have a previous location
    let movementSpeed: number | undefined;
    if (this.locationHistory.length > 0) {
      const lastEntry = this.locationHistory[this.locationHistory.length - 1];
      const timeDiff = (location.timestamp - lastEntry.timestamp) / 1000; // seconds
      const distance = this.calculateDistance(
        lastEntry.location.latitude,
        lastEntry.location.longitude,
        location.latitude,
        location.longitude
      ) / 1000; // km

      if (timeDiff > 0) {
        movementSpeed = (distance / timeDiff) * 3600; // km/h
      }
    }

    const entry: LocationHistory = {
      timestamp: location.timestamp,
      location,
      accuracy,
      movementSpeed
    };

    this.locationHistory.push(entry);

    // Trim history if too long
    if (this.locationHistory.length > this.config.maxHistoryEntries) {
      this.locationHistory = this.locationHistory.slice(-this.config.maxHistoryEntries);
    }

    this.saveStoredData();
  }

  private checkGeofences(location: Location): void {
    for (const zone of this.geofences) {
      if (!zone.isActive) continue;

      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        zone.center.lat,
        zone.center.lon
      );

      const isInside = distance <= zone.radiusMeters;

      // Trigger geofence events (could be expanded with callbacks)
      if (isInside) {
        console.log(`Entered geofence: ${zone.name} (${zone.type})`);
        this.onGeofenceEntered(zone, location);
      }
    }
  }

  private onGeofenceEntered(zone: GeofenceZone, location: Location): void {
    // Emit custom events or call callbacks
    window.dispatchEvent(new CustomEvent('geofenceEntered', {
      detail: { zone, location }
    }));

    // Emergency zone handling
    if (zone.type === 'emergency') {
      window.dispatchEvent(new CustomEvent('emergencyZoneEntered', {
        detail: { zone, location }
      }));
    }
  }

  private loadStoredData(): void {
    try {
      const storedConfig = localStorage.getItem('resqlink_location_config');
      if (storedConfig) {
        this.config = { ...this.config, ...JSON.parse(storedConfig) };
      }

      const storedGeofences = localStorage.getItem('resqlink_geofences');
      if (storedGeofences) {
        this.geofences = JSON.parse(storedGeofences);
      }

      const storedHistory = localStorage.getItem('resqlink_location_history');
      if (storedHistory) {
        this.locationHistory = JSON.parse(storedHistory);
      }
    } catch (error) {
      console.error('Failed to load stored location data:', error);
    }
  }

  private saveStoredData(): void {
    try {
      localStorage.setItem('resqlink_location_config', JSON.stringify(this.config));
      localStorage.setItem('resqlink_geofences', JSON.stringify(this.geofences));
      localStorage.setItem('resqlink_location_history', JSON.stringify(this.locationHistory));
    } catch (error) {
      console.error('Failed to save location data:', error);
    }
  }
}

// Export singleton instance
export const LocationService = new LocationServiceClass();
export default LocationService;