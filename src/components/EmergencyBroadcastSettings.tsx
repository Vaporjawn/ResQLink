import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonButton,
  IonButtons,
  IonBackButton,
  IonCheckbox,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonTextarea,
  IonModal,
  IonFab,
  IonFabButton,
  IonIcon,
  IonAlert,
  IonToast,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,

} from '@ionic/react';
import {
  add,
  trash,
  location,
  notifications,
  flashOutline,
  save,
  volumeHighOutline,
  phonePortraitOutline
} from 'ionicons/icons';
import { useResQLinkStore } from '../lib/store';
import {
  EmergencyBroadcastService,
  AlertTemplate,
  GeographicZone,
  EmergencyAlertType,
  EmergencyAlertSeverity,
  EmergencyAlertCategory,
  BroadcastChannel
} from '../services/EmergencyBroadcastService';

interface EmergencyBroadcastSettingsProps {
  onBack: () => void;
}

interface BroadcastSettings {
  enableNotifications: boolean;
  enableAudioAlerts: boolean;
  enableVibrationAlerts: boolean;
  enableVisualAlerts: boolean;
  enableLocationBroadcasting: boolean;
  severityFilters: EmergencyAlertSeverity[];
  typeFilters: EmergencyAlertType[];
  autoAcknowledgment: boolean;
  broadcastRadius: number;
}

export const EmergencyBroadcastSettings: React.FC<EmergencyBroadcastSettingsProps> = () => {
  const { currentLocation } = useResQLinkStore();
  const [broadcastService] = useState(() => new EmergencyBroadcastService());
  const [settings, setSettings] = useState<BroadcastSettings>({
    enableNotifications: true,
    enableAudioAlerts: true,
    enableVibrationAlerts: true,
    enableVisualAlerts: true,
    enableLocationBroadcasting: true,
    severityFilters: [EmergencyAlertSeverity.MODERATE, EmergencyAlertSeverity.SEVERE, EmergencyAlertSeverity.EXTREME],
    typeFilters: Object.values(EmergencyAlertType),
    autoAcknowledgment: false,
    broadcastRadius: 5000 // 5km default
  });

  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [zones, setZones] = useState<GeographicZone[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AlertTemplate | null>(null);
  const [selectedZone, setSelectedZone] = useState<GeographicZone | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'template' | 'zone'; id: string } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [newTemplate, setNewTemplate] = useState<Partial<AlertTemplate>>({
    name: '',
    type: EmergencyAlertType.NATURAL_DISASTER,
    severity: EmergencyAlertSeverity.MINOR,
    titleTemplate: '',
    messageTemplate: '',
    instructionsTemplate: [],
    category: EmergencyAlertCategory.IMMEDIATE,
    defaultRadius: 1000,
    audioAlert: true,
    vibrationPattern: [200, 100, 200],
    channels: [BroadcastChannel.MESH_NETWORK, BroadcastChannel.SYSTEM_NOTIFICATION],
    variables: []
  });

  const [newZone, setNewZone] = useState<Partial<GeographicZone>>({
    name: '',
    type: 'circle',
    center: currentLocation ? {
      latitude: currentLocation.lat,
      longitude: currentLocation.lon,
      timestamp: Date.now()
    } : undefined,
    radius: 1000,
    description: ''
  });

  useEffect(() => {
    const loadData = async () => {
      const loadedTemplates = broadcastService.getTemplates();
      setTemplates(loadedTemplates);
      
      const loadedZones = broadcastService.getGeographicZones();
      setZones(loadedZones);
    };
    loadData();
  }, [broadcastService]);


  const handleSettingsChange = (key: keyof BroadcastSettings, value: boolean | number | EmergencyAlertSeverity[] | EmergencyAlertType[]) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSeverityToggle = (severity: EmergencyAlertSeverity, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      severityFilters: checked
        ? [...prev.severityFilters, severity]
        : prev.severityFilters.filter(s => s !== severity)
    }));
  };

  const handleTypeToggle = (type: EmergencyAlertType, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      typeFilters: checked
        ? [...prev.typeFilters, type]
        : prev.typeFilters.filter(t => t !== type)
    }));
  };

  const handleChannelToggle = (channel: BroadcastChannel, checked: boolean) => {
    setNewTemplate(prev => ({
      ...prev,
      channels: checked
        ? [...(prev.channels || []), channel]
        : (prev.channels || []).filter(c => c !== channel)
    }));
  };

  const saveTemplate = async () => {
    if (!newTemplate.name || !newTemplate.titleTemplate || !newTemplate.messageTemplate) {
      showMessage('Please fill in all required fields');
      return;
    }

    try {
      const template: AlertTemplate = {
        id: selectedTemplate?.id || `template_${Date.now()}`,
        name: newTemplate.name!,
        type: newTemplate.type!,
        severity: newTemplate.severity!,
        titleTemplate: newTemplate.titleTemplate!,
        messageTemplate: newTemplate.messageTemplate!,
        instructionsTemplate: Array.isArray(newTemplate.instructionsTemplate) ? newTemplate.instructionsTemplate : [],
        category: newTemplate.category || EmergencyAlertCategory.IMMEDIATE,
        channels: newTemplate.channels || [BroadcastChannel.MESH_NETWORK],
        defaultRadius: newTemplate.defaultRadius || 1000,
        audioAlert: newTemplate.audioAlert !== false,
        vibrationPattern: newTemplate.vibrationPattern || [500, 200, 500],
        variables: newTemplate.variables || []
      };

      if (selectedTemplate) {
        await broadcastService.updateTemplate(template);
      } else {
        await broadcastService.addTemplate(template);
      }

      const loadedTemplates = broadcastService.getTemplates();
      setTemplates(loadedTemplates);
      setShowTemplateModal(false);
      setSelectedTemplate(null);
      resetNewTemplate();
      showMessage(selectedTemplate ? 'Template updated successfully' : 'Template created successfully');
    } catch (error) {
      console.error('Error saving template:', error);
      showMessage('Failed to save template');
    }
  };

  const saveZone = async () => {
    if (!newZone.name || !newZone.center) {
      showMessage('Please fill in all required fields');
      return;
    }

    try {
      const zone: GeographicZone = {
        id: selectedZone?.id || `zone_${Date.now()}`,
        name: newZone.name!,
        description: newZone.description || '',
        type: 'circle',
        center: newZone.center!,
        radius: newZone.radius || 1000,

      };

      if (selectedZone) {
        await broadcastService.updateGeographicZone(zone);
      } else {
        await broadcastService.addGeographicZone(zone);
      }

      const loadedZones = broadcastService.getGeographicZones();
      setZones(loadedZones);
      setShowZoneModal(false);
      setSelectedZone(null);
      resetNewZone();
      showMessage(selectedZone ? 'Zone updated successfully' : 'Zone created successfully');
    } catch (error) {
      console.error('Error saving zone:', error);
      showMessage('Failed to save zone');
    }
  };

  const editTemplate = (template: AlertTemplate) => {
    setSelectedTemplate(template);
    setNewTemplate(template);
    setShowTemplateModal(true);
  };

  const editZone = (zone: GeographicZone) => {
    setSelectedZone(zone);
    setNewZone(zone);
    setShowZoneModal(true);
  };

  const confirmDelete = (type: 'template' | 'zone', id: string) => {
    setDeleteTarget({ type, id });
    setShowDeleteAlert(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'template') {
        await broadcastService.removeTemplate(deleteTarget.id);
        const loadedTemplates = broadcastService.getTemplates();
        setTemplates(loadedTemplates);
      } else {
        await broadcastService.removeGeographicZone(deleteTarget.id);
        const loadedZones = broadcastService.getGeographicZones();
        setZones(loadedZones);
      }
      showMessage(`${deleteTarget.type === 'template' ? 'Template' : 'Zone'} deleted successfully`);
    } catch (error) {
      console.error('Error deleting:', error);
      showMessage(`Failed to delete ${deleteTarget.type}`);
    }

    setDeleteTarget(null);
    setShowDeleteAlert(false);
  };

  const resetNewTemplate = () => {
    setNewTemplate({
      name: '',
      type: EmergencyAlertType.NATURAL_DISASTER,
      severity: EmergencyAlertSeverity.MODERATE,
      titleTemplate: '',
      messageTemplate: '',
      instructionsTemplate: [],
      category: EmergencyAlertCategory.IMMEDIATE,
      channels: [BroadcastChannel.MESH_NETWORK, BroadcastChannel.SYSTEM_NOTIFICATION],

      defaultRadius: 1000
    });
  };

  const resetNewZone = () => {
    setNewZone({
      name: '',
      description: '',
      center: currentLocation ? {
        latitude: currentLocation.lat,
        longitude: currentLocation.lon,
        timestamp: Date.now()
      } : undefined,
      radius: 1000
    });
  };

  const showMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const getSeverityColor = (severity: EmergencyAlertSeverity) => {
    switch (severity) {
      case EmergencyAlertSeverity.MINOR: return 'primary';
      case EmergencyAlertSeverity.MODERATE: return 'warning';
      case EmergencyAlertSeverity.SEVERE: return 'danger';
      case EmergencyAlertSeverity.EXTREME: return 'dark';
      default: return 'medium';
    }
  };

  const getTypeIcon = (type: EmergencyAlertType) => {
    switch (type) {
      case EmergencyAlertType.FIRE:
        return '🔥';
      case EmergencyAlertType.FLOOD:
        return '🌊';
      case EmergencyAlertType.EARTHQUAKE:
        return '🏔️';
      case EmergencyAlertType.SEVERE_WEATHER:
        return '🌪️';
      case EmergencyAlertType.NATURAL_DISASTER:
        return '🌋';
      case EmergencyAlertType.SECURITY_THREAT:
        return '🚨';
      case EmergencyAlertType.MEDICAL_EMERGENCY:
        return '🏥';
      case EmergencyAlertType.EVACUATION:
        return '�';
      case EmergencyAlertType.SHELTER_ADVISORY:
        return '🏠';
      case EmergencyAlertType.ALL_CLEAR:
        return '✅';
      case EmergencyAlertType.TEST_ALERT:
        return '🔧';
      case EmergencyAlertType.INFRASTRUCTURE_FAILURE:
        return '⚠️';
      default:
        return '⚠️';
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>Emergency Broadcasting</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Broadcast Settings</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              <IonItem>
                <IonIcon icon={notifications} slot="start" />
                <IonLabel>System Notifications</IonLabel>
                <IonToggle
                  checked={settings.enableNotifications}
                  onToggle={e => handleSettingsChange('enableNotifications', (e.target as HTMLIonToggleElement).checked)}
                />
              </IonItem>

              <IonItem>
                <IonIcon icon={volumeHighOutline} slot="start" />
                <IonLabel>Audio Alerts</IonLabel>
                <IonToggle
                  checked={settings.enableAudioAlerts}
                  onToggle={e => handleSettingsChange('enableAudioAlerts', (e.target as HTMLIonToggleElement).checked)}
                />
              </IonItem>

              <IonItem>
                <IonIcon icon={phonePortraitOutline} slot="start" />
                <IonLabel>Vibration Alerts</IonLabel>
                <IonToggle
                  checked={settings.enableVibrationAlerts}
                  onToggle={e => handleSettingsChange('enableVibrationAlerts', (e.target as HTMLIonToggleElement).checked)}
                />
              </IonItem>

              <IonItem>
                <IonIcon icon={flashOutline} slot="start" />
                <IonLabel>Visual Flash Alerts</IonLabel>
                <IonToggle
                  checked={settings.enableVisualAlerts}
                  onToggle={e => handleSettingsChange('enableVisualAlerts', (e.target as HTMLIonToggleElement).checked)}
                />
              </IonItem>

              <IonItem>
                <IonIcon icon={location} slot="start" />
                <IonLabel>Location Broadcasting</IonLabel>
                <IonToggle
                  checked={settings.enableLocationBroadcasting}
                  onToggle={e => handleSettingsChange('enableLocationBroadcasting', (e.target as HTMLIonToggleElement).checked)}
                />
              </IonItem>

              <IonItem>
                <IonLabel>Auto-Acknowledgment</IonLabel>
                <IonToggle
                  checked={settings.autoAcknowledgment}
                  onToggle={e => handleSettingsChange('autoAcknowledgment', (e.target as HTMLIonToggleElement).checked)}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Default Broadcast Radius (meters)</IonLabel>
                <IonInput
                  type="number"
                  value={settings.broadcastRadius}
                  onIonInput={e => handleSettingsChange('broadcastRadius', parseInt(e.detail.value!, 10) || 5000)}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Alert Severity Filters</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonGrid>
              <IonRow>
                {Object.values(EmergencyAlertSeverity).map(severity => (
                  <IonCol size="6" key={severity}>
                    <IonItem lines="none">
                      <IonCheckbox
                        slot="start"
                        checked={settings.severityFilters.includes(severity)}
                        onIonChange={e => handleSeverityToggle(severity, e.detail.checked)}
                      />
                      <IonLabel>
                        <IonChip color={getSeverityColor(severity)}>
                          {severity.toUpperCase()}
                        </IonChip>
                      </IonLabel>
                    </IonItem>
                  </IonCol>
                ))}
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Alert Type Filters</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonGrid>
              <IonRow>
                {Object.values(EmergencyAlertType).map(type => (
                  <IonCol size="6" key={type}>
                    <IonItem lines="none">
                      <IonCheckbox
                        slot="start"
                        checked={settings.typeFilters.includes(type)}
                        onIonChange={e => handleTypeToggle(type, e.detail.checked)}
                      />
                      <IonLabel>
                        <span style={{ marginRight: '8px' }}>{getTypeIcon(type)}</span>
                        {type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </IonLabel>
                    </IonItem>
                  </IonCol>
                ))}
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Alert Templates ({templates.length})</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {templates.length === 0 ? (
              <p>No alert templates configured. Create one to get started.</p>
            ) : (
              templates.map(template => (
                <IonItem key={template.id} button onClick={() => editTemplate(template)}>
                  <IonLabel>
                    <h3>{template.name}</h3>
                    <p>
                      <span style={{ marginRight: '8px' }}>{getTypeIcon(template.type)}</span>
                      {template.type.replace(/_/g, ' ')} -
                      <IonChip color={getSeverityColor(template.severity)} style={{ marginLeft: '8px' }}>
                        {template.severity}
                      </IonChip>
                    </p>
                  </IonLabel>
                  <IonButton
                    fill="clear"
                    color="danger"
                    slot="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete('template', template.id);
                    }}
                  >
                    <IonIcon icon={trash} />
                  </IonButton>
                </IonItem>
              ))
            )}
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Geographic Zones ({zones.length})</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {zones.length === 0 ? (
              <p>No geographic zones configured. Create one to enable location-based broadcasting.</p>
            ) : (
              zones.map(zone => (
                <IonItem key={zone.id} button onClick={() => editZone(zone)}>
                  <IonLabel>
                    <h3>{zone.name}</h3>
                    <p>{zone.description}</p>
                    <p>Radius: {zone.radius}m</p>
                  </IonLabel>
                  <IonButton
                    fill="clear"
                    color="danger"
                    slot="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete('zone', zone.id);
                    }}
                  >
                    <IonIcon icon={trash} />
                  </IonButton>
                </IonItem>
              ))
            )}
          </IonCardContent>
        </IonCard>

        {/* Floating Action Buttons */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowTemplateModal(true)}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonFab vertical="bottom" horizontal="start" slot="fixed">
          <IonFabButton onClick={() => setShowZoneModal(true)}>
            <IonIcon icon={location} />
          </IonFabButton>
        </IonFab>

        {/* Template Modal */}
        <IonModal isOpen={showTemplateModal} onDidDismiss={() => {
          setShowTemplateModal(false);
          setSelectedTemplate(null);
          resetNewTemplate();
        }}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{selectedTemplate ? 'Edit Template' : 'New Alert Template'}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowTemplateModal(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <IonList>
              <IonItem>
                <IonLabel position="stacked">Template Name *</IonLabel>
                <IonInput
                  value={newTemplate.name}
                  onIonInput={e => setNewTemplate(prev => ({ ...prev, name: e.detail.value! }))}
                  placeholder="Enter template name"
                />
              </IonItem>

              <IonItem>
                <IonLabel>Alert Type</IonLabel>
                <IonSelect
                  value={newTemplate.type}
                  onIonChange={(e: CustomEvent) => setNewTemplate(prev => ({ ...prev, type: e.detail.value as EmergencyAlertType }))}
                >
                  {Object.values(EmergencyAlertType).map(type => (
                    <IonSelectOption key={type} value={type}>
                      {getTypeIcon(type)} {type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel>Severity Level</IonLabel>
                <IonSelect
                  value={newTemplate.severity}
                  onIonChange={(e: CustomEvent) => setNewTemplate(prev => ({ ...prev, severity: e.detail.value }))}
                >
                  {Object.values(EmergencyAlertSeverity).map(severity => (
                    <IonSelectOption key={severity} value={severity}>
                      {severity.toUpperCase()}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Title Template *</IonLabel>
                <IonInput
                  value={newTemplate.titleTemplate}
                  onIonInput={e => setNewTemplate(prev => ({ ...prev, titleTemplate: e.detail.value! }))}
                  placeholder="e.g., {{alertType}} Alert in {{location}}"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Message Template *</IonLabel>
                <IonTextarea
                  value={newTemplate.messageTemplate}
                  onIonInput={e => setNewTemplate(prev => ({ ...prev, messageTemplate: e.detail.value! }))}
                  placeholder="Use {{variables}} for dynamic content"
                  rows={3}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Instructions Template</IonLabel>
                <IonTextarea
                  value={Array.isArray(newTemplate.instructionsTemplate) ? newTemplate.instructionsTemplate.join('\n') : ''}
                  onIonInput={e => setNewTemplate(prev => ({ 
                    ...prev, 
                    instructionsTemplate: e.detail.value!.split('\n').filter(line => line.trim() !== '')
                  }))}
                  placeholder="Safety instructions and actions to take (one per line)"
                  rows={3}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Category</IonLabel>
                <IonInput
                  value={newTemplate.category}
                  onIonInput={e => setNewTemplate(prev => ({ 
                    ...prev, 
                    category: e.detail.value! as EmergencyAlertCategory 
                  }))}
                  placeholder="Emergency, Weather, Safety, etc."
                />
              </IonItem>



              <IonItem>
                <IonLabel position="stacked">Default Radius (meters)</IonLabel>
                <IonInput
                  type="number"
                  value={newTemplate.defaultRadius}
                  onIonInput={e => setNewTemplate(prev => ({ ...prev, defaultRadius: parseInt(e.detail.value!, 10) || 1000 }))}
                />
              </IonItem>

              <IonItem>
                <IonLabel>Broadcast Channels</IonLabel>
              </IonItem>
              {Object.values(BroadcastChannel).map(channel => (
                <IonItem key={channel}>
                  <IonCheckbox
                    slot="start"
                    checked={newTemplate.channels?.includes(channel) || false}
                    onIonChange={e => handleChannelToggle(channel, e.detail.checked)}
                  />
                  <IonLabel>{channel.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</IonLabel>
                </IonItem>
              ))}

              <IonItem>
                <IonButton expand="block" onClick={saveTemplate}>
                  <IonIcon icon={save} slot="start" />
                  {selectedTemplate ? 'Update Template' : 'Create Template'}
                </IonButton>
              </IonItem>
            </IonList>
          </IonContent>
        </IonModal>

        {/* Zone Modal */}
        <IonModal isOpen={showZoneModal} onDidDismiss={() => {
          setShowZoneModal(false);
          setSelectedZone(null);
          resetNewZone();
        }}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{selectedZone ? 'Edit Zone' : 'New Geographic Zone'}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowZoneModal(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <IonList>
              <IonItem>
                <IonLabel position="stacked">Zone Name *</IonLabel>
                <IonInput
                  value={newZone.name}
                  onIonInput={e => setNewZone(prev => ({ ...prev, name: e.detail.value! }))}
                  placeholder="Enter zone name"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Description</IonLabel>
                <IonTextarea
                  value={newZone.description}
                  onIonInput={e => setNewZone(prev => ({ ...prev, description: e.detail.value! }))}
                  placeholder="Describe this geographic zone"
                  rows={2}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Coverage Radius (meters)</IonLabel>
                <IonInput
                  type="number"
                  value={newZone.radius}
                  onIonInput={e => setNewZone(prev => ({ ...prev, radius: parseInt(e.detail.value!, 10) || 1000 }))}
                />
              </IonItem>



              <IonItem>
                <IonLabel>Center Location</IonLabel>
                <IonButton
                  fill="outline"
                  size="small"
                  onClick={() => {
                    if (currentLocation) {
                      setNewZone(prev => ({
                        ...prev,
                        center: {
                          latitude: currentLocation.lat,
                          longitude: currentLocation.lon,
                          timestamp: Date.now()
                        }
                      }));
                      showMessage('Current location set as zone center');
                    } else {
                      showMessage('Location not available');
                    }
                  }}
                >
                  Use Current Location
                </IonButton>
              </IonItem>

              {newZone.center && (
                <IonItem>
                  <IonLabel>
                    <p>Lat: {newZone.center.latitude.toFixed(6)}</p>
                    <p>Lon: {newZone.center.longitude.toFixed(6)}</p>
                  </IonLabel>
                </IonItem>
              )}

              <IonItem>
                <IonButton expand="block" onClick={saveZone}>
                  <IonIcon icon={save} slot="start" />
                  {selectedZone ? 'Update Zone' : 'Create Zone'}
                </IonButton>
              </IonItem>
            </IonList>
          </IonContent>
        </IonModal>

        {/* Delete Confirmation Alert */}
        <IonAlert
          isOpen={showDeleteAlert}
          onDidDismiss={() => setShowDeleteAlert(false)}
          header="Confirm Delete"
          message={`Are you sure you want to delete this ${deleteTarget?.type}?`}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel'
            },
            {
              text: 'Delete',
              role: 'destructive',
              handler: handleDelete
            }
          ]}
        />

        {/* Toast Messages */}
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={3000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};