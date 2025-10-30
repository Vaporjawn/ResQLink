import { Location, Contact } from '../lib/schema';
import { LocationService } from './LocationService';
import { useResQLinkStore } from '../lib/store';

// Mesh service interface for type safety
interface MeshService {
  onMessage: (type: string, callback: (message: { alert: EmergencyAlert }) => void) => void;
  sendBroadcast: (data: { type: string; alert: EmergencyAlert }) => Promise<void>;
  broadcastMessage: (type: string, data: EmergencyAlert | { alertId: string; userId: string } | { alertId: string; reason: string }) => Promise<void>;
  sendDirectMessage: (userId: string, type: string, data: { alert: EmergencyAlert; timestamp: number }) => Promise<void>;
}

// Store accessor function
const getStore = () => useResQLinkStore.getState();

export interface EmergencyAlert {
  id: string;
  type: EmergencyAlertType;
  severity: EmergencyAlertSeverity;
  title: string;
  message: string;
  timestamp: number;
  location?: Location;
  radius?: number; // Radius in meters for geographic targeting
  expiresAt?: number;
  sender: string;
  category: EmergencyAlertCategory;
  instructions?: string[];
  contactInfo?: string;
  evacuationZone?: boolean;
  shelterLocation?: Location;
  status: EmergencyAlertStatus;
  acknowledgments: string[]; // User IDs who acknowledged
  priority: number; // 1-10, higher = more urgent
  audioAlert?: boolean;
  vibrationPattern?: number[];
  repeatInterval?: number; // Minutes between repeats
  channels: BroadcastChannel[]; // How alert is delivered
}

export enum EmergencyAlertType {
  NATURAL_DISASTER = 'natural_disaster',
  FIRE = 'fire',
  FLOOD = 'flood',
  EARTHQUAKE = 'earthquake',
  SEVERE_WEATHER = 'severe_weather',
  MEDICAL_EMERGENCY = 'medical_emergency',
  SECURITY_THREAT = 'security_threat',
  EVACUATION = 'evacuation',
  SHELTER_ADVISORY = 'shelter_advisory',
  ALL_CLEAR = 'all_clear',
  TEST_ALERT = 'test_alert',
  INFRASTRUCTURE_FAILURE = 'infrastructure_failure'
}

export enum EmergencyAlertSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  EXTREME = 'extreme'
}

export enum EmergencyAlertCategory {
  IMMEDIATE = 'immediate', // Life-threatening, act now
  EXPECTED = 'expected',   // Expected within next hour
  FUTURE = 'future',       // Possible future threat
  PAST = 'past'           // No longer expected
}

export enum EmergencyAlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum BroadcastChannel {
  MESH_NETWORK = 'mesh_network',
  SYSTEM_NOTIFICATION = 'system_notification',
  AUDIO_ALARM = 'audio_alarm',
  VIBRATION = 'vibration',
  VISUAL_FLASH = 'visual_flash',
  SMS_FALLBACK = 'sms_fallback'
}

export interface EmergencyBroadcastConfig {
  enabled: boolean;
  autoAcknowledge: boolean;
  soundAlerts: boolean;
  vibrationAlerts: boolean;
  visualAlerts: boolean;
  repeatAlerts: boolean;
  maxRepeatCount: number;
  locationBasedFiltering: boolean;
  severityFilter: EmergencyAlertSeverity[];
  typeFilter: EmergencyAlertType[];
  testAlertsEnabled: boolean;
  emergencyContactsNotification: boolean;
}

export interface AlertTemplate {
  id: string;
  name: string;
  type: EmergencyAlertType;
  severity: EmergencyAlertSeverity;
  category: EmergencyAlertCategory;
  titleTemplate: string;
  messageTemplate: string;
  instructionsTemplate: string[];
  defaultRadius: number;
  audioAlert: boolean;
  vibrationPattern: number[];
  channels: BroadcastChannel[];
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'location' | 'time' | 'number';
  required: boolean;
  defaultValue?: string;
  description: string;
}

export interface GeographicZone {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  center?: Location;
  radius?: number;
  polygon?: Location[];
  population?: number;
  description: string;
}

export class EmergencyBroadcastService {
  private config: EmergencyBroadcastConfig;
  private activeAlerts: Map<string, EmergencyAlert> = new Map();
  private alertHistory: EmergencyAlert[] = [];
  private templates: AlertTemplate[] = [];
  private geographicZones: GeographicZone[] = [];
  private repeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private acknowledgmentCallbacks: Map<string, (alert: EmergencyAlert) => void> = new Map();
  private locationService: typeof LocationService | null = null;
  private meshService: MeshService | null = null;

