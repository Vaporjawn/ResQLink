/**
 * Performance Monitoring Utilities
 *
 * Provides comprehensive performance tracking for ResQLink application,
 * including message latency, encryption performance, location updates,
 * and battery usage monitoring.
 */

import { Device } from '@capacitor/device';

/**
 * Performance metrics tracked by the system
 */
export interface PerformanceMetrics {
  messageSendLatency: number[];
  messageReceiveLatency: number[];
  encryptionTime: number[];
  decryptionTime: number[];
  locationUpdateFrequency: number[];
  batteryLevel?: number;
  batteryCharging?: boolean;
  networkType?: string;
  timestamp: number;
}

/**
 * Performance event types
 */
export enum PerformanceEventType {
  MESSAGE_SEND_START = 'message_send_start',
  MESSAGE_SEND_COMPLETE = 'message_send_complete',
  MESSAGE_RECEIVE_START = 'message_receive_start',
  MESSAGE_RECEIVE_COMPLETE = 'message_receive_complete',
  ENCRYPTION_START = 'encryption_start',
  ENCRYPTION_COMPLETE = 'encryption_complete',
  DECRYPTION_START = 'decryption_start',
  DECRYPTION_COMPLETE = 'decryption_complete',
  LOCATION_UPDATE = 'location_update',
  BATTERY_UPDATE = 'battery_update',
}

/**
 * Performance event data structure
 */
export interface PerformanceEvent {
  type: PerformanceEventType;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Performance tracking class
 */
class PerformanceTracker {
  private metrics: PerformanceMetrics = {
    messageSendLatency: [],
    messageReceiveLatency: [],
    encryptionTime: [],
    decryptionTime: [],
    locationUpdateFrequency: [],
    timestamp: Date.now(),
  };

  private eventTimestamps = new Map<string, number>();
  private maxMetricSamples = 100; // Keep last 100 samples
  private lastLocationUpdate = 0;
  private batteryMonitoringEnabled = false;
  private batteryCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Start tracking a performance event
   */
  startEvent(eventType: PerformanceEventType, eventId: string): void {
    const timestamp = performance.now();
    this.eventTimestamps.set(`${eventType}_${eventId}`, timestamp);

    if (import.meta.env.DEV) {
      console.log(`[Performance] Started: ${eventType} (ID: ${eventId})`);
    }
  }

