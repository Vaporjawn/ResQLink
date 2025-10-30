/**
 * NetworkTopology Component
 *
 * Visualizes the mesh network as an interactive node graph showing:
 * - Current device as center node
 * - Connected peers as surrounding nodes
 * - Signal strength indicators
 * - Real-time network updates
 *
 * Implements Task 6.1.1: Create Network Topology View
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonIcon,
  IonChip,
  IonLabel,
  IonSpinner,
} from '@ionic/react';
import {
  refreshOutline,
  expandOutline,
  contractOutline,
  wifiOutline,
  closeCircleOutline,
} from 'ionicons/icons';
import { NetworkTopology as NetworkTopologyData } from '../lib/mesh';

// Canvas dimensions and layout constants
const WIDTH = 400;
const HEIGHT = 400;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const CONNECTED_RADIUS = 100;
const DISCOVERED_RADIUS = 150;

interface NetworkTopologyProps {
  /** Mesh network manager instance */
  getTopology: () => NetworkTopologyData;
  /** Whether to show detailed peer information */
  showDetails?: boolean;
  /** Update interval in milliseconds (default: 2000) */
  updateInterval?: number;
}

interface NodePosition {
  x: number;
  y: number;
  peerId: string;
  label: string;
  signalStrength?: number;
  isConnected: boolean;
  isLocal: boolean;
}

/**
 * NetworkTopology Component
 * Visualizes mesh network structure with SVG-based node graph
 */
const NetworkTopology: React.FC<NetworkTopologyProps> = ({
  getTopology,
  showDetails = true,
  updateInterval = 2000,
}) => {
  const [topology, setTopology] = useState<NetworkTopologyData | null>(null);
  const [nodes, setNodes] = useState<NodePosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update topology data
  const updateTopology = useCallback(() => {
    try {
      const newTopology = getTopology();
      setTopology(newTopology);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to get network topology:', error);
      setIsLoading(false);
    }
  }, [getTopology]);

  // Calculate node positions in circular layout
  useEffect(() => {
    if (!topology) return;

    const positions: NodePosition[] = [];

    // Add local node at center
    positions.push({
      x: CENTER_X,
      y: CENTER_Y,
      peerId: topology.localPeerId,
      label: 'You',
      isConnected: true,
      isLocal: true,
    });

    // Add connected peers in inner circle
    const connectedCount = topology.connectedPeers.length;
    topology.connectedPeers.forEach((peer, index) => {
      const angle = (2 * Math.PI * index) / Math.max(connectedCount, 1);
      positions.push({
        x: CENTER_X + CONNECTED_RADIUS * Math.cos(angle),
        y: CENTER_Y + CONNECTED_RADIUS * Math.sin(angle),
        peerId: peer.peerId,
        label: peer.peerInfo.displayName || peer.peerId.substring(0, 8),
        signalStrength: peer.signalStrength,
        isConnected: true,
        isLocal: false,
      });
    });

    // Add discovered peers in outer circle
    const discoveredCount = topology.discoveredPeers.length;
    topology.discoveredPeers
      .filter(peer => !topology.connectedPeers.find(cp => cp.peerId === peer.peerId))
      .forEach((peer, index) => {
        const angle = (2 * Math.PI * index) / Math.max(discoveredCount, 1);
        positions.push({
          x: CENTER_X + DISCOVERED_RADIUS * Math.cos(angle),
          y: CENTER_Y + DISCOVERED_RADIUS * Math.sin(angle),
          peerId: peer.peerId,
          label: peer.displayName || peer.peerId.substring(0, 8),
          signalStrength: peer.signalStrength,
          isConnected: false,
          isLocal: false,
        });
      });

    setNodes(positions);
  }, [topology]);

  // Auto-update topology
  useEffect(() => {
    updateTopology();
    const interval = setInterval(updateTopology, updateInterval);
    return () => clearInterval(interval);
  }, [updateInterval, updateTopology]);

  // Pan and zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prevZoom => Math.min(Math.max(prevZoom * delta, 0.5), 3));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset view
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Get connection strength color
  const getStrengthColor = (strength?: number): string => {
    if (strength === undefined) return '#6c757d';
    if (strength >= 75) return '#2dd36f';
    if (strength >= 50) return '#ffc409';
    if (strength >= 25) return '#ff6d00';
    return '#eb445a';
  };

  // Get node color based on trust level
  const getNodeColor = (node: NodePosition): string => {
    if (node.isLocal) return '#3880ff';
    if (node.isConnected) return '#2dd36f';
    return '#6c757d';
  };

  if (isLoading) {
    return (
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Network Topology</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <IonSpinner />
            <p>Loading network data...</p>
          </div>
        </IonCardContent>
      </IonCard>
    );
  }

  return (
    <IonCard>
      <IonCardHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <IonCardTitle>Network Topology</IonCardTitle>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <IonButton size="small" fill="clear" onClick={updateTopology} aria-label="Refresh topology">
              <IonIcon slot="icon-only" icon={refreshOutline} />
            </IonButton>
            <IonButton size="small" fill="clear" onClick={() => setZoom(zoom * 1.2)} aria-label="Zoom in">
              <IonIcon slot="icon-only" icon={expandOutline} />
            </IonButton>
            <IonButton size="small" fill="clear" onClick={() => setZoom(zoom * 0.8)} aria-label="Zoom out">
              <IonIcon slot="icon-only" icon={contractOutline} />
            </IonButton>
            <IonButton size="small" fill="clear" onClick={resetView} aria-label="Reset view">
              <IonIcon slot="icon-only" icon={closeCircleOutline} />
            </IonButton>
          </div>
        </div>
      </IonCardHeader>
      <IonCardContent>
        {/* Network Statistics */}
        {showDetails && topology && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <IonChip color="primary">
              <IonIcon icon={wifiOutline} aria-hidden="true" />
              <IonLabel>{topology.connectedPeers.length} Connected</IonLabel>
            </IonChip>
            <IonChip color="medium">
              <IonLabel>{topology.discoveredPeers.length} Discovered</IonLabel>
            </IonChip>
            <IonChip color="medium">
              <IonLabel>Zoom: {Math.round(zoom * 100)}%</IonLabel>
            </IonChip>
          </div>
        )}

        {/* SVG Visualization */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '400px',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            border: '1px solid var(--ion-color-medium)',
            borderRadius: '8px',
            backgroundColor: 'var(--ion-color-step-50)',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            width={WIDTH}
            height={HEIGHT}
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s ease',
            }}
          >
            {/* Connection lines */}
            <g>
              {nodes
                .filter(node => !node.isLocal)
                .map(node => {
                  const localNode = nodes.find(n => n.isLocal);
                  if (!localNode || !node.isConnected) return null;

                  return (
                    <line
                      key={`line-${node.peerId}`}
                      x1={localNode.x}
                      y1={localNode.y}
                      x2={node.x}
                      y2={node.y}
                      stroke={getStrengthColor(node.signalStrength)}
                      strokeWidth={node.isConnected ? 2 : 1}
                      strokeDasharray={node.isConnected ? '0' : '5,5'}
                      opacity={node.isConnected ? 0.8 : 0.3}
                    />
                  );
                })}
            </g>

            {/* Nodes */}
            <g>
              {nodes.map(node => (
                <g key={node.peerId}>
                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.isLocal ? 20 : 15}
                    fill={getNodeColor(node)}
                    stroke="#fff"
                    strokeWidth="2"
                    opacity={0.9}
                  />

                  {/* Signal strength indicator */}
                  {node.signalStrength !== undefined && !node.isLocal && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={12}
                      fill="none"
                      stroke={getStrengthColor(node.signalStrength)}
                      strokeWidth="2"
                      opacity={0.6}
                    />
                  )}

                  {/* Node label */}
                  <text
                    x={node.x}
                    y={node.y + (node.isLocal ? 35 : 30)}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--ion-text-color)"
                    fontWeight={node.isLocal ? 'bold' : 'normal'}
                  >
                    {node.label}
                  </text>

                  {/* Signal strength text */}
                  {node.signalStrength !== undefined && !node.isLocal && (
                    <text
                      x={node.x}
                      y={node.y + 45}
                      textAnchor="middle"
                      fontSize="8"
                      fill="var(--ion-color-medium)"
                    >
                      {Math.round(node.signalStrength)}%
                    </text>
                  )}
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Legend */}
        {showDetails && (
          <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#3880ff' }} />
                <span>Local Device</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#2dd36f' }} />
                <span>Connected</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#6c757d' }} />
                <span>Discovered</span>
              </div>
            </div>
          </div>
        )}

        {/* Help text */}
        <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--ion-color-medium)' }}>
          Drag to pan • Scroll to zoom • Updates every {updateInterval / 1000}s
        </p>
      </IonCardContent>
    </IonCard>
  );
};

export default NetworkTopology;