  constructor(config?: Partial<EmergencyBroadcastConfig>) {
    this.config = {
      enabled: true,
      autoAcknowledge: false,
      soundAlerts: true,
      vibrationAlerts: true,
      visualAlerts: true,
      repeatAlerts: true,
      maxRepeatCount: 3,
      locationBasedFiltering: true,
      severityFilter: [EmergencyAlertSeverity.MINOR, EmergencyAlertSeverity.MODERATE, EmergencyAlertSeverity.SEVERE, EmergencyAlertSeverity.EXTREME],
      typeFilter: Object.values(EmergencyAlertType),
      testAlertsEnabled: false,
      emergencyContactsNotification: true,
      ...config
    };

    this.loadDefaultTemplates();
    this.loadDefaultGeographicZones();
  }

  async initialize(locationService: typeof LocationService, meshService: MeshService): Promise<void> {
    this.locationService = locationService;
    this.meshService = meshService;

    // Load saved alerts from storage
    await this.loadSavedAlerts();

    // Set up mesh message listener for incoming alerts
    this.setupMeshAlertListener();

    // Clean up expired alerts
    this.cleanupExpiredAlerts();
    setInterval(() => this.cleanupExpiredAlerts(), 60000); // Check every minute
  }

  private setupMeshAlertListener(): void {
    if (!this.meshService) return;

    // Listen for emergency alert messages over mesh network
    this.meshService.onMessage('emergency_alert', (message: { alert: EmergencyAlert }) => {
      this.handleIncomingAlert(message.alert);
    });
  }

  private async handleIncomingAlert(alertData: EmergencyAlert): Promise<void> {
    // Validate and process incoming emergency alert
    if (!this.isValidAlert(alertData)) {
      console.warn('Invalid emergency alert received:', alertData);
      return;
    }

    // Check if we should process this alert based on location and filters
    if (!await this.shouldProcessAlert(alertData)) {
      return;
    }

    // Add to active alerts
    this.activeAlerts.set(alertData.id, alertData);
    this.alertHistory.unshift(alertData);

    // Trigger local alert presentation
    await this.presentAlert(alertData);

    // Set up repeat notifications if configured
    this.setupAlertRepeats(alertData);

    // Notify emergency contacts if configured
    if (this.config.emergencyContactsNotification) {
      this.notifyEmergencyContacts(alertData);
    }
  }

  private isValidAlert(alert: EmergencyAlert): boolean {
    return !!(
      alert.id &&
      alert.type &&
      alert.severity &&
      alert.title &&
      alert.message &&
      alert.timestamp &&
      alert.sender &&
      alert.category &&
      alert.status
    );
  }

  private async shouldProcessAlert(alert: EmergencyAlert): Promise<boolean> {
    if (!this.config.enabled) return false;

    // Check severity filter
    if (!this.config.severityFilter.includes(alert.severity)) return false;

    // Check type filter
    if (!this.config.typeFilter.includes(alert.type)) return false;

    // Check test alerts setting
    if (alert.type === EmergencyAlertType.TEST_ALERT && !this.config.testAlertsEnabled) {
      return false;
    }

    // Check geographic relevance
    if (this.config.locationBasedFiltering && alert.location && alert.radius && this.locationService) {
      const currentLocation = await this.locationService.getCurrentLocation();
      if (currentLocation) {
        const distance = this.calculateDistance(currentLocation, alert.location);
        if (distance > alert.radius) return false;
      }
    }

    return true;
  }

  async broadcastEmergencyAlert(alert: Omit<EmergencyAlert, 'id' | 'timestamp' | 'acknowledgments' | 'status'>): Promise<string> {
    const emergencyAlert: EmergencyAlert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: Date.now(),
      acknowledgments: [],
      status: EmergencyAlertStatus.ACTIVE
    };

    // Add to active alerts
    this.activeAlerts.set(emergencyAlert.id, emergencyAlert);
    this.alertHistory.unshift(emergencyAlert);

    // Broadcast over mesh network
    if (this.meshService && alert.channels.includes(BroadcastChannel.MESH_NETWORK)) {
      await this.meshService.broadcastMessage('emergency_alert', emergencyAlert);
    }

    // Present alert locally
    await this.presentAlert(emergencyAlert);

    // Set up repeat notifications
    this.setupAlertRepeats(emergencyAlert);