  /**
   * Complete tracking a performance event
   */
  completeEvent(
    eventType: PerformanceEventType,
    eventId: string,
    metadata?: Record<string, unknown>
  ): number | null {
    const key = `${eventType}_${eventId}`;
    const startTime = this.eventTimestamps.get(key);

    if (!startTime) {
      console.warn(`[Performance] No start time found for: ${eventType} (ID: ${eventId})`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.eventTimestamps.delete(key);

    // Store the metric based on event type
    this.recordMetric(eventType, duration);

    if (import.meta.env.DEV) {
      console.log(
        `[Performance] Completed: ${eventType} (ID: ${eventId}) - ${duration.toFixed(2)}ms`,
        metadata
      );
    }

    return duration;
  }

  /**
   * Record a metric value
   */
  private recordMetric(eventType: PerformanceEventType, value: number): void {
    switch (eventType) {
      case PerformanceEventType.MESSAGE_SEND_COMPLETE:
        this.addMetricSample(this.metrics.messageSendLatency, value);
        break;
      case PerformanceEventType.MESSAGE_RECEIVE_COMPLETE:
        this.addMetricSample(this.metrics.messageReceiveLatency, value);
        break;
      case PerformanceEventType.ENCRYPTION_COMPLETE:
        this.addMetricSample(this.metrics.encryptionTime, value);
        break;
      case PerformanceEventType.DECRYPTION_COMPLETE:
        this.addMetricSample(this.metrics.decryptionTime, value);
        break;
      case PerformanceEventType.LOCATION_UPDATE: {
        const now = Date.now();
        if (this.lastLocationUpdate > 0) {
          const frequency = now - this.lastLocationUpdate;
          this.addMetricSample(this.metrics.locationUpdateFrequency, frequency);
        }
        this.lastLocationUpdate = now;
        break;
      }
    }
  }

  /**
   * Add a metric sample and maintain max samples limit
   */
  private addMetricSample(array: number[], value: number): void {
    array.push(value);
    if (array.length > this.maxMetricSamples) {
      array.shift(); // Remove oldest sample
    }
  }

  /**
   * Track message send latency
   */
  trackMessageSend(messageId: string): {
    start: () => void;
    complete: () => number | null;
  } {
    return {
      start: () => this.startEvent(PerformanceEventType.MESSAGE_SEND_START, messageId),
      complete: () =>
        this.completeEvent(PerformanceEventType.MESSAGE_SEND_COMPLETE, messageId),
    };
  }

  /**
   * Track message receive latency
   */
  trackMessageReceive(messageId: string): {
    start: () => void;
    complete: () => number | null;
  } {
    return {
      start: () => this.startEvent(PerformanceEventType.MESSAGE_RECEIVE_START, messageId),
      complete: () =>
        this.completeEvent(PerformanceEventType.MESSAGE_RECEIVE_COMPLETE, messageId),
    };
  }

  /**
   * Track encryption time
   */
  trackEncryption(operationId: string): {
    start: () => void;
    complete: () => number | null;
  } {
    return {
      start: () => this.startEvent(PerformanceEventType.ENCRYPTION_START, operationId),
      complete: () =>
        this.completeEvent(PerformanceEventType.ENCRYPTION_COMPLETE, operationId),
    };
  }

  /**
   * Track decryption time
   */
  trackDecryption(operationId: string): {
    start: () => void;
    complete: () => number | null;
  } {
    return {
      start: () => this.startEvent(PerformanceEventType.DECRYPTION_START, operationId),
      complete: () =>
        this.completeEvent(PerformanceEventType.DECRYPTION_COMPLETE, operationId),
    };
  }

  /**
   * Track location update
   */
  trackLocationUpdate(): void {
    this.recordMetric(PerformanceEventType.LOCATION_UPDATE, 0);
  }

  /**
   * Start battery monitoring
   */
  async startBatteryMonitoring(): Promise<void> {
    if (this.batteryMonitoringEnabled) {
      return;
    }

    this.batteryMonitoringEnabled = true;

    // Initial battery check
    await this.checkBattery();

    // Check battery every 5 minutes
    this.batteryCheckInterval = setInterval(async () => {
      await this.checkBattery();
    }, 5 * 60 * 1000);

    if (import.meta.env.DEV) {
      console.log('[Performance] Battery monitoring started');
    }
  }

  /**
   * Stop battery monitoring
   */
  stopBatteryMonitoring(): void {
    if (this.batteryCheckInterval) {
      clearInterval(this.batteryCheckInterval);
      this.batteryCheckInterval = null;
    }
    this.batteryMonitoringEnabled = false;

    if (import.meta.env.DEV) {
      console.log('[Performance] Battery monitoring stopped');
    }
  }

  /**
   * Check current battery status
   */
  private async checkBattery(): Promise<void> {
    try {
      const info = await Device.getBatteryInfo();
      this.metrics.batteryLevel = info.batteryLevel ? info.batteryLevel * 100 : undefined;
      this.metrics.batteryCharging = info.isCharging;

      if (import.meta.env.DEV) {
        console.log(
          `[Performance] Battery: ${this.metrics.batteryLevel?.toFixed(0)}% ${
            this.metrics.batteryCharging ? '(Charging)' : ''
          }`
        );
      }
    } catch (error) {
      console.warn('[Performance] Failed to get battery info:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Get average of a metric array
   */
  private getAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Get performance summary statistics
   */
  getSummary(): {
    avgMessageSendLatency: number;
    avgMessageReceiveLatency: number;
    avgEncryptionTime: number;
    avgDecryptionTime: number;
    avgLocationUpdateFrequency: number;
    batteryLevel?: number;
    batteryCharging?: boolean;
    networkType?: string;
    totalSamples: number;
  } {
    return {
      avgMessageSendLatency: this.getAverage(this.metrics.messageSendLatency),
      avgMessageReceiveLatency: this.getAverage(this.metrics.messageReceiveLatency),
      avgEncryptionTime: this.getAverage(this.metrics.encryptionTime),
      avgDecryptionTime: this.getAverage(this.metrics.decryptionTime),
      avgLocationUpdateFrequency: this.getAverage(this.metrics.locationUpdateFrequency),
      batteryLevel: this.metrics.batteryLevel,
      batteryCharging: this.metrics.batteryCharging,
      networkType: this.metrics.networkType,
      totalSamples:
        this.metrics.messageSendLatency.length +
        this.metrics.messageReceiveLatency.length +
        this.metrics.encryptionTime.length +
        this.metrics.decryptionTime.length +
        this.metrics.locationUpdateFrequency.length,
    };
  }

  /**
   * Log performance summary to console (dev mode only)
   */
  logSummary(): void {
    if (!import.meta.env.DEV) return;

    const summary = this.getSummary();

    console.group('[Performance Summary]');
    console.log('Message Send Latency:', `${summary.avgMessageSendLatency.toFixed(2)}ms avg`);
    console.log(
      'Message Receive Latency:',
      `${summary.avgMessageReceiveLatency.toFixed(2)}ms avg`
    );
    console.log('Encryption Time:', `${summary.avgEncryptionTime.toFixed(2)}ms avg`);
    console.log('Decryption Time:', `${summary.avgDecryptionTime.toFixed(2)}ms avg`);
    console.log(
      'Location Update Frequency:',
      `${(summary.avgLocationUpdateFrequency / 1000).toFixed(2)}s avg`
    );
    if (summary.batteryLevel !== undefined) {
      console.log(
        'Battery:',
        `${summary.batteryLevel.toFixed(0)}% ${summary.batteryCharging ? '(Charging)' : ''}`
      );
    }
    if (summary.networkType) {
      console.log('Network:', summary.networkType);
    }
    console.log('Total Samples:', summary.totalSamples);
    console.groupEnd();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      messageSendLatency: [],
      messageReceiveLatency: [],
      encryptionTime: [],
      decryptionTime: [],
      locationUpdateFrequency: [],
      timestamp: Date.now(),
    };
    this.eventTimestamps.clear();
    this.lastLocationUpdate = 0;

    if (import.meta.env.DEV) {
      console.log('[Performance] Metrics reset');
    }
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const summary = this.getSummary();
    const exportData = {
      summary,
      rawMetrics: this.metrics,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(exportData, null, 2);
  }
}

// Singleton instance
export const performanceTracker = new PerformanceTracker();

/**
 * Convenience functions for tracking operations
 */

/**
 * Track a message send operation
 * @param messageId Unique message identifier
 * @returns Tracking object with start and complete methods
 */
export function trackMessageSend(messageId: string) {
  return performanceTracker.trackMessageSend(messageId);
}

/**
 * Track a message receive operation
 * @param messageId Unique message identifier
 * @returns Tracking object with start and complete methods
 */
export function trackMessageReceive(messageId: string) {
  return performanceTracker.trackMessageReceive(messageId);
}

/**
 * Track an encryption operation
 * @param operationId Unique operation identifier
 * @returns Tracking object with start and complete methods
 */
export function trackEncryption(operationId: string) {
  return performanceTracker.trackEncryption(operationId);
}

/**
 * Track a decryption operation
 * @param operationId Unique operation identifier
 * @returns Tracking object with start and complete methods
 */
export function trackDecryption(operationId: string) {
  return performanceTracker.trackDecryption(operationId);
}

/**
 * Track a location update
 */
export function trackLocationUpdate() {
  performanceTracker.trackLocationUpdate();
}

/**
 * Start monitoring battery usage
 */
export async function startBatteryMonitoring() {
  await performanceTracker.startBatteryMonitoring();
}

/**
 * Stop monitoring battery usage
 */
export function stopBatteryMonitoring() {
  performanceTracker.stopBatteryMonitoring();
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics() {
  return performanceTracker.getMetrics();
}

/**
 * Get performance summary
 */
export function getPerformanceSummary() {
  return performanceTracker.getSummary();
}

/**
 * Log performance summary to console (dev mode only)
 */
export function logPerformanceSummary() {
  performanceTracker.logSummary();
}

/**
 * Reset all performance metrics
 */
export function resetPerformanceMetrics() {
  performanceTracker.reset();
}

/**
 * Export metrics as JSON string
 */
export function exportPerformanceMetrics() {
  return performanceTracker.exportMetrics();
}
