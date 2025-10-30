/**
 * ResQLink Mesh - Emergency Contacts Component
 * Manages emergency contacts, group creation, and contact verification
 */

import React, { useState } from 'react';
import './EmergencyContacts.css';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonBadge,
  IonFab,
  IonFabButton,
  IonActionSheet,
  IonModal,
  IonInput,
  IonTextarea,
  IonCheckbox,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonChip,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonToast,
  IonItemSliding,
  IonItemOptions,
  IonItemOption
} from '@ionic/react';
import {
  addOutline,
  qrCodeOutline,
  shieldCheckmarkOutline,
  closeCircleOutline,
  checkmarkCircleOutline,
  personAddOutline,
  createOutline,
  informationCircleOutline,
  personCircleOutline,
  filterOutline,
  chatbubbleOutline,
  trashOutline,
  shareOutline,
  peopleOutline
} from 'ionicons/icons';

import { Contact, Group, TrustLevel } from '../lib/schema';
import { useResQLinkStore } from '../lib/store';
import { ChatInterface } from './ChatInterface';
import './EmergencyContacts.css';

interface EmergencyContactsProps {
  onClose?: () => void;
}

// Trust level indicator component
const TrustIndicator: React.FC<{ trustLevel: TrustLevel }> = React.memo(({ trustLevel }) => {
  const getTrustIcon = () => {
    switch (trustLevel) {
      case 'verified': return checkmarkCircleOutline;
      case 'known': return shieldCheckmarkOutline;
      case 'unknown': return informationCircleOutline;
      case 'untrusted': return closeCircleOutline;
      default: return informationCircleOutline;
    }
  };

  const getTrustColor = () => {
    switch (trustLevel) {
      case 'verified': return 'success';
      case 'known': return 'primary';
      case 'unknown': return 'medium';
      case 'untrusted': return 'danger';
      default: return 'medium';
    }
  };

  return (
    <IonChip color={getTrustColor()}>
      <IonIcon icon={getTrustIcon()} />
      <IonLabel>{trustLevel}</IonLabel>
    </IonChip>
  );
});

TrustIndicator.displayName = 'TrustIndicator';

// Contact form component
interface ContactFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contactData: { alias: string; ed25519Pub: string; x25519Pub: string; trustLevel?: TrustLevel; isEmergencyContact?: boolean; notes?: string }) => Promise<void>;
  initialData?: Partial<Contact>;
  title: string;
}

const ContactForm: React.FC<ContactFormProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData = {},
  title
}) => {
  const [formData, setFormData] = useState({
    alias: initialData.alias || '',
    ed25519Pub: initialData.ed25519Pub || '',
    x25519Pub: initialData.x25519Pub || '',
    isEmergencyContact: initialData.isEmergencyContact || false,
    trustLevel: initialData.trustLevel || 'unknown' as TrustLevel,
    notes: initialData.notes || ''
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.alias.trim() || !formData.ed25519Pub.trim() || !formData.x25519Pub.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        alias: formData.alias.trim(),
        ed25519Pub: formData.ed25519Pub.trim(),
        x25519Pub: formData.x25519Pub.trim(),
        trustLevel: formData.trustLevel,
        isEmergencyContact: formData.isEmergencyContact,
        notes: formData.notes.trim() || undefined
      });
      onClose();
    } catch {
      console.error('Failed to save contact');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            onClick={onClose}
          >
            <IonIcon icon={addOutline} style={{ transform: 'rotate(45deg)' }} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList>
          <IonItem>
            <IonLabel position="stacked">Display Name *</IonLabel>
            <IonInput
              value={formData.alias}
              placeholder="Enter contact name"
              onIonInput={(e) => setFormData(prev => ({
                ...prev,
                alias: e.detail.value!
              }))}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Ed25519 Public Key *</IonLabel>
            <IonTextarea
              value={formData.ed25519Pub}
              placeholder="Paste Ed25519 signing key"
              rows={3}
              onIonInput={(e) => setFormData(prev => ({
                ...prev,
                ed25519Pub: e.detail.value!
              }))}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">X25519 Public Key *</IonLabel>
            <IonTextarea
              value={formData.x25519Pub}
              placeholder="Paste X25519 encryption key"
              rows={3}
              onIonInput={(e) => setFormData(prev => ({
                ...prev,
                x25519Pub: e.detail.value!
              }))}
            />
          </IonItem>

          <IonItem>
            <IonCheckbox
              checked={formData.isEmergencyContact}
              onIonChange={(e) => setFormData(prev => ({
                ...prev,
                isEmergencyContact: e.detail.checked
              }))}
            />
            <IonLabel className="ion-margin-start">
              Mark as Emergency Contact
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Notes</IonLabel>
            <IonTextarea
              value={formData.notes}
              placeholder="Optional notes about this contact"
              rows={3}
              onIonInput={(e) => setFormData(prev => ({
                ...prev,
                notes: e.detail.value!
              }))}
            />
          </IonItem>

          <div className="ion-padding-top">
            <TrustIndicator trustLevel={formData.trustLevel} />
          </div>
        </IonList>

        <div className="ion-padding-top">
          <IonButton
            expand="block"
            onClick={handleSubmit}
            disabled={!formData.alias.trim() || !formData.ed25519Pub.trim() || !formData.x25519Pub.trim() || isLoading}
          >
            {isLoading ? 'Saving...' : title.includes('Edit') ? 'Update Contact' : 'Add Contact'}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
};