    // Save to persistent storage
    await this.saveAlerts();

    return emergencyAlert.id;
  }

  async broadcastFromTemplate(templateId: string, variables: Record<string, string | number | Location>, targetZone?: string): Promise<string> {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Process template variables
    const title = this.processTemplate(template.titleTemplate, variables);
    const message = this.processTemplate(template.messageTemplate, variables);
    const instructions = template.instructionsTemplate.map(inst => this.processTemplate(inst, variables));

    let location: Location | undefined;
    let radius: number | undefined;

    // Handle target zone
    if (targetZone) {
      const zone = this.geographicZones.find(z => z.id === targetZone);
      if (zone && zone.center) {
        location = zone.center;
        radius = zone.radius || template.defaultRadius;
      }
    } else if (variables.location) {
      location = typeof variables.location === 'object' && variables.location ? variables.location as Location : undefined;
      radius = typeof variables.radius === 'number' ? variables.radius : template.defaultRadius;
    }

    return await this.broadcastEmergencyAlert({
      type: template.type,
      severity: template.severity,
      title,
      message,
      category: template.category,
      instructions,
      location,
      radius,
      sender: 'System',
      audioAlert: template.audioAlert,
      vibrationPattern: template.vibrationPattern,
      priority: this.getSeverityPriority(template.severity),
      channels: template.channels
    });
  }

  private processTemplate(template: string, variables: Record<string, string | number | Location>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
      }
      return match;
    });
  }

  private async presentAlert(alert: EmergencyAlert): Promise<void> {
    // System notification
    if (alert.channels.includes(BroadcastChannel.SYSTEM_NOTIFICATION) && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(alert.title, {
          body: alert.message,
          icon: this.getAlertIcon(alert.type),
          badge: '/assets/icon/favicon.png',
          tag: alert.id,
          requireInteraction: alert.severity === EmergencyAlertSeverity.EXTREME
        });
      }
    }

    // Audio alert
    if (alert.channels.includes(BroadcastChannel.AUDIO_ALARM) && this.config.soundAlerts && alert.audioAlert) {
      this.playAudioAlert(alert);
    }

    // Vibration
    if (alert.channels.includes(BroadcastChannel.VIBRATION) && this.config.vibrationAlerts && 'vibrate' in navigator) {
      const pattern = alert.vibrationPattern || this.getDefaultVibrationPattern(alert.severity);
      navigator.vibrate(pattern);
    }

    // Visual flash
    if (alert.channels.includes(BroadcastChannel.VISUAL_FLASH) && this.config.visualAlerts) {
      this.triggerVisualFlash(alert.severity);
    }

    // Trigger UI update
    this.notifyAlertPresented(alert);
  }

  private playAudioAlert(alert: EmergencyAlert): void {
    const audio = new Audio();
    audio.src = this.getAlertSound(alert.type, alert.severity);
    audio.volume = 0.8;
    audio.loop = alert.severity === EmergencyAlertSeverity.EXTREME;
    audio.play().catch(console.error);

    // Stop extreme alerts after 30 seconds
    if (alert.severity === EmergencyAlertSeverity.EXTREME) {
      setTimeout(() => audio.pause(), 30000);
    }
  }

  private triggerVisualFlash(severity: EmergencyAlertSeverity): void {
    const flashColor = this.getSeverityColor(severity);
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: ${flashColor};
      opacity: 0.8;
      z-index: 10000;
      pointer-events: none;
    `;

    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
    }, 200);
  }

  private setupAlertRepeats(alert: EmergencyAlert): void {
    if (!this.config.repeatAlerts || !alert.repeatInterval || alert.repeatInterval <= 0) {
      return;
    }

    let repeatCount = 0;
    const maxRepeats = this.config.maxRepeatCount;

    const timer = setInterval(() => {
      repeatCount++;

      if (repeatCount >= maxRepeats ||
          alert.status !== EmergencyAlertStatus.ACTIVE ||
          alert.acknowledgments.length > 0) {
        clearInterval(timer);
        this.repeatTimers.delete(alert.id);
        return;
      }

      // Re-present the alert
      this.presentAlert(alert);
    }, alert.repeatInterval * 60 * 1000); // Convert minutes to milliseconds

    this.repeatTimers.set(alert.id, timer);
  }

  async acknowledgeAlert(alertId: string, userId: string = 'current_user'): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    // Add acknowledgment
    if (!alert.acknowledgments.includes(userId)) {
      alert.acknowledgments.push(userId);
    }

    // Update status if auto-acknowledge is enabled
    if (this.config.autoAcknowledge || userId === 'current_user') {
      alert.status = EmergencyAlertStatus.ACKNOWLEDGED;
    }

    // Stop repeating alerts for this user
    const timer = this.repeatTimers.get(alertId);
    if (timer) {
      clearInterval(timer);
      this.repeatTimers.delete(alertId);
    }

    // Broadcast acknowledgment over mesh
    if (this.meshService) {
      await this.meshService.broadcastMessage('emergency_alert_ack', {
        alertId,
        userId,
        timestamp: Date.now()
      });
    }

    // Trigger callback if set
    const callback = this.acknowledgmentCallbacks.get(alertId);
    if (callback) {
      callback(alert);
    }

    await this.saveAlerts();
  }

  async cancelAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    alert.status = EmergencyAlertStatus.CANCELLED;

    // Clear repeat timer
    const timer = this.repeatTimers.get(alertId);
    if (timer) {
      clearInterval(timer);
      this.repeatTimers.delete(alertId);
    }

    // Broadcast cancellation
    if (this.meshService) {
      await this.meshService.broadcastMessage('emergency_alert_cancel', {
        alertId,
        reason: 'Cancelled by administrator'
      });
    }

    await this.saveAlerts();
  }

  private cleanupExpiredAlerts(): void {
    const now = Date.now();

    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.expiresAt && now > alert.expiresAt) {
        alert.status = EmergencyAlertStatus.EXPIRED;

        // Clear repeat timer
        const timer = this.repeatTimers.get(alertId);
        if (timer) {
          clearInterval(timer);
          this.repeatTimers.delete(alertId);
        }
      }
    }
  }

  private notifyEmergencyContacts(alert: EmergencyAlert): void {
    const store = getStore();
    // Use existing contacts from store
    const contacts = store.contacts;

    // Send alert to contacts via mesh
    if (this.meshService && contacts) {
      contacts.forEach((contact: Contact) => {
        this.meshService!.sendDirectMessage(contact.ed25519Pub, 'emergency_alert_notification', {
          alert,
          timestamp: Date.now()
        });
      });
    }
  }

  private notifyAlertPresented(alert: EmergencyAlert): void {
    // Dispatch custom event for UI to listen to
    window.dispatchEvent(new CustomEvent('emergency-alert-presented', {
      detail: alert
    }));
  }

  // Utility methods
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateDistance(loc1: Location, loc2: Location): number {
    // Haversine formula implementation
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (loc1.latitude * Math.PI) / 180;
    const lat2Rad = (loc2.latitude * Math.PI) / 180;
    const deltaLatRad = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const deltaLonRad = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private getSeverityPriority(severity: EmergencyAlertSeverity): number {
    switch (severity) {
      case EmergencyAlertSeverity.EXTREME: return 10;
      case EmergencyAlertSeverity.SEVERE: return 8;
      case EmergencyAlertSeverity.MODERATE: return 5;
      case EmergencyAlertSeverity.MINOR: return 3;
      default: return 1;
    }
  }

  private getSeverityColor(severity: EmergencyAlertSeverity): string {
    switch (severity) {
      case EmergencyAlertSeverity.EXTREME: return '#ff0000';
      case EmergencyAlertSeverity.SEVERE: return '#ff4500';
      case EmergencyAlertSeverity.MODERATE: return '#ffa500';
      case EmergencyAlertSeverity.MINOR: return '#ffff00';
      default: return '#87ceeb';
    }
  }

  private getAlertIcon(type: EmergencyAlertType): string {
    const iconMap: Record<EmergencyAlertType, string> = {
      [EmergencyAlertType.NATURAL_DISASTER]: '/assets/icons/natural-disaster.png',
      [EmergencyAlertType.FIRE]: '/assets/icons/fire.png',
      [EmergencyAlertType.FLOOD]: '/assets/icons/flood.png',
      [EmergencyAlertType.EARTHQUAKE]: '/assets/icons/earthquake.png',
      [EmergencyAlertType.SEVERE_WEATHER]: '/assets/icons/weather.png',
      [EmergencyAlertType.MEDICAL_EMERGENCY]: '/assets/icons/medical.png',
      [EmergencyAlertType.SECURITY_THREAT]: '/assets/icons/security.png',
      [EmergencyAlertType.EVACUATION]: '/assets/icons/evacuation.png',
      [EmergencyAlertType.SHELTER_ADVISORY]: '/assets/icons/shelter.png',
      [EmergencyAlertType.ALL_CLEAR]: '/assets/icons/all-clear.png',
      [EmergencyAlertType.TEST_ALERT]: '/assets/icons/test.png',
      [EmergencyAlertType.INFRASTRUCTURE_FAILURE]: '/assets/icons/infrastructure.png'
    };
    return iconMap[type] || '/assets/icon/favicon.png';
  }

  private getAlertSound(type: EmergencyAlertType, severity: EmergencyAlertSeverity): string {
    if (severity === EmergencyAlertSeverity.EXTREME) {
      return '/assets/sounds/extreme-alert.mp3';
    }
    if (severity === EmergencyAlertSeverity.SEVERE) {
      return '/assets/sounds/severe-alert.mp3';
    }
    return '/assets/sounds/alert.mp3';
  }

  private getDefaultVibrationPattern(severity: EmergencyAlertSeverity): number[] {
    switch (severity) {
      case EmergencyAlertSeverity.EXTREME: return [500, 200, 500, 200, 500, 200, 500];
      case EmergencyAlertSeverity.SEVERE: return [300, 150, 300, 150, 300];
      case EmergencyAlertSeverity.MODERATE: return [200, 100, 200];
      case EmergencyAlertSeverity.MINOR: return [100];
      default: return [100];
    }
  }

  private loadDefaultTemplates(): void {
    this.templates = [
      {
        id: 'earthquake_alert',
        name: 'Earthquake Alert',
        type: EmergencyAlertType.EARTHQUAKE,
        severity: EmergencyAlertSeverity.SEVERE,
        category: EmergencyAlertCategory.IMMEDIATE,
        titleTemplate: 'Earthquake Alert - Magnitude {{magnitude}}',
        messageTemplate: 'An earthquake of magnitude {{magnitude}} has been detected {{distance}}km from your location. Take immediate cover.',
        instructionsTemplate: [
          'Drop to your hands and knees',
          'Take cover under a sturdy table or against an interior wall',
          'Hold on to your shelter until shaking stops',
          'Stay away from windows and heavy objects'
        ],
        defaultRadius: 50000,
        audioAlert: true,
        vibrationPattern: [500, 200, 500, 200, 500],
        channels: [BroadcastChannel.MESH_NETWORK, BroadcastChannel.SYSTEM_NOTIFICATION, BroadcastChannel.AUDIO_ALARM, BroadcastChannel.VIBRATION],
        variables: [
          { name: 'magnitude', type: 'number', required: true, description: 'Earthquake magnitude' },
          { name: 'distance', type: 'number', required: true, description: 'Distance from epicenter in km' }
        ]
      },
      {
        id: 'flood_warning',
        name: 'Flood Warning',
        type: EmergencyAlertType.FLOOD,
        severity: EmergencyAlertSeverity.SEVERE,
        category: EmergencyAlertCategory.EXPECTED,
        titleTemplate: 'Flood Warning - {{area}}',
        messageTemplate: 'Flash flood warning in effect for {{area}}. Seek higher ground immediately. Expected water level: {{waterLevel}}m',
        instructionsTemplate: [
          'Move to higher ground immediately',
          'Do not attempt to drive through flooded roads',
          'Stay away from storm drains and washes',
          'Monitor local emergency broadcasts'
        ],
        defaultRadius: 25000,
        audioAlert: true,
        vibrationPattern: [300, 150, 300, 150, 300],
        channels: [BroadcastChannel.MESH_NETWORK, BroadcastChannel.SYSTEM_NOTIFICATION, BroadcastChannel.AUDIO_ALARM],
        variables: [
          { name: 'area', type: 'text', required: true, description: 'Affected area name' },
          { name: 'waterLevel', type: 'number', required: false, description: 'Expected water level in meters' }
        ]
      },
      {
        id: 'evacuation_order',
        name: 'Evacuation Order',
        type: EmergencyAlertType.EVACUATION,
        severity: EmergencyAlertSeverity.EXTREME,
        category: EmergencyAlertCategory.IMMEDIATE,
        titleTemplate: 'EVACUATION ORDER - {{zone}}',
        messageTemplate: 'Immediate evacuation required for {{zone}}. Proceed to {{shelterLocation}} via {{evacuationRoute}}.',
        instructionsTemplate: [
          'Leave immediately - do not delay',
          'Take only essential items: ID, medications, water',
          'Follow designated evacuation routes',
          'Do not return until authorities declare area safe'
        ],
        defaultRadius: 10000,
        audioAlert: true,
        vibrationPattern: [500, 200, 500, 200, 500, 200, 500],
        channels: [BroadcastChannel.MESH_NETWORK, BroadcastChannel.SYSTEM_NOTIFICATION, BroadcastChannel.AUDIO_ALARM, BroadcastChannel.VIBRATION, BroadcastChannel.VISUAL_FLASH],
        variables: [
          { name: 'zone', type: 'text', required: true, description: 'Evacuation zone' },
          { name: 'shelterLocation', type: 'text', required: true, description: 'Designated shelter location' },
          { name: 'evacuationRoute', type: 'text', required: false, description: 'Recommended evacuation route' }
        ]
      }
    ];
  }

  private loadDefaultGeographicZones(): void {
    this.geographicZones = [
      {
        id: 'karachi_central',
        name: 'Karachi Central District',
        type: 'circle',
        center: { latitude: 24.8607, longitude: 67.0011, accuracy: 100, timestamp: Date.now() },
        radius: 15000,
        population: 2500000,
        description: 'Central Karachi metropolitan area'
      },
      {
        id: 'lahore_city',
        name: 'Lahore City Center',
        type: 'circle',
        center: { latitude: 31.5804, longitude: 74.3587, accuracy: 100, timestamp: Date.now() },
        radius: 20000,
        population: 1800000,
        description: 'Lahore city center and surrounding areas'
      },
      {
        id: 'islamabad_metro',
        name: 'Islamabad Metropolitan',
        type: 'circle',
        center: { latitude: 33.6844, longitude: 73.0479, accuracy: 100, timestamp: Date.now() },
        radius: 25000,
        population: 1200000,
        description: 'Islamabad and Rawalpindi metropolitan area'
      }
    ];
  }

  private async saveAlerts(): Promise<void> {
    try {
      const alertsData = {
        active: Array.from(this.activeAlerts.entries()),
        history: this.alertHistory.slice(0, 1000) // Keep last 1000 alerts
      };
      localStorage.setItem('emergency_alerts', JSON.stringify(alertsData));
    } catch (error) {
      console.error('Failed to save alerts:', error);
    }
  }

  private async loadSavedAlerts(): Promise<void> {
    try {
      const saved = localStorage.getItem('emergency_alerts');
      if (saved) {
        const alertsData = JSON.parse(saved);

        // Restore active alerts
        this.activeAlerts = new Map(alertsData.active || []);

        // Restore history
        this.alertHistory = alertsData.history || [];

        // Clean up expired alerts
        this.cleanupExpiredAlerts();
      }
    } catch (error) {
      console.error('Failed to load saved alerts:', error);
    }
  }

  // Public API methods
  getActiveAlerts(): EmergencyAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(): EmergencyAlert[] {
    return this.alertHistory;
  }

  getTemplates(): AlertTemplate[] {
    return this.templates;
  }

  getGeographicZones(): GeographicZone[] {
    return this.geographicZones;
  }

  updateConfig(config: Partial<EmergencyBroadcastConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): EmergencyBroadcastConfig {
    return { ...this.config };
  }

  onAlertAcknowledged(alertId: string, callback: (alert: EmergencyAlert) => void): void {
    this.acknowledgmentCallbacks.set(alertId, callback);
  }

  // Template management methods
  async addTemplate(template: Omit<AlertTemplate, 'id'>): Promise<string> {
    const newTemplate: AlertTemplate = {
      ...template,
      id: this.generateAlertId()
    };
    this.templates.push(newTemplate);
    return newTemplate.id;
  }

  async updateTemplate(template: AlertTemplate): Promise<void> {
    const index = this.templates.findIndex(t => t.id === template.id);
    if (index !== -1) {
      this.templates[index] = template;
    }
  }

  async removeTemplate(templateId: string): Promise<void> {
    this.templates = this.templates.filter(t => t.id !== templateId);
  }

  // Geographic zone management methods
  async addGeographicZone(zone: Omit<GeographicZone, 'id'>): Promise<string> {
    const newZone: GeographicZone = {
      ...zone,
      id: this.generateAlertId()
    };
    this.geographicZones.push(newZone);
    return newZone.id;
  }

  async updateGeographicZone(zone: GeographicZone): Promise<void> {
    const index = this.geographicZones.findIndex(z => z.id === zone.id);
    if (index !== -1) {
      this.geographicZones[index] = zone;
    }
  }

  async removeGeographicZone(zoneId: string): Promise<void> {
    this.geographicZones = this.geographicZones.filter(z => z.id !== zoneId);
  }
}