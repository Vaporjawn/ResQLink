/**
 * ResQLink Mesh Networking Layer
 *
 * Cross-platform abstraction for mesh networking using:
 * - Android: Nearby Connections API
 * - iOS: MultipeerConnectivity
 *
 * Provides unified TypeScript interface for peer discovery,
 * connection management, and message transmission.
 */

import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import type {
  MeshPacket,
  PeerInfo,
  MeshNetworkState
} from './schema';
import type { NearbyConnectionsPlugin, NearbyMultipeerPlugin } from './mesh-types';

// Platform detection
export const isAndroid = () => Capacitor.getPlatform() === 'android';
export const isIOS = () => Capacitor.getPlatform() === 'ios';
export const isNative = () => isAndroid() || isIOS();

// Connection states
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FAILED = 'failed',
  REJECTED = 'rejected'
}

// Discovery states
export enum DiscoveryState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  DISCOVERING = 'discovering',
  ADVERTISING = 'advertising',
  BOTH = 'both',  // Both discovering and advertising
  ERROR = 'error'
}

// Mesh networking events
export interface PeerDiscoveredEventData {
  peerId: string;
  displayName: string;
  platform: 'android' | 'ios' | 'web';
  rssi?: number;
}

export interface PeerLostEventData {
  peerId: string;
}

export interface ConnectionStateChangedEventData {
  peerId: string;
  state: ConnectionState;
  error?: string;
}

export interface MessageReceivedEventData {
  packet: MeshPacket;
  fromPeerId: string;
}

export interface ErrorEventData {
  code: string;
  message: string;
  details?: unknown;
}

export interface MessageSentEventData {
  messageId: string;
  peerId: string;
}

// Native plugin event interfaces
export interface NativePeerDiscoveredEvent {
  peerId: string;
  displayName: string;
  platform: string;
  rssi?: number;
  capabilities?: string[];
  signalStrength?: number;
}

export interface NativePeerLostEvent {
  peerId: string;
}

export interface NativeConnectionStateChangedEvent {
  peerId: string;
  state: string;
}

export interface NativeMessageReceivedEvent {
  message: string;
  fromPeerId: string;
}

export interface NativeErrorEvent {
  code?: string;
  error?: string;
  message?: string;
}

// Capacitor plugin interface
export interface MeshNetworkPlugin {
  initialize?: (options: { serviceName?: string; displayName?: string }) => Promise<void>;
  cleanup?: () => Promise<void>;
  startAdvertising?: (options: { displayName: string; serviceName?: string }) => Promise<void>;
  stopAdvertising?: () => Promise<void>;
  startDiscovery?: (options?: { serviceName?: string; timeout?: number }) => Promise<void>;
  stopDiscovery?: () => Promise<void>;
  connectToPeer?: (options: { peerId: string; timeout?: number }) => Promise<void>;
  disconnect?: () => Promise<void>;
  disconnectFromPeer?: (options: { peerId: string }) => Promise<void>;
  sendMessage?: (options: { peerId: string; message?: string; data?: string }) => Promise<void>;
  broadcast?: (options: { message: string }) => Promise<void>;
  getSignalStrength?: (options: { peerId: string }) => Promise<{ strength: number }>;
  getPlatformInfo?: () => Promise<{ platform: string; version: string }>;
  addListener?: (eventName: string, callback: (data: unknown) => void) => PluginListenerHandle;
  removeAllListeners?: () => Promise<void>;
}

export interface MeshNetworkEvent {
  type: 'peerDiscovered' | 'peerLost' | 'connectionStateChanged' | 'messageReceived' | 'error' | 'discoveryStateChanged' | 'messageSent';
  data: PeerDiscoveredEventData | PeerLostEventData | ConnectionStateChangedEventData | MessageReceivedEventData | ErrorEventData | DiscoveryStateChangedEventData | MessageSentEventData;
}

export interface DiscoveryStateChangedEventData {
  state: DiscoveryState;
}

export interface PeerConnection {
  peerId: string;
  peerInfo: PeerInfo;
  state: ConnectionState;
  connectedAt?: Date;
  lastSeen: Date;
  signalStrength?: number;  // Signal strength indicator if available
  platform: 'android' | 'ios' | 'unknown';
}

// Message transmission result
export interface TransmissionResult {
  success: boolean;
  messageId: string;
  peerId?: string;
  error?: string;
  transmittedAt: Date;
}

// Network topology info
export interface NetworkTopology {
  localPeerId: string;
  connectedPeers: PeerConnection[];
  discoveredPeers: PeerInfo[];
  hopCount: Map<string, number>;  // Shortest hop count to each known peer
  lastUpdated: Date;
}

// Event listener type
export type MeshEventListener = (event: MeshNetworkEvent) => void;

/**
 * Mesh Network Manager Interface
 *
 * Provides unified API for mesh networking across platforms.
 * Actual implementation will use Capacitor plugins for native functionality.
 */
export interface IMeshNetworkManager {
  // Lifecycle management
  initialize(config: MeshConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  cleanup(): Promise<void>;

  // Discovery and advertising
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  startAdvertising(peerInfo: PeerInfo): Promise<void>;
  stopAdvertising(): Promise<void>;

  // Connection management
  connectToPeer(peerId: string): Promise<void>;
  disconnectFromPeer(peerId: string): Promise<void>;
  disconnectAll(): Promise<void>;

  // Message transmission
  sendMessage(packet: MeshPacket, targetPeerId?: string): Promise<TransmissionResult>;
  broadcastMessage(packet: MeshPacket): Promise<TransmissionResult[]>;

  // State queries
  getConnectionState(): MeshNetworkState;
  getConnectedPeers(): PeerConnection[];
  getDiscoveredPeers(): PeerInfo[];
  getNetworkTopology(): NetworkTopology;

  // Event handling
  addEventListener(listener: MeshEventListener): void;
  removeEventListener(listener: MeshEventListener): void;

  // Platform-specific features
  getSignalStrength(peerId: string): Promise<number | null>;
  getPlatformInfo(): Promise<{ platform: string; version: string; capabilities: string[] }>;
}

export interface MeshConfig {
  serviceName: string;           // Service identifier for discovery
  displayName: string;          // Human-readable name for this device
  maxConnections: number;       // Maximum concurrent connections
  discoveryTimeout: number;     // Discovery timeout in milliseconds
  connectionTimeout: number;    // Connection attempt timeout
  enableAutoReconnect: boolean; // Automatically reconnect to known peers
  strategy: 'cluster' | 'star' | 'hybrid'; // Network topology strategy
}

/**
 * Default mesh networking configuration
 */
export const DEFAULT_MESH_CONFIG: MeshConfig = {
  serviceName: 'resqlink-mesh',
  displayName: 'ResQLink User',
  maxConnections: 8,
  discoveryTimeout: 30000,
  connectionTimeout: 15000,
  enableAutoReconnect: true,
  strategy: 'hybrid'
};

/**
 * Concrete implementation of mesh networking manager
 *
 * Uses Capacitor plugins to interface with native platform APIs:
 * - Android: com.google.android.gms.nearby.Nearby
 * - iOS: MultipeerConnectivity framework
 */
export class MeshNetworkManager implements IMeshNetworkManager {
  private config: MeshConfig = DEFAULT_MESH_CONFIG;
  private eventListeners: MeshEventListener[] = [];
  private connectionState: MeshNetworkState = {
    isStarted: false,
    isDiscovering: false,
    isAdvertising: false,
    connectedPeerIds: [],
    discoveredPeerIds: [],
    lastUpdate: new Date()
  };
  private connections = new Map<string, PeerConnection>();
  private discoveredPeers = new Map<string, PeerInfo>();
  private nearbyConnections: NearbyConnectionsPlugin | null = null;
  private nearbyMultipeer: NearbyMultipeerPlugin | null = null;

  async initialize(config: MeshConfig): Promise<void> {
    this.config = { ...DEFAULT_MESH_CONFIG, ...config };

    try {
      if (isNative()) {
        // Load platform-specific Capacitor plugin
        if (isAndroid()) {
          // Android Nearby Connections plugin
          const { NearbyConnections, Strategy } = await import('@capacitor-trancee/nearby-connections');
          this.nearbyConnections = NearbyConnections;
          // Initialize with platform-specific options
          await this.nearbyConnections.initialize({
            endpointName: this.config.displayName,
            serviceID: this.config.serviceName,
            strategy: Strategy.P2P_STAR,
            lowPower: false,
            autoConnect: true,
            payload: JSON.stringify({ displayName: this.config.displayName })
          });
        } else if (isIOS()) {
          // iOS MultipeerConnectivity plugin
          const { NearbyMultipeer } = await import('@squareetlabs/capacitor-nearby-multipeer');
          this.nearbyMultipeer = NearbyMultipeer;
          // Initialize with platform-specific options
          await this.nearbyMultipeer.initialize({
            serviceId: this.config.serviceName
          });
        }

        // Initialize native plugin with platform-specific options
        if (isAndroid()) {
          // Android Nearby Connections requires InitializeOptions
          const { Strategy, NearbyConnections } = await import('@capacitor-trancee/nearby-connections');
          await NearbyConnections.initialize({
            endpointName: this.config.displayName,
            serviceID: this.config.serviceName,
            strategy: Strategy.P2P_STAR,
            lowPower: false,
            autoConnect: true,
            payload: ''
          });
        } else if (isIOS()) {
          // iOS MultipeerConnectivity requires serviceId
          const { NearbyMultipeer } = await import('@squareetlabs/capacitor-nearby-multipeer');
          await NearbyMultipeer.initialize({
            serviceId: this.config.serviceName,
            serviceUUIDString: undefined // Use default UUID
          });
        }

        // Set up native event listeners
        this.setupNativeEventListeners();
      } else {
        // Web/development environment - use mock implementation
        console.warn('Mesh networking not available in web environment. Using mock implementation.');
        this.initializeMockImplementation();
      }

      this.emitEvent({
        type: 'discoveryStateChanged',
        data: { state: DiscoveryState.STOPPED }
      });

    } catch (error) {
      console.error('Failed to initialize mesh networking:', error);
      throw new Error(`Mesh network initialization failed: ${error}`);
    }
  }

