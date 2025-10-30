/**
 * Location History Viewer Component
 * Displays location history with timeline and map visualization
 */

import React, { useState, useMemo } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonList,
  IonText,
  IonIcon,
  IonBadge,
  IonSegment,
  IonSegmentButton,
  IonChip,
  IonDatetime,
  IonPopover,
  IonContent
} from '@ionic/react';
import {
  time,
  location,
  speedometer,
  map,
  download,
  refresh
} from 'ionicons/icons';

import { useLocationService } from '../hooks/useLocationService';

type ViewMode = 'timeline' | 'stats';
type TimeFilter = 'hour' | 'day' | 'week' | 'month' | 'all';

export const LocationHistoryViewer: React.FC = () => {
  const { locationHistory } = useLocationService();
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString());

  // Filter location history based on selected time period
  const filteredHistory = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();

    switch (timeFilter) {
      case 'hour':
        cutoffDate.setHours(now.getHours() - 1);
        break;
      case 'day':
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
      default:
        cutoffDate.setFullYear(2000); // Show all history
        break;
    }

    return locationHistory.filter(entry =>
      new Date(entry.timestamp) >= cutoffDate
    ).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [locationHistory, timeFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (filteredHistory.length === 0) {
      return {
        totalEntries: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        totalDistance: 0,
        timeSpan: 0
      };
    }

    const speeds = filteredHistory
      .map(entry => entry.movementSpeed || 0)
      .filter(speed => speed > 0);

    // Calculate distances between consecutive points using Haversine formula
    const distances: number[] = [];
    if (filteredHistory.length > 1) {
      for (let i = 1; i < filteredHistory.length; i++) {
        const prev = filteredHistory[i - 1].location;
        const curr = filteredHistory[i].location;
        const R = 6371; // Earth's radius in kilometers
        const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
        const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distances.push(R * c);
      }
    }

    const totalDistance = distances.reduce((sum, dist) => sum + dist, 0);
    const averageSpeed = speeds.length > 0 ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

    const timeSpan = filteredHistory.length > 1
      ? new Date(filteredHistory[0].timestamp).getTime() -
        new Date(filteredHistory[filteredHistory.length - 1].timestamp).getTime()
      : 0;

    return {
      totalEntries: filteredHistory.length,
      averageSpeed: averageSpeed * 3.6, // Convert m/s to km/h
      maxSpeed: maxSpeed * 3.6, // Convert m/s to km/h
      totalDistance: totalDistance / 1000, // Convert to km
      timeSpan: timeSpan / (1000 * 60 * 60) // Convert to hours
    };
  }, [filteredHistory]);

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSpeed = (speed: number | undefined) => {
    if (!speed) return 'N/A';
    return `${(speed * 3.6).toFixed(1)} km/h`;
  };



  const formatAccuracy = (accuracy: number | undefined) => {
    if (!accuracy) return 'N/A';
    return `±${Math.round(accuracy)}m`;
  };

  const exportHistory = () => {
    const csvContent = [
      'Timestamp,Latitude,Longitude,Altitude,Accuracy,MovementSpeed',
      ...filteredHistory.map(entry => [
        entry.timestamp,
        entry.location.latitude,
        entry.location.longitude,
        entry.location.altitude || '',
        entry.location.accuracy || '',
        entry.movementSpeed || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `location-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const refreshHistory = () => {
    // Trigger a refresh by updating the time filter temporarily
    const currentFilter = timeFilter;
    setTimeFilter('all');
    setTimeout(() => setTimeFilter(currentFilter), 100);
  };

  return (
    <>
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>
            <IonIcon icon={time} /> Location History
            <IonButton fill="clear" size="small" onClick={exportHistory}>
              <IonIcon icon={download} />
            </IonButton>
            <IonButton fill="clear" size="small" onClick={refreshHistory}>
              <IonIcon icon={refresh} />
            </IonButton>
          </IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          {/* View Mode Segment */}
          <IonSegment
            value={viewMode}
            onIonChange={(e) => setViewMode(e.detail.value as ViewMode)}
          >
            <IonSegmentButton value="timeline">
              <IonLabel>Timeline</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="stats">
              <IonLabel>Statistics</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {/* Time Filter */}
          <div style={{ marginTop: '16px', marginBottom: '16px' }}>
            <IonChip
              color={timeFilter === 'hour' ? 'primary' : 'medium'}
              onClick={() => setTimeFilter('hour')}
            >
              Last Hour
            </IonChip>
            <IonChip
              color={timeFilter === 'day' ? 'primary' : 'medium'}
              onClick={() => setTimeFilter('day')}
            >
              Last Day
            </IonChip>
            <IonChip
              color={timeFilter === 'week' ? 'primary' : 'medium'}
              onClick={() => setTimeFilter('week')}
            >
              Last Week
            </IonChip>
            <IonChip
              color={timeFilter === 'month' ? 'primary' : 'medium'}
              onClick={() => setTimeFilter('month')}
            >
              Last Month
            </IonChip>
            <IonChip
              color={timeFilter === 'all' ? 'primary' : 'medium'}
              onClick={() => setTimeFilter('all')}
            >
              All Time
            </IonChip>
          </div>

          {viewMode === 'stats' ? (
            /* Statistics View */
            <IonList>
              <IonItem>
                <IonIcon icon={location} slot="start" />
                <IonLabel>
                  <h3>Total Entries</h3>
                  <p>{stats.totalEntries} location points</p>
                </IonLabel>
              </IonItem>

              <IonItem>
                <IonIcon icon={speedometer} slot="start" />
                <IonLabel>
                  <h3>Average Speed</h3>
                  <p>{stats.averageSpeed.toFixed(1)} km/h</p>
                </IonLabel>
              </IonItem>

              <IonItem>
                <IonIcon icon={speedometer} slot="start" />
                <IonLabel>
                  <h3>Maximum Speed</h3>
                  <p>{stats.maxSpeed.toFixed(1)} km/h</p>
                </IonLabel>
              </IonItem>

              <IonItem>
                <IonIcon icon={map} slot="start" />
                <IonLabel>
                  <h3>Total Distance</h3>
                  <p>{stats.totalDistance.toFixed(2)} km</p>
                </IonLabel>
              </IonItem>

              <IonItem>
                <IonIcon icon={time} slot="start" />
                <IonLabel>
                  <h3>Time Span</h3>
                  <p>{stats.timeSpan.toFixed(1)} hours</p>
                </IonLabel>
              </IonItem>
            </IonList>
          ) : (
            /* Timeline View */
            <>
              {filteredHistory.length === 0 ? (
                <IonText color="medium">
                  <p>No location history available for the selected time period.</p>
                </IonText>
              ) : (
                <IonList>
                  {filteredHistory.map((entry, index) => (
                    <IonItem key={`${entry.timestamp}-${index}`}>
                      <IonIcon icon={location} slot="start" />
                      <IonLabel>
                        <h3>{formatDate(new Date(entry.timestamp).toISOString())}</h3>
                        <p>
                          {entry.location.latitude.toFixed(6)}, {entry.location.longitude.toFixed(6)}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          {entry.movementSpeed && (
                            <IonBadge color="primary">
                              {formatSpeed(entry.movementSpeed)}
                            </IonBadge>
                          )}
                          <IonBadge color="medium">
                            {formatAccuracy(entry.accuracy)}
                          </IonBadge>
                        </div>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </>
          )}
        </IonCardContent>
      </IonCard>

      {/* Date Picker Popover */}
      <IonPopover isOpen={showDatePicker} onDidDismiss={() => setShowDatePicker(false)}>
        <IonContent>
          <IonDatetime
            value={selectedDate}
            onIonChange={(e) => setSelectedDate(e.detail.value as string)}
          />
          <IonButton
            fill="clear"
            expand="block"
            onClick={() => setShowDatePicker(false)}
          >
            Done
          </IonButton>
        </IonContent>
      </IonPopover>
    </>
  );
};

export default LocationHistoryViewer;