// Group form component
interface GroupFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (groupData: { name: string; description?: string; memberPubs: string[] }) => Promise<void>;
  initialData?: Partial<Group>;
  contacts: Contact[];
  title: string;
}

const GroupForm: React.FC<GroupFormProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData = {},
  contacts,
  title
}) => {
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    description: initialData.description || '',
    memberPubs: initialData.memberPubs || []
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name.trim() || formData.memberPubs.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        memberPubs: formData.memberPubs
      });
      onClose();
    } catch {
      console.error('Failed to save group');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMember = (pubKey: string) => {
    setFormData(prev => ({
      ...prev,
      memberPubs: prev.memberPubs.includes(pubKey)
        ? prev.memberPubs.filter(p => p !== pubKey)
        : [...prev.memberPubs, pubKey]
    }));
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            onClick={onClose}
          >
            <IonIcon icon={addOutline} style={{ transform: 'rotate(45deg)' }} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList>
          <IonItem>
            <IonLabel position="stacked">Group Name *</IonLabel>
            <IonInput
              value={formData.name}
              placeholder="Enter group name"
              onIonInput={(e) => setFormData(prev => ({
                ...prev,
                name: e.detail.value!
              }))}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Description</IonLabel>
            <IonTextarea
              value={formData.description}
              placeholder="Optional group description"
              rows={3}
              onIonInput={(e) => setFormData(prev => ({
                ...prev,
                description: e.detail.value!
              }))}
            />
          </IonItem>
        </IonList>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Select Members ({formData.memberPubs.length} selected)</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              {contacts.map((contact) => (
                <IonItem key={contact.ed25519Pub}>
                  <IonCheckbox
                    checked={formData.memberPubs.includes(contact.x25519Pub)}
                    onIonChange={() => toggleMember(contact.x25519Pub)}
                  />
                  <IonLabel className="ion-margin-start">
                    <h3>{contact.alias}</h3>
                    <p>{contact.fingerprint}</p>
                  </IonLabel>
                  <TrustIndicator trustLevel={contact.trustLevel} />
                </IonItem>
              ))}
              {contacts.length === 0 && (
                <IonItem>
                  <IonLabel>
                    <p>No contacts available. Add contacts first to create groups.</p>
                  </IonLabel>
                </IonItem>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        <div className="ion-padding-top">
          <IonButton
            expand="block"
            onClick={handleSubmit}
            disabled={!formData.name.trim() || formData.memberPubs.length === 0 || isLoading}
          >
            {isLoading ? 'Saving...' : title.includes('Edit') ? 'Update Group' : 'Create Group'}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
};

// Contact verification component
interface ContactVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact;
  onVerify: (contactPub: string, trustLevel: TrustLevel) => Promise<void>;
}

const ContactVerification: React.FC<ContactVerificationProps> = ({
  isOpen,
  onClose,
  contact,
  onVerify
}) => {
  const [selectedTrustLevel, setSelectedTrustLevel] = useState<TrustLevel>(contact.trustLevel);
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    setIsLoading(true);
    try {
      await onVerify(contact.ed25519Pub, selectedTrustLevel);
      onClose();
    } catch {
      console.error('Failed to verify contact');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Verify Contact</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            onClick={onClose}
          >
            <IonIcon icon={addOutline} style={{ transform: 'rotate(45deg)' }} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>{contact.alias}</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p><strong>Fingerprint:</strong> {contact.fingerprint}</p>
            <p><strong>Current Trust Level:</strong></p>
            <div className="ion-margin-vertical">
              <TrustIndicator trustLevel={contact.trustLevel} />
            </div>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Update Trust Level</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              {(['verified', 'known', 'unknown', 'untrusted'] as TrustLevel[]).map((level) => (
                <IonItem key={level}>
                  <IonLabel>
                    <TrustIndicator trustLevel={level} />
                    <p className="ion-margin-top">
                      {level === 'verified' && 'Identity confirmed through secure channel'}
                      {level === 'known' && 'Met in person or trusted introduction'}
                      {level === 'unknown' && 'No verification performed'}
                      {level === 'untrusted' && 'Suspicious or compromised'}
                    </p>
                  </IonLabel>
                  <IonCheckbox
                    slot="end"
                    checked={selectedTrustLevel === level}
                    onIonChange={() => setSelectedTrustLevel(level)}
                  />
                </IonItem>
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>

        <div className="ion-padding-top">
          <IonButton
            expand="block"
            onClick={handleVerify}
            disabled={isLoading}
            color={selectedTrustLevel === 'verified' ? 'success' : 'primary'}
          >
            {isLoading ? 'Updating...' : `Set Trust Level: ${selectedTrustLevel}`}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
};

// Main emergency contacts component
const EmergencyContacts: React.FC<EmergencyContactsProps> = ({ onClose }) => {
  const {
    contacts,
    groups,
    addContact,
    removeContact,
    updateContact,
    createGroup,
    updateGroup,
    removeGroup
  } = useResQLinkStore();

  const [currentSegment, setCurrentSegment] = useState<'contacts' | 'groups'>('contacts');
  const [searchText, setSearchText] = useState('');
  const [filterEmergencyOnly, setFilterEmergencyOnly] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.alias.toLowerCase().includes(searchText.toLowerCase()) ||
                          contact.fingerprint.toLowerCase().includes(searchText.toLowerCase());
    const matchesFilter = !filterEmergencyOnly || contact.isEmergencyContact;
    return matchesSearch && matchesFilter;
  });

  // Filter groups
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  const handleAddContact = async (contactData: { alias: string; ed25519Pub: string; x25519Pub: string; trustLevel?: TrustLevel; isEmergencyContact?: boolean; notes?: string }) => {
    try {
      addContact(contactData.alias, contactData.ed25519Pub, contactData.x25519Pub);
      // Update with additional fields if provided
      if (contactData.trustLevel || contactData.isEmergencyContact || contactData.notes) {
        updateContact(contactData.ed25519Pub, {
          trustLevel: contactData.trustLevel,
          isEmergencyContact: contactData.isEmergencyContact,
          notes: contactData.notes
        });
      }
      setToastMessage('Contact added successfully');
      setShowToast(true);
    } catch {
      setToastMessage('Failed to add contact');
      setShowToast(true);
    }
  };

  const handleUpdateContact = async (contactData: { alias: string; ed25519Pub: string; x25519Pub: string; trustLevel?: TrustLevel; isEmergencyContact?: boolean; notes?: string }) => {
    if (!selectedContact) return;
    try {
      updateContact(selectedContact.ed25519Pub, {
        alias: contactData.alias,
        trustLevel: contactData.trustLevel,
        isEmergencyContact: contactData.isEmergencyContact,
        notes: contactData.notes
      });
      setToastMessage('Contact updated successfully');
      setShowToast(true);
    } catch {
      setToastMessage('Failed to update contact');
      setShowToast(true);
    }
  };

  const handleDeleteContact = (contact: Contact) => {
    try {
      removeContact(contact.ed25519Pub);
      setToastMessage('Contact deleted');
      setShowToast(true);
    } catch {
      setToastMessage('Failed to delete contact');
      setShowToast(true);
    }
  };

  const handleAddGroup = async (groupData: { name: string; description?: string; memberPubs: string[] }) => {
    try {
      createGroup(groupData.name, groupData.memberPubs);
      setToastMessage('Group created successfully');
      setShowToast(true);
    } catch {
      setToastMessage('Failed to create group');
      setShowToast(true);
    }
  };

  const handleUpdateGroup = async (groupData: { name: string; description?: string; memberPubs: string[] }) => {
    if (!selectedGroup) return;
    try {
      updateGroup(selectedGroup.id, {
        name: groupData.name,
        description: groupData.description,
        memberPubs: groupData.memberPubs
      });
      setToastMessage('Group updated successfully');
      setShowToast(true);
    } catch {
      setToastMessage('Failed to update group');
      setShowToast(true);
    }
  };

  const handleDeleteGroup = (group: Group) => {
    try {
      removeGroup(group.id);
      setToastMessage('Group deleted');
      setShowToast(true);
    } catch {
      setToastMessage('Failed to delete group');
      setShowToast(true);
    }
  };

  const handleVerifyContact = async (contactPub: string, trustLevel: TrustLevel) => {
    try {
      updateContact(contactPub, { trustLevel });
      setToastMessage(`Trust level updated to ${trustLevel}`);
      setShowToast(true);
    } catch {
      setToastMessage('Failed to update trust level');
      setShowToast(true);
    }
  };

  const handleRefresh = () => {
    setToastMessage('Contacts refreshed');
    setShowToast(true);
  };

  const openChat = (contactOrGroup: Contact | Group) => {
    // Set the selected contact or group for chat
    if ('ed25519Pub' in contactOrGroup) {
      // It's a Contact
      setSelectedContact(contactOrGroup);
      setSelectedGroup(null);
    } else {
      // It's a Group
      setSelectedGroup(contactOrGroup);
      setSelectedContact(null);
    }
    // Open chat interface
    setShowChat(true);
  };

  if (showChat && (selectedContact || selectedGroup)) {
    return (
      <ChatInterface
        recipient={selectedContact || selectedGroup!}
        onClose={() => setShowChat(false)}
      />
    );
  }

  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Emergency Contacts</IonTitle>
          {onClose && (
            <IonButton
              slot="end"
              fill="clear"
              onClick={onClose}
            >
              <IonIcon icon={addOutline} style={{ transform: 'rotate(45deg)' }} />
            </IonButton>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Segment control */}
        <div className="ion-padding-horizontal ion-padding-top">
          <IonSegment
            value={currentSegment}
            onIonChange={(e) => setCurrentSegment(e.detail.value as 'contacts' | 'groups')}
          >
            <IonSegmentButton value="contacts">
              <IonLabel>Contacts</IonLabel>
              <IonIcon icon={personCircleOutline} />
            </IonSegmentButton>
            <IonSegmentButton value="groups">
              <IonLabel>Groups</IonLabel>
              <IonIcon icon={peopleOutline} />
            </IonSegmentButton>
          </IonSegment>
        </div>

        {/* Search and filters */}
        <div className="ion-padding-horizontal">
          <IonSearchbar
            value={searchText}
            placeholder={`Search ${currentSegment}...`}
            onIonInput={(e) => setSearchText(e.detail.value!)}
          />

          {currentSegment === 'contacts' && (
            <IonItem lines="none">
              <IonCheckbox
                checked={filterEmergencyOnly}
                onIonChange={(e) => setFilterEmergencyOnly(e.detail.checked)}
              />
              <IonLabel className="ion-margin-start">
                Emergency contacts only
              </IonLabel>
              <IonIcon icon={filterOutline} slot="end" />
            </IonItem>
          )}
        </div>

        {/* Contacts list */}
        {currentSegment === 'contacts' && (
          <IonList>
            {filteredContacts.map((contact) => (
              <IonItemSliding key={contact.ed25519Pub}>
                <IonItem>
                  <IonAvatar slot="start">
                    <IonIcon icon={personCircleOutline} />
                  </IonAvatar>
                  <IonLabel>
                    <h2>
                      {contact.alias}
                      {contact.isEmergencyContact && (
                        <IonBadge color="danger" className="ion-margin-start">
                          Emergency
                        </IonBadge>
                      )}
                    </h2>
                    <p>{contact.fingerprint}</p>
                    {contact.notes && <p>{contact.notes}</p>}
                  </IonLabel>
                  <TrustIndicator trustLevel={contact.trustLevel} />
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption
                    color="tertiary"
                    onClick={() => openChat(contact)}
                  >
                    <IonIcon icon={chatbubbleOutline} />
                  </IonItemOption>
                  <IonItemOption
                    color="primary"
                    onClick={() => {
                      setSelectedContact(contact);
                      setShowVerification(true);
                    }}
                  >
                    <IonIcon icon={shieldCheckmarkOutline} />
                  </IonItemOption>
                  <IonItemOption
                    color="secondary"
                    onClick={() => {
                      setSelectedContact(contact);
                      setShowContactForm(true);
                    }}
                  >
                    <IonIcon icon={createOutline} />
                  </IonItemOption>
                  <IonItemOption
                    color="danger"
                    onClick={() => handleDeleteContact(contact)}
                  >
                    <IonIcon icon={trashOutline} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}

            {filteredContacts.length === 0 && (
              <IonCard>
                <IonCardContent>
                  <div className="ion-text-center ion-padding">
                    <IonIcon
                      icon={personAddOutline}
                      style={{ fontSize: '64px', color: '#ccc' }}
                    />
                    <h2>No contacts found</h2>
                    <p>Add your first emergency contact to get started.</p>
                    <IonButton
                      fill="outline"
                      onClick={() => setShowContactForm(true)}
                    >
                      Add Contact
                    </IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            )}
          </IonList>
        )}

        {/* Groups list */}
        {currentSegment === 'groups' && (
          <IonList>
            {filteredGroups.map((group) => (
              <IonItemSliding key={group.id}>
                <IonItem>
                  <IonAvatar slot="start">
                    <IonIcon icon={peopleOutline} />
                  </IonAvatar>
                  <IonLabel>
                    <h2>{group.name}</h2>
                    <p>{group.memberPubs.length} members</p>
                    {group.description && <p>{group.description}</p>}
                  </IonLabel>
                  <IonBadge color="primary">{group.memberPubs.length}</IonBadge>
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption
                    color="tertiary"
                    onClick={() => openChat(group)}
                  >
                    <IonIcon icon={chatbubbleOutline} />
                  </IonItemOption>
                  <IonItemOption
                    color="secondary"
                    onClick={() => {
                      setSelectedGroup(group);
                      setShowGroupForm(true);
                    }}
                  >
                    <IonIcon icon={createOutline} />
                  </IonItemOption>
                  <IonItemOption
                    color="danger"
                    onClick={() => handleDeleteGroup(group)}
                  >
                    <IonIcon icon={trashOutline} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}

            {filteredGroups.length === 0 && (
              <IonCard>
                <IonCardContent>
                  <div className="ion-text-center ion-padding">
                    <IonIcon
                      icon={peopleOutline}
                      style={{ fontSize: '64px', color: '#ccc' }}
                    />
                    <h2>No groups found</h2>
                    <p>Create your first emergency response group.</p>
                    <IonButton
                      fill="outline"
                      onClick={() => setShowGroupForm(true)}
                      disabled={contacts.length === 0}
                    >
                      Create Group
                    </IonButton>
                    {contacts.length === 0 && (
                      <p className="ion-margin-top">
                        <small>Add contacts first to create groups</small>
                      </p>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>
            )}
          </IonList>
        )}

        {/* FAB */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowActionSheet(true)}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>

        {/* Action Sheet */}
        <IonActionSheet
          isOpen={showActionSheet}
          onDidDismiss={() => setShowActionSheet(false)}
          buttons={[
            {
              text: 'Add Contact',
              icon: personAddOutline,
              handler: () => {
                setSelectedContact(null);
                setShowContactForm(true);
              }
            },
            {
              text: 'Create Group',
              icon: peopleOutline,
              disabled: contacts.length === 0,
              handler: () => {
                setSelectedGroup(null);
                setShowGroupForm(true);
              }
            },
            {
              text: 'Scan QR Code',
              icon: qrCodeOutline,
              handler: () => {
                setToastMessage('QR code scanning coming soon');
                setShowToast(true);
              }
            },
            {
              text: 'Share My Info',
              icon: shareOutline,
              handler: () => {
                setToastMessage('Contact sharing coming soon');
                setShowToast(true);
              }
            },
            {
              text: 'Cancel',
              role: 'cancel'
            }
          ]}
        />

        {/* Contact Form Modal */}
        <ContactForm
          isOpen={showContactForm}
          onClose={() => {
            setShowContactForm(false);
            setSelectedContact(null);
          }}
          onSave={selectedContact ? handleUpdateContact : handleAddContact}
          initialData={selectedContact || undefined}
          title={selectedContact ? 'Edit Contact' : 'Add Contact'}
        />

        {/* Group Form Modal */}
        <GroupForm
          isOpen={showGroupForm}
          onClose={() => {
            setShowGroupForm(false);
            setSelectedGroup(null);
          }}
          onSave={selectedGroup ? handleUpdateGroup : handleAddGroup}
          initialData={selectedGroup || undefined}
          contacts={contacts}
          title={selectedGroup ? 'Edit Group' : 'Create Group'}
        />

        {/* Contact Verification Modal */}
        {selectedContact && (
          <ContactVerification
            isOpen={showVerification}
            onClose={() => {
              setShowVerification(false);
              setSelectedContact(null);
            }}
            contact={selectedContact}
            onVerify={handleVerifyContact}
          />
        )}

        {/* Toast */}
        <IonToast
          isOpen={showToast}
          message={toastMessage}
          duration={2000}
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </>
  );
};

export default EmergencyContacts;