  async start(): Promise<void> {
    if (this.connectionState.isStarted) {
      console.warn('Mesh network already started');
      return;
    }

    try {
      this.connectionState.isStarted = true;
      this.connectionState.lastUpdate = new Date();

      // Start both discovery and advertising by default
      await Promise.all([
        this.startDiscovery(),
        this.startAdvertising({
          peerId: this.generatePeerId(),
          displayName: this.config.displayName,
          platform: isAndroid() ? 'android' : isIOS() ? 'ios' : 'web',
          capabilities: ['messaging', 'file_transfer'],
          lastSeen: new Date(),
          signalStrength: 0
        })
      ]);

      console.log('Mesh network started successfully');
    } catch (error) {
      this.connectionState.isStarted = false;
      console.error('Failed to start mesh network:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.connectionState.isStarted) return;

    try {
      // Stop discovery and advertising
      await Promise.all([
        this.stopDiscovery(),
        this.stopAdvertising()
      ]);

      // Disconnect all peers
      await this.disconnectAll();

      this.connectionState.isStarted = false;
      this.connectionState.lastUpdate = new Date();

      console.log('Mesh network stopped successfully');
    } catch (error) {
      console.error('Error stopping mesh network:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.eventListeners = [];
    this.connections.clear();
    this.discoveredPeers.clear();

    try {
      // Platform-specific cleanup
      if (isAndroid() && this.nearbyConnections) {
        await this.nearbyConnections.removeAllListeners();
      } else if (isIOS() && this.nearbyMultipeer) {
        await this.nearbyMultipeer.removeAllListeners();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  async startDiscovery(): Promise<void> {
    if (this.connectionState.isDiscovering) return;

    try {
      this.connectionState.isDiscovering = true;
      this.connectionState.lastUpdate = new Date();

      if (isNative()) {
        // Platform-specific discovery start
        if (isAndroid() && this.nearbyConnections) {
          await this.nearbyConnections.startDiscovery();
        } else if (isIOS() && this.nearbyMultipeer) {
          await this.nearbyMultipeer.startDiscovery();
        }
      } else {
        // Mock discovery for web environment
        this.mockDiscoverPeers();
      }

      this.emitEvent({
        type: 'discoveryStateChanged',
        data: { state: DiscoveryState.DISCOVERING }
      });

    } catch (error) {
      this.connectionState.isDiscovering = false;
      console.error('Failed to start discovery:', error);
      throw error;
    }
  }

  async stopDiscovery(): Promise<void> {
    if (!this.connectionState.isDiscovering) return;

    try {
      this.connectionState.isDiscovering = false;
      this.connectionState.lastUpdate = new Date();

      if (isNative()) {
        // Platform-specific discovery stop
        if (isAndroid() && this.nearbyConnections) {
          await this.nearbyConnections.stopDiscovery();
        } else if (isIOS() && this.nearbyMultipeer) {
          await this.nearbyMultipeer.stopDiscovery();
        }
      }

      this.emitEvent({
        type: 'discoveryStateChanged',
        data: { state: DiscoveryState.STOPPED }
      });

    } catch (error) {
      console.error('Error stopping discovery:', error);
      throw error;
    }
  }

  async startAdvertising(peerInfo: PeerInfo): Promise<void> {
    if (this.connectionState.isAdvertising) return;

    try {
      this.connectionState.isAdvertising = true;
      this.connectionState.lastUpdate = new Date();

      if (isNative()) {
        // Platform-specific advertising start
        if (isAndroid() && this.nearbyConnections) {
          await this.nearbyConnections.startAdvertising({
            displayName: peerInfo.displayName
          });
        } else if (isIOS() && this.nearbyMultipeer) {
          await this.nearbyMultipeer.startAdvertising({
            displayName: peerInfo.displayName
          });
        }
      }

      this.emitEvent({
        type: 'discoveryStateChanged',
        data: { state: DiscoveryState.ADVERTISING }
      });

    } catch (error) {
      this.connectionState.isAdvertising = false;
      console.error('Failed to start advertising:', error);
      throw error;
    }
  }

  async stopAdvertising(): Promise<void> {
    if (!this.connectionState.isAdvertising) return;

    try {
      this.connectionState.isAdvertising = false;
      this.connectionState.lastUpdate = new Date();

      if (isNative()) {
        // Platform-specific advertising stop
        if (isAndroid() && this.nearbyConnections) {
          await this.nearbyConnections.stopAdvertising();
        } else if (isIOS() && this.nearbyMultipeer) {
          await this.nearbyMultipeer.stopAdvertising();
        }
      }

      this.emitEvent({
        type: 'discoveryStateChanged',
        data: { state: DiscoveryState.STOPPED }
      });

    } catch (error) {
      console.error('Error stopping advertising:', error);
      throw error;
    }
  }

  async connectToPeer(peerId: string): Promise<void> {
    const existingConnection = this.connections.get(peerId);
    if (existingConnection?.state === ConnectionState.CONNECTED) {
      console.warn(`Already connected to peer ${peerId}`);
      return;
    }

    const peerInfo = this.discoveredPeers.get(peerId);
    if (!peerInfo) {
      throw new Error(`Peer ${peerId} not found in discovered peers`);
    }

    try {
      // Update connection state to connecting
      const connection: PeerConnection = {
        peerId,
        peerInfo,
        state: ConnectionState.CONNECTING,
        lastSeen: new Date(),
        platform: peerInfo.platform as 'android' | 'ios' | 'unknown'
      };
      this.connections.set(peerId, connection);

      this.emitEvent({
        type: 'connectionStateChanged',
        data: { peerId, state: ConnectionState.CONNECTING }
      });

      if (isNative()) {
        // Platform-specific connection
        if (isAndroid() && this.nearbyConnections) {
          await this.nearbyConnections.connect({
            endpointId: peerId,
            displayName: this.discoveredPeers.get(peerId)?.displayName || 'Unknown'
          });
        } else if (isIOS() && this.nearbyMultipeer) {
          await this.nearbyMultipeer.connect({
            endpointId: peerId,
            displayName: this.discoveredPeers.get(peerId)?.displayName || 'Unknown'
          });
        }
      } else {
        // Mock connection for web environment
        await this.mockConnectToPeer(peerId);
      }

    } catch (error) {
      // Update connection state to failed
      const connection = this.connections.get(peerId);
      if (connection) {
        connection.state = ConnectionState.FAILED;
        this.connections.set(peerId, connection);
      }

      this.emitEvent({
        type: 'connectionStateChanged',
        data: { peerId, state: ConnectionState.FAILED, error: error instanceof Error ? error.message : String(error) }
      });

      throw error;
    }
  }

  async disconnectFromPeer(peerId: string): Promise<void> {
    const connection = this.connections.get(peerId);
    if (!connection || connection.state === ConnectionState.DISCONNECTED) {
      return;
    }

    try {
      if (isNative()) {
        // Platform-specific disconnection
        if (isAndroid() && this.nearbyConnections) {
          await this.nearbyConnections.disconnect({ endpointId: peerId });
        } else if (isIOS() && this.nearbyMultipeer) {
          await this.nearbyMultipeer.disconnectFromEndpoint({ endpointId: peerId });
        }
      }

      // Update connection state
      connection.state = ConnectionState.DISCONNECTED;
      this.connections.set(peerId, connection);

      // Remove from connected peers list
      this.connectionState.connectedPeerIds =
        this.connectionState.connectedPeerIds.filter(id => id !== peerId);
      this.connectionState.lastUpdate = new Date();

      this.emitEvent({
        type: 'connectionStateChanged',
        data: { peerId, state: ConnectionState.DISCONNECTED }
      });

    } catch (error) {
      console.error(`Error disconnecting from peer ${peerId}:`, error);
      throw error;
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys())
      .map(peerId => this.disconnectFromPeer(peerId));

    try {
      await Promise.allSettled(disconnectPromises);
      this.connections.clear();
      this.connectionState.connectedPeerIds = [];
      this.connectionState.lastUpdate = new Date();
    } catch (error) {
      console.error('Error disconnecting all peers:', error);
      throw error;
    }
  }

  async sendMessage(packet: MeshPacket, targetPeerId?: string): Promise<TransmissionResult> {
    const messageId = packet.id;

    try {
      if (targetPeerId) {
        // Send to specific peer
        const connection = this.connections.get(targetPeerId);
        if (!connection || connection.state !== ConnectionState.CONNECTED) {
          throw new Error(`Not connected to peer ${targetPeerId}`);
        }

        if (isNative()) {
          // Platform-specific message sending
          if (isAndroid() && this.nearbyConnections) {
            await this.nearbyConnections.sendMessage({
              endpointId: targetPeerId,
              message: JSON.stringify(packet)
            });
          } else if (isIOS() && this.nearbyMultipeer) {
            await this.nearbyMultipeer.sendMessage({
              endpointId: targetPeerId,
              data: JSON.stringify(packet)
            });
          }
        } else {
          // Mock transmission for web environment
          await this.mockSendMessage(packet, targetPeerId);
        }

        return {
          success: true,
          messageId,
          peerId: targetPeerId,
          transmittedAt: new Date()
        };
      } else {
        // Broadcast to all connected peers
        const results = await this.broadcastMessage(packet);
        // Return the first result or a summary result
        if (results.length > 0) {
          return results[0]; // Return first result for consistency
        } else {
          return {
            success: false,
            messageId,
            peerId: 'broadcast',
            error: 'No peers connected for broadcast',
            transmittedAt: new Date()
          };
        }
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      return {
        success: false,
        messageId,
        peerId: targetPeerId,
        error: error instanceof Error ? error.message : String(error),
        transmittedAt: new Date()
      };
    }
  }

  async broadcastMessage(packet: MeshPacket): Promise<TransmissionResult[]> {
    const connectedPeers = this.getConnectedPeers();
    const results: TransmissionResult[] = [];

    // Send to all connected peers
    const sendPromises = connectedPeers.map(async (connection) => {
      try {
        const result = await this.sendMessage(packet, connection.peerId);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          messageId: packet.id,
          peerId: connection.peerId,
          error: error instanceof Error ? error.message : String(error),
          transmittedAt: new Date()
        });
      }
    });

    await Promise.allSettled(sendPromises);
    return results;
  }

  getConnectionState(): MeshNetworkState {
    return { ...this.connectionState };
  }

  getConnectedPeers(): PeerConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.state === ConnectionState.CONNECTED);
  }

  getDiscoveredPeers(): PeerInfo[] {
    return Array.from(this.discoveredPeers.values());
  }

  getNetworkTopology(): NetworkTopology {
    const connectedPeers = this.getConnectedPeers();
    const discoveredPeers = this.getDiscoveredPeers();

    // Simple hop count calculation (direct connections = 1 hop)
    const hopCount = new Map<string, number>();
    connectedPeers.forEach(peer => {
      hopCount.set(peer.peerId, 1);
    });

    return {
      localPeerId: this.generatePeerId(),
      connectedPeers,
      discoveredPeers,
      hopCount,
      lastUpdated: new Date()
    };
  }

  addEventListener(listener: MeshEventListener): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: MeshEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index >= 0) {
      this.eventListeners.splice(index, 1);
    }
  }

  async getSignalStrength(peerId: string): Promise<number | null> {
    const connection = this.connections.get(peerId);
    if (!connection || connection.state !== ConnectionState.CONNECTED) {
      return null;
    }

    try {
      if (isNative()) {
        // Signal strength not available in plugin APIs - use connection state
        // Both plugins track connection strength internally
        return connection.signalStrength || null;
      }
      return connection.signalStrength || null;
    } catch (error) {
      console.error(`Error getting signal strength for ${peerId}:`, error);
      return null;
    }
  }

  async getPlatformInfo(): Promise<{ platform: string; version: string; capabilities: string[] }> {
    const platform = Capacitor.getPlatform();

    try {
      if (isNative()) {
        // Platform info not available in plugin APIs - use Capacitor info
        const capabilities = [];

        if (isAndroid() && this.nearbyConnections) {
          capabilities.push('nearby_connections', 'mesh_networking');
        }
        if (isIOS() && this.nearbyMultipeer) {
          capabilities.push('multipeer_connectivity', 'mesh_networking');
        }

        return {
          platform,
          version: '1.0',
          capabilities
        };
      }

      return {
        platform,
        version: '1.0.0',
        capabilities: ['messaging', 'discovery', 'advertising']
      };
    } catch (error) {
      console.error('Error getting platform info:', error);
      return {
        platform,
        version: 'unknown',
        capabilities: []
      };
    }
  }

  // Private helper methods

  private setupNativeEventListeners(): void {
    if (!isNative()) return;

    // Setup platform-specific listeners
    if (isAndroid() && this.nearbyConnections) {
      this.setupAndroidEventListeners();
    }
    if (isIOS() && this.nearbyMultipeer) {
      this.setupIOSEventListeners();
    }
  }

  private setupAndroidEventListeners(): void {
    if (!this.nearbyConnections) return;

    // Peer discovered
    this.nearbyConnections.addListener('peerDiscovered', (data: unknown) => {
      const peerData = data as NativePeerDiscoveredEvent;
      const peerInfo: PeerInfo = {
        peerId: peerData.peerId,
        displayName: peerData.displayName || 'Unknown Device',
        platform: peerData.platform || 'unknown',
        capabilities: peerData.capabilities || [],
        lastSeen: new Date(),
        signalStrength: peerData.signalStrength || 0
      };

      this.discoveredPeers.set(peerData.peerId, peerInfo);
      this.connectionState.discoveredPeerIds = Array.from(this.discoveredPeers.keys());
      this.connectionState.lastUpdate = new Date();

      this.emitEvent({
        type: 'peerDiscovered',
        data: {
          peerId: peerInfo.peerId,
          displayName: peerInfo.displayName,
          platform: peerInfo.platform as 'android' | 'ios' | 'web',
          rssi: peerInfo.signalStrength
        }
      });
    });

    // Peer lost
    this.nearbyConnections.addListener('peerLost', (data: unknown) => {
      const lostData = data as NativePeerLostEvent;
      const peerId = lostData.peerId;
      this.discoveredPeers.delete(peerId);
      this.connectionState.discoveredPeerIds = Array.from(this.discoveredPeers.keys());
      this.connectionState.lastUpdate = new Date();

      this.emitEvent({
        type: 'peerLost',
        data: { peerId }
      });
    });

    // Connection state changed
    this.nearbyConnections.addListener('connectionStateChanged', (data: unknown) => {
      const connectionData = data as NativeConnectionStateChangedEvent;
      const peerId = connectionData.peerId;
      const state = connectionData.state as ConnectionState;

      const connection = this.connections.get(peerId);
      if (connection) {
        connection.state = state;
        if (state === ConnectionState.CONNECTED) {
          connection.connectedAt = new Date();
          if (!this.connectionState.connectedPeerIds.includes(peerId)) {
            this.connectionState.connectedPeerIds.push(peerId);
          }
        } else if (state === ConnectionState.DISCONNECTED) {
          this.connectionState.connectedPeerIds =
            this.connectionState.connectedPeerIds.filter(id => id !== peerId);
        }

        this.connectionState.lastUpdate = new Date();
        this.connections.set(peerId, connection);
      }

      this.emitEvent({
        type: 'connectionStateChanged',
        data: { peerId, state }
      });
    });

    // Message received
    this.nearbyConnections.addListener('messageReceived', (data: unknown) => {
      try {
        const messageData = data as NativeMessageReceivedEvent;
        const packet: MeshPacket = JSON.parse(messageData.message);
        this.emitEvent({
          type: 'messageReceived',
          data: { packet, fromPeerId: messageData.fromPeerId }
        });
      } catch (error) {
        console.error('Failed to parse received message:', error);
      }
    });

    // Error events
    this.nearbyConnections.addListener('error', (data: unknown) => {
      const errorData = data as NativeErrorEvent;
      this.emitEvent({
        type: 'error',
        data: {
          code: errorData.code || 'unknown',
          message: errorData.error || errorData.message || 'Unknown error',
          details: errorData
        }
      });
    });
  }

  private setupIOSEventListeners(): void {
    if (!this.nearbyMultipeer) return;

    // Peer discovered
    this.nearbyMultipeer.addListener('peerDiscovered', (data: unknown) => {
      const peerData = data as NativePeerDiscoveredEvent;
      const peerInfo: PeerInfo = {
        peerId: peerData.peerId,
        displayName: peerData.displayName || 'Unknown Device',
        platform: peerData.platform || 'unknown',
        capabilities: peerData.capabilities || [],
        lastSeen: new Date(),
        signalStrength: peerData.signalStrength || 0
      };

      this.discoveredPeers.set(peerData.peerId, peerInfo);
      this.connectionState.discoveredPeerIds = Array.from(this.discoveredPeers.keys());
      this.connectionState.lastUpdate = new Date();

      this.emitEvent({
        type: 'peerDiscovered',
        data: {
          peerId: peerInfo.peerId,
          displayName: peerInfo.displayName,
          platform: peerInfo.platform as 'android' | 'ios' | 'web',
          rssi: peerInfo.signalStrength
        }
      });
    });

    // Peer lost
    this.nearbyMultipeer.addListener('peerLost', (data: unknown) => {
      const lostData = data as NativePeerLostEvent;
      const peerId = lostData.peerId;
      this.discoveredPeers.delete(peerId);
      this.connectionState.discoveredPeerIds = Array.from(this.discoveredPeers.keys());
      this.connectionState.lastUpdate = new Date();

      this.emitEvent({
        type: 'peerLost',
        data: { peerId }
      });
    });

    // Connection state changed
    this.nearbyMultipeer.addListener('connectionStateChanged', (data: unknown) => {
      const connectionData = data as NativeConnectionStateChangedEvent;
      const peerId = connectionData.peerId;
      const state = connectionData.state as ConnectionState;

      const connection = this.connections.get(peerId);
      if (connection) {
        connection.state = state;
        if (state === ConnectionState.CONNECTED) {
          connection.connectedAt = new Date();
          if (!this.connectionState.connectedPeerIds.includes(peerId)) {
            this.connectionState.connectedPeerIds.push(peerId);
          }
        } else if (state === ConnectionState.DISCONNECTED) {
          this.connectionState.connectedPeerIds =
            this.connectionState.connectedPeerIds.filter(id => id !== peerId);
        }

        this.connectionState.lastUpdate = new Date();
        this.connections.set(peerId, connection);
      }

      this.emitEvent({
        type: 'connectionStateChanged',
        data: { peerId, state }
      });
    });

    // Message received
    this.nearbyMultipeer.addListener('messageReceived', (data: unknown) => {
      try {
        const messageData = data as NativeMessageReceivedEvent;
        const packet: MeshPacket = JSON.parse(messageData.message);
        this.emitEvent({
          type: 'messageReceived',
          data: { packet, fromPeerId: messageData.fromPeerId }
        });
      } catch (error) {
        console.error('Failed to parse received message:', error);
      }
    });

    // Error events
    this.nearbyMultipeer.addListener('error', (data: unknown) => {
      const errorData = data as NativeErrorEvent;
      this.emitEvent({
        type: 'error',
        data: {
          code: errorData.code || 'unknown',
          message: errorData.error || errorData.message || 'Unknown error',
          details: errorData
        }
      });
    });
  }

  private initializeMockImplementation(): void {
    // Mock implementation for web development
    console.log('Initializing mock mesh network implementation');
  }

  private mockDiscoverPeers(): void {
    // Simulate discovering some mock peers for development
    setTimeout(() => {
      const mockPeers: PeerInfo[] = [
        {
          peerId: 'mock-peer-1',
          displayName: 'Emergency Responder',
          platform: 'android',
          capabilities: ['messaging', 'file_transfer'],
          lastSeen: new Date(),
          signalStrength: 80
        },
        {
          peerId: 'mock-peer-2',
          displayName: 'Medical Team',
          platform: 'ios',
          capabilities: ['messaging', 'location'],
          lastSeen: new Date(),
          signalStrength: 65
        }
      ];

      mockPeers.forEach(peer => {
        this.discoveredPeers.set(peer.peerId, peer);
        this.emitEvent({
          type: 'peerDiscovered',
          data: {
            peerId: peer.peerId,
            displayName: peer.displayName,
            platform: peer.platform as 'android' | 'ios' | 'web'
          }
        });
      });

      this.connectionState.discoveredPeerIds = Array.from(this.discoveredPeers.keys());
      this.connectionState.lastUpdate = new Date();
    }, 2000);
  }

  private async mockConnectToPeer(peerId: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const connection = this.connections.get(peerId);
        if (connection) {
          connection.state = ConnectionState.CONNECTED;
          connection.connectedAt = new Date();
          this.connections.set(peerId, connection);

          if (!this.connectionState.connectedPeerIds.includes(peerId)) {
            this.connectionState.connectedPeerIds.push(peerId);
          }
          this.connectionState.lastUpdate = new Date();

          this.emitEvent({
            type: 'connectionStateChanged',
            data: { peerId, state: ConnectionState.CONNECTED }
          });
        }
        resolve();
      }, 1000);
    });
  }

  private async mockSendMessage(packet: MeshPacket, targetPeerId: string): Promise<void> {
    // Mock successful message transmission
    setTimeout(() => {
      this.emitEvent({
        type: 'messageSent',
        data: { messageId: packet.id, peerId: targetPeerId }
      });
    }, 100);
  }

  private emitEvent(event: MeshNetworkEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in mesh event listener:', error);
      }
    });
  }

  private generatePeerId(): string {
    // Generate a unique peer ID for this device
    const stored = localStorage.getItem('resqlink-peer-id');
    if (stored) return stored;

    const peerId = `peer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('resqlink-peer-id', peerId);
    return peerId;
  }
}

// Export singleton instance
export const meshNetwork = new MeshNetworkManager();

// Utility functions for mesh networking
export const getMeshNetworkManager = (): IMeshNetworkManager => meshNetwork;

export const isConnectedToPeer = (peerId: string): boolean => {
  const connectedPeers = meshNetwork.getConnectedPeers();
  return connectedPeers.some(peer => peer.peerId === peerId);
};

export const getConnectedPeerCount = (): number => {
  return meshNetwork.getConnectedPeers().length;
};

export const canSendMessage = (): boolean => {
  return getConnectedPeerCount() > 0;
};