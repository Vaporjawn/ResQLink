/**
 * Type declarations for mesh networking plugins
 * This provides development-time type safety until proper adapters are implemented
 */

import type { PluginListenerHandle } from '@capacitor/core';

declare module '@capacitor-trancee/nearby-connections' {
  export enum Strategy {
    P2P_CLUSTER = 'P2P_CLUSTER',
    P2P_STAR = 'P2P_STAR',
    P2P_POINT_TO_POINT = 'P2P_POINT_TO_POINT'
  }

  export interface InitializeOptions {
    endpointName: string;
    serviceID: string;
    strategy: Strategy;
    lowPower: boolean;
    autoConnect: boolean;
    payload: string;
  }

  export interface NearbyConnectionsPlugin {
    initialize(options?: InitializeOptions): Promise<void>;
    setStrategy?(options: { strategy: Strategy }): Promise<void>;
    startAdvertising(options: { endpointName?: string; displayName?: string }): Promise<void>;
    stopAdvertising(): Promise<void>;
    startDiscovery(): Promise<void>;
    stopDiscovery(): Promise<void>;
    connect(options: { endpointId: string; endpointName?: string; displayName?: string }): Promise<void>;
    acceptConnection(options: { endpointId: string }): Promise<void>;
    rejectConnection(options: { endpointId: string }): Promise<void>;
    disconnect(options?: { endpointId?: string }): Promise<void>;
    sendMessage(options: { endpointId: string; message: string }): Promise<void>;
    addListener(
        eventName: string,
        listenerFunc: (event: Record<string, unknown>) => void
      ): Promise<PluginListenerHandle>;
    removeAllListeners(): Promise<void>;
  }

  // Union type for different initialization options
export type MeshInitOptions =
  | { endpointName: string; serviceID: string; strategy: Strategy; lowPower: boolean; autoConnect: boolean; payload: string }
  | { serviceId: string; serviceUUIDString?: string };

export interface MeshNetworkPlugin {
  initialize(options: Record<string, unknown>): Promise<void>;
  setStrategy?(options: { strategy: string }): Promise<void>;
  startAdvertising(options: { endpointName?: string; displayName?: string }): Promise<void>;
  stopAdvertising(): Promise<void>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  connect(options: { endpointId: string; endpointName?: string; displayName?: string }): Promise<void>;
  acceptConnection(options: { endpointId: string }): Promise<void>;
  rejectConnection(options: { endpointId: string }): Promise<void>;
  disconnect(options?: { endpointId?: string }): Promise<void>;
  disconnectFromEndpoint?(options: { endpointId: string }): Promise<void>;
  sendMessage(options: { endpointId: string; message?: string; data?: string }): Promise<void>;
  addListener(
      eventName: string,
      listenerFunc: (event: Record<string, unknown>) => void
    ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

  const NearbyConnections: NearbyConnectionsPlugin;
  export { NearbyConnections };
}

declare module '@squareetlabs/capacitor-nearby-multipeer' {
  export interface NearbyMultipeerPlugin {
    initialize(options: { serviceId: string; serviceUUIDString?: string }): Promise<void>;
    setStrategy(options: { strategy: string }): Promise<void>;
    startAdvertising(options: { displayName?: string }): Promise<void>;
    stopAdvertising(): Promise<void>;
    startDiscovery(): Promise<void>;
    stopDiscovery(): Promise<void>;
    connect(options: { endpointId: string; displayName?: string }): Promise<void>;
    acceptConnection(options: { endpointId: string }): Promise<void>;
    rejectConnection(options: { endpointId: string }): Promise<void>;
    disconnectFromEndpoint(options: { endpointId: string }): Promise<void>;
    disconnect(): Promise<void>;
    sendMessage(options: { endpointId: string; data: string }): Promise<void>;
    addListener(
      eventName: string,
      listenerFunc: (event: Record<string, unknown>) => void
    ): Promise<PluginListenerHandle>;
    removeAllListeners(): Promise<void>;
  }

  const NearbyMultipeer: NearbyMultipeerPlugin;
  export { NearbyMultipeer };
}

// Re-export interfaces for use in other modules
export type { NearbyConnectionsPlugin, InitializeOptions, Strategy } from '@capacitor-trancee/nearby-connections';
export type { NearbyMultipeerPlugin } from '@squareetlabs/capacitor-nearby-multipeer';