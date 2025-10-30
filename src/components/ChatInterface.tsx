/**
 * ResQLink Mesh - Chat Interface Component
 * Provides real-time messaging interface with support for:
 * - Text messages, voice messages, location sharing
 * - File attachments with compression
 * - Emergency SOS messaging
 * - Delivery status tracking
 * - Offline message queuing
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonTextarea,
  IonItem,
  IonLabel,
  IonSpinner,
  IonCheckbox,
  IonActionSheet,
  IonAlert,
  IonChip,
  IonBadge,
  IonToast
} from '@ionic/react';
import {
  sendOutline,
  attachOutline,
  micOutline,
  stopOutline,
  locationOutline,
  alertCircleOutline,
  timeOutline,
  checkmarkDoneOutline,
  warningOutline,
  mapOutline,
  arrowBackOutline,
  cameraOutline,
  documentOutline,
  imageOutline
} from 'ionicons/icons';


import { MsgType, MsgBody, Contact, StoredMessage, Group } from '../lib/schema';
import { useResQLinkStore } from '../lib/store';
import { fileSystemService } from '../services/FileSystemService';
import LocationMapModal from './LocationMapModal';
import haptic from '../services/HapticService';
import './ChatInterface.css';

interface ChatInterfaceProps {
  /** Contact or group being chatted with */
  recipient: Contact | Group;
  /** Whether this is an emergency chat */
  isEmergency?: boolean;
  /** Callback when chat is closed */
  onClose?: () => void;
}

interface MessageBubbleProps {
  message: StoredMessage;
  isOwn: boolean;
  showTimestamp: boolean;
  onRetry?: (messageId: string) => void;
  onViewLocation?: (lat: number, lon: number) => void;
}

interface MessageComposerProps {
  onSend: (type: MsgType | 'SOS' | 'TEXT', body: MsgBody) => Promise<void>;
  isEmergency?: boolean;
  disabled?: boolean;
}

interface FileAttachment {
  file: File;
  type: 'image' | 'document' | 'audio';
  preview?: string; // URL for display (created via URL.createObjectURL or from filesystem)
  compressed?: boolean;
  filePath?: string; // Path to file in filesystem (for persistent storage)
  thumbnail?: string; // Base64 thumbnail for quick preview
}

/**
 * Typing Indicator Component
 * Shows animated dots when the other party is typing
 */
const TypingIndicator: React.FC<{ senderName: string }> = ({ senderName }) => {
  return (
    <div className="typing-indicator">
      <span className="typing-indicator-text">{senderName} is typing</span>
      <div className="typing-indicator-dots">
        <div className="typing-indicator-dot"></div>
        <div className="typing-indicator-dot"></div>
        <div className="typing-indicator-dot"></div>
      </div>
    </div>
  );
};

/**
 * Individual message bubble component
 * Optimized with React.memo to prevent unnecessary re-renders
 */
const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
  message,
  isOwn,
  showTimestamp,
  onRetry,
  onViewLocation
}) => {
  const getDeliveryIcon = () => {
    if (!isOwn) return null;

    const getAriaLabel = () => {
      switch (message.deliveryStatus) {
        case 'queued': return 'Message queued for delivery';
        case 'sent': return 'Message sent';
        case 'relayed': return 'Message relayed through network';
        case 'acked': return 'Message acknowledged by recipient';
        case 'failed': return 'Message failed to send, click to retry';
        default: return '';
      }
    };

    switch (message.deliveryStatus) {
      case 'queued':
        return <IonIcon icon={timeOutline} className="delivery-icon queued" aria-label={getAriaLabel()} />;
      case 'sent':
        return <IonIcon icon={checkmarkDoneOutline} className="delivery-icon sent" aria-label={getAriaLabel()} />;
      case 'relayed':
        return <IonIcon icon={checkmarkDoneOutline} className="delivery-icon relayed" aria-label={getAriaLabel()} />;
      case 'acked':
        return <IonIcon icon={checkmarkDoneOutline} className="delivery-icon acked" aria-label={getAriaLabel()} />;
      case 'failed':
        return (
          <IonButton
            fill="clear"
            size="small"
            onClick={() => onRetry?.(message.packet.id)}
            className="retry-button"
            aria-label={getAriaLabel()}
          >
            <IonIcon icon={warningOutline} className="delivery-icon failed" aria-hidden="true" />
          </IonButton>
        );
      default:
        return null;
    }
  };

  const getMessageTypeIcon = () => {
    const getTypeLabel = () => {
      switch (message.packet.type) {
        case 'SOS': return 'Emergency message';
        case 'RESOURCE': return 'Resource sharing message';
        case 'ACK': return 'Acknowledgement message';
        default: return 'Message';
      }
    };

    switch (message.packet.type) {
      case 'SOS':
        return <IonIcon icon={alertCircleOutline} className="message-type-icon sos" aria-label={getTypeLabel()} />;
      case 'RESOURCE':
        return <IonIcon icon={mapOutline} className="message-type-icon resource" aria-label={getTypeLabel()} />;
      case 'ACK':
        return <IonIcon icon={checkmarkDoneOutline} className="message-type-icon ack" aria-label={getTypeLabel()} />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const hasLocation = message.decryptedBody?.lat && message.decryptedBody?.lon;

  const getMessageRole = () => {
    if (message.packet.type === 'SOS') return 'alert';
    return 'article';
  };

  const getAriaLabel = () => {
    const sender = isOwn ? 'You' : 'Recipient';
    const type = message.packet.type === 'SOS' ? 'emergency ' : '';
    const timestamp = formatTimestamp(message.localTimestamp);
    const text = message.decryptedBody?.text || 'No text';
    return `${sender} sent ${type}message at ${timestamp}: ${text}`;
  };

  return (
    <div
      className={`message-bubble ${isOwn ? 'own' : 'other'} ${message.packet.type.toLowerCase()}`}
      role={getMessageRole()}
      aria-label={getAriaLabel()}
    >
      <div className="message-header">
        {getMessageTypeIcon()}
        {showTimestamp && (
          <span className="timestamp" aria-label={`Sent ${formatTimestamp(message.localTimestamp)}`}>
            {formatTimestamp(message.localTimestamp)}
          </span>
        )}
        {getDeliveryIcon()}
      </div>

      <div className="message-content">
        {message.decryptedBody?.text && (
          <p className="message-text">{message.decryptedBody.text}</p>
        )}

        {hasLocation && (
          <div className="message-location" role="region" aria-label="Location information">
            <IonIcon icon={locationOutline} aria-hidden="true" />
            <span>
              Location: {message.decryptedBody?.lat?.toFixed(6)}, {message.decryptedBody?.lon?.toFixed(6)}
            </span>
            <IonButton
              size="small"
              fill="outline"
              onClick={() => {
                const lat = message.decryptedBody?.lat;
                const lon = message.decryptedBody?.lon;
                if (lat && lon && onViewLocation) {
                  onViewLocation(lat, lon);
                }
              }}
              aria-label={`View location ${message.decryptedBody?.lat?.toFixed(6)}, ${message.decryptedBody?.lon?.toFixed(6)} on map`}
            >
              View on Map
            </IonButton>
          </div>
        )}

        {(() => {
          const fileUrl = message.decryptedBody?.extras?.fileUrl;
          const fileName = message.decryptedBody?.extras?.fileName;
          if (fileUrl && typeof fileUrl === 'string') {
            return (
              <div className="message-attachment" role="region" aria-label={`File attachment: ${String(fileName || 'File')}`}>
                <IonIcon icon={documentOutline} aria-hidden="true" />
                <span>{String(fileName || 'File')}</span>
              </div>
            );
          }
          return null;
        })()}

        {(() => {
          const audioUrl = message.decryptedBody?.extras?.audioUrl;
          if (audioUrl && typeof audioUrl === 'string') {
            return (
              <div className="message-audio" role="region" aria-label="Voice message">
                <audio controls aria-label="Play voice message">
                  <source src={audioUrl} type="audio/webm" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {message.packet.type === 'SOS' && (
        <div className="emergency-badge" role="alert">
          <IonBadge color="danger" aria-label="This is an emergency message">EMERGENCY</IonBadge>
        </div>
      )}
    </div>
  );
});

// Add display name for debugging
MessageBubble.displayName = 'MessageBubble';

/**
 * Message input composer with attachments and location sharing
 */
const MessageComposer: React.FC<MessageComposerProps> = ({
  isEmergency,
  onSend,
  disabled
}) => {
  const [messageText, setMessageText] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showLocationAlert, setShowLocationAlert] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { currentLocation, updateLocation } = useResQLinkStore();

  // Get current location when includeLocation is enabled
  useEffect(() => {
    if (includeLocation && !currentLocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Failed to get location:', error);
          setShowLocationAlert(true);
        }
      );
    }
  }, [includeLocation, currentLocation, updateLocation]);

  const handleSend = async () => {
    if (!messageText.trim() && attachments.length === 0) return;

    const extras: Record<string, unknown> = {};

    // Handle old extras for backward compatibility (URLs for preview)
    if (attachments.length > 0) {
      const fileAttachment = attachments.find(a => a.type !== 'audio');
      const audioAttachment = attachments.find(a => a.type === 'audio');

      if (fileAttachment) {
        extras.fileUrl = fileAttachment.preview;
        extras.fileName = fileAttachment.file.name;
      }

      if (audioAttachment) {
        extras.audioUrl = audioAttachment.preview;
      }
    }

    // Create message body with text and location
    const body: MsgBody = {
      text: messageText.trim() || undefined,
      lat: includeLocation ? currentLocation?.lat : undefined,
      lon: includeLocation ? currentLocation?.lon : undefined,
      extras: Object.keys(extras).length > 0 ? extras : undefined
    };

    // Handle the first attachment as primary attachment (file data from filesystem)
    if (attachments.length > 0 && attachments[0].filePath) {
      try {
        // Read file data from filesystem
        const result = await fileSystemService.readMediaFile(attachments[0].filePath);

        if (result.success && result.path) {
          // Extract base64 data from data URL (format: "data:mime/type;base64,data")
          const base64Data = result.path.includes(',')
            ? result.path.split(',')[1]
            : result.path;

          // Add attachment to message body
          body.attachment = {
            data: base64Data,
            metadata: {
              filename: attachments[0].file.name,
              mimeType: attachments[0].file.type,
              sizeBytes: attachments[0].file.size,
              thumbnail: attachments[0].thumbnail
              // Note: localPath is NOT included in transmission for security
            }
          };
        } else {
          console.warn('Failed to read attachment from filesystem:', result.error);
          // Continue without attachment rather than failing the whole message
        }
      } catch (error) {
        console.error('Error reading attachment:', error);
        // Continue without attachment rather than failing the whole message
      }
    }

    const messageType = isEmergency ? 'SOS' : 'TEXT';

    try {
      // Haptic feedback based on message type
      if (isEmergency) {
        await haptic.emergency(); // Triple heavy impact for SOS
      } else {
        await haptic.medium(); // Standard tap for normal message
      }

      await onSend(messageType, body);

      // Success haptic
      await haptic.success();

      setMessageText('');
      setAttachments([]);
      setIncludeLocation(false);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Error haptic
      await haptic.error();
    }
  };

  const startRecording = async () => {
    try {
      await haptic.light(); // Light haptic when starting recording

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        setAttachments(prev => [...prev, {
          file: new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' }),
          type: 'audio',
          preview: audioUrl
        }]);

        // Success haptic for completed recording
        await haptic.success();

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      await haptic.error();
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      await haptic.medium(); // Medium haptic when stopping recording
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    for (const file of files) {
      try {
        // Read file as base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64Data = dataUrl.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;

        // Save to filesystem
        const result = await fileSystemService.saveMediaFile(
          base64Data,
          file.name,
          file.type
        );

        let attachment: FileAttachment;

        if (result.success && result.path && result.metadata) {
          // Successful save - use filesystem path and thumbnail
          attachment = {
            file,
            type: file.type.startsWith('image/') ? 'image' : 'document',
            preview: result.metadata.thumbnail
              ? `data:${file.type};base64,${result.metadata.thumbnail}`
              : file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            filePath: result.path,
            thumbnail: result.metadata.thumbnail,
            compressed: !!result.metadata.thumbnail
          };
        } else {
          // Fallback: file too large or storage full
          console.warn('Failed to save file to filesystem:', result.error);
          attachment = {
            file,
            type: file.type.startsWith('image/') ? 'image' : 'document',
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
          };
        }

        setAttachments(prev => [...prev, attachment]);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
  };

  const handleCameraCapture = useCallback(async () => {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (photo.dataUrl) {
        // Extract base64 data from data URL
        const base64Data = photo.dataUrl.split(',')[1];

        // Save to filesystem
        const filename = `camera_capture_${Date.now()}.jpg`;
        const result = await fileSystemService.saveMediaFile(
          base64Data,
          filename,
          'image/jpeg'
        );

        if (result.success && result.path && result.metadata) {
          // Convert data URL to blob for the File object
          const response = await fetch(photo.dataUrl);
          const blob = await response.blob();

          // Create File object (still needed for upload/transmission)
          const file = new File([blob], filename, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });

          // Create attachment with filesystem path and thumbnail
          const attachment: FileAttachment = {
            file,
            type: 'image',
            preview: result.metadata.thumbnail
              ? `data:image/jpeg;base64,${result.metadata.thumbnail}`
              : URL.createObjectURL(file),
            filePath: result.path,
            thumbnail: result.metadata.thumbnail,
            compressed: true // FileSystemService generates compressed thumbnails
          };

          setAttachments(prev => [...prev, attachment]);
        } else {
          console.error('Failed to save photo to filesystem:', result.error);
          // Fallback: still create attachment but without filesystem persistence
          const response = await fetch(photo.dataUrl);
          const blob = await response.blob();
          const file = new File([blob], filename, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          const attachment: FileAttachment = {
            file,
            type: 'image',
            preview: URL.createObjectURL(file)
          };
          setAttachments(prev => [...prev, attachment]);
        }
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      // Toast notification would be handled by parent component
    }
  }, []);

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="message-composer">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="attachments-preview" role="list" aria-label="Selected attachments">
          {attachments.map((attachment, index) => (
            <IonChip
              key={index}
              className="attachment-chip"
              onClick={() => removeAttachment(index)}
              role="listitem"
              aria-label={`Remove attachment ${attachment.file.name}`}
            >
              <IonIcon
                icon={attachment.type === 'image' ? imageOutline :
                      attachment.type === 'audio' ? micOutline : documentOutline}
                aria-hidden="true"
              />
              <IonLabel>{attachment.file.name}</IonLabel>
            </IonChip>
          ))}
        </div>
      )}

      {/* Location sharing toggle */}
      <IonItem lines="none" className="location-toggle">
        <IonCheckbox
          checked={includeLocation}
          onIonChange={(e) => setIncludeLocation(e.detail.checked)}
          aria-label="Include current location with message"
        />
        <IonLabel className="ion-margin-start">
          <IonIcon icon={locationOutline} aria-hidden="true" />
          Share location
        </IonLabel>
      </IonItem>

      {/* Message input area */}
      <div className="input-row" role="group" aria-label="Message composition tools">
        <IonButton
          fill="clear"
          onClick={() => setShowActionSheet(true)}
          disabled={disabled}
          aria-label="Attach files or media"
        >
          <IonIcon icon={attachOutline} aria-hidden="true" />
        </IonButton>

        <IonTextarea
          value={messageText}
          onIonInput={(e) => setMessageText(e.detail.value!)}
          placeholder={isEmergency ? "Emergency message..." : "Type a message..."}
          autoGrow={true}
          rows={1}
          disabled={disabled}
          className="message-input"
          aria-label={isEmergency ? "Emergency message input" : "Message input"}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {isRecording ? (
          <IonButton
            fill="solid"
            color="danger"
            onClick={stopRecording}
            aria-label="Stop voice recording"
          >
            <IonIcon icon={stopOutline} aria-hidden="true" />
          </IonButton>
        ) : (
          <IonButton
            fill="clear"
            onClick={startRecording}
            disabled={disabled}
            aria-label="Start voice recording"
          >
            <IonIcon icon={micOutline} aria-hidden="true" />
          </IonButton>
        )}

        <IonButton
          fill="solid"
          color={isEmergency ? "danger" : "primary"}
          onClick={handleSend}
          disabled={disabled || (!messageText.trim() && attachments.length === 0)}
          aria-label={isEmergency ? "Send emergency message" : "Send message"}
        >
          <IonIcon icon={sendOutline} aria-hidden="true" />
        </IonButton>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileSelect}
      />

      {/* Attachment action sheet */}
      <IonActionSheet
        isOpen={showActionSheet}
        onDidDismiss={() => setShowActionSheet(false)}
        buttons={[
          {
            text: 'Camera',
            icon: cameraOutline,
            handler: () => {
              handleCameraCapture();
            }
          },
          {
            text: 'Photo Library',
            icon: imageOutline,
            handler: () => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'image/*';
                fileInputRef.current.click();
              }
            }
          },
          {
            text: 'Document',
            icon: documentOutline,
            handler: () => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = '.pdf,.doc,.docx,.txt';
                fileInputRef.current.click();
              }
            }
          },
          {
            text: 'Cancel',
            role: 'cancel'
          }
        ]}
      />

      {/* Location permission alert */}
      <IonAlert
        isOpen={showLocationAlert}
        onDidDismiss={() => setShowLocationAlert(false)}
        header="Location Access"
        message="Unable to get your location. Please enable location permissions in your device settings."
        buttons={['OK']}
      />
    </div>
  );
};

/**
 * Main chat interface component
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  recipient,
  isEmergency = false,
  onClose
}) => {
  const [displayedMessages, setDisplayedMessages] = useState<StoredMessage[]>([]);
  const [messagesPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [modalLocation, setModalLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages: storeMessages,
    sendMessage,
    meshStatus,
    keyPair
  } = useResQLinkStore();

  // Memoized message filtering for this conversation
  // This is an expensive operation that should only recompute when dependencies change
  const messages = React.useMemo(() => {
    if (!keyPair) return [];

    const conversationMessages = storeMessages.filter(msg => {
      const sender = msg.packet.senderPub;
      const isOutbound = msg.isOutbound;

      if ('memberPubs' in recipient) { // Group Chat
        const groupMemberX25519Pubs = new Set(recipient.memberPubs);

        if (isOutbound) {
          // Show message if it was sent to any member of the group
          return msg.packet.keyEnvelopes.some(e => groupMemberX25519Pubs.has(e.rcptPub));
        }
        // Show message if it was sent by a group member and is for us
        return groupMemberX25519Pubs.has(sender) && msg.packet.keyEnvelopes.some(e => e.rcptPub === keyPair.x25519Pub);

      } else { // Direct Chat
        const contactX25519Pub = recipient.x25519Pub;
        const contactEd25519Pub = recipient.ed25519Pub;

        if (isOutbound) {
          // Show message if it was sent to the contact
          return msg.packet.keyEnvelopes.some(e => e.rcptPub === contactX25519Pub);
        }
        // Show message if it was sent by the contact and is for us
        return sender === contactEd25519Pub && msg.packet.keyEnvelopes.some(e => e.rcptPub === keyPair.x25519Pub);
      }
    });

    // Sort by timestamp
    return conversationMessages.sort((a: StoredMessage, b: StoredMessage) =>
      a.localTimestamp - b.localTimestamp
    );
  }, [storeMessages, recipient, keyPair]);

  // Reset pagination when conversation changes
  useEffect(() => {
    setCurrentPage(1);
  }, [recipient]);

    // Handle pagination - display only current page of messages
    useEffect(() => {
      const totalMessages = messages.length;
      const startIndex = Math.max(0, totalMessages - (currentPage * messagesPerPage));
      const endIndex = totalMessages;

      setDisplayedMessages(messages.slice(startIndex, endIndex));
      setHasMoreMessages(startIndex > 0);
    }, [messages, currentPage, messagesPerPage]);

    // Update connection status
    useEffect(() => {
      setIsConnected(meshStatus.active && meshStatus.peerCount > 0);
    }, [meshStatus]);

    // Auto-scroll to bottom when new messages arrive with highlight effect
    useEffect(() => {
      if (displayedMessages.length > lastMessageCount) {
        // New message received - scroll to bottom smoothly
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        setLastMessageCount(displayedMessages.length);
      }
    }, [displayedMessages, lastMessageCount]);

    const handleLoadMoreMessages = useCallback(() => {
      if (isLoadingMore || !hasMoreMessages) return;

      setIsLoadingMore(true);

      // Save current scroll position
      const container = messagesContainerRef.current;
      const previousScrollHeight = container?.scrollHeight || 0;

      // Load next page
      setCurrentPage(prev => prev + 1);

      // Restore scroll position after new messages load
      setTimeout(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const scrollDiff = newScrollHeight - previousScrollHeight;
          container.scrollTop = scrollDiff;
        }
        setIsLoadingMore(false);
      }, 100);
    }, [isLoadingMore, hasMoreMessages]);

  const handleSendMessage = React.useCallback(async (type: MsgType, body: MsgBody) => {
    const recipientKey = 'ed25519Pub' in recipient ? recipient.ed25519Pub : recipient.id;
    const recipients: string[] = 'memberPubs' in recipient ? recipient.memberPubs : [recipient.x25519Pub];

    try {
      await sendMessage(type, body, recipients);

      if (type === 'SOS') {
        setToastMessage('Emergency message sent!');
        setShowToast(true);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setToastMessage('Failed to send message. It will be queued for retry.');
      setShowToast(true);
    }
  }, [recipient, sendMessage]);

  const handleRetryMessage = useCallback(async (messageId: string) => {
      const failedMessage = storeMessages.find(msg => msg.packet.id === messageId);

      if (failedMessage && failedMessage.decryptedBody) {
        const recipients: string[] = 'memberPubs' in recipient ? recipient.memberPubs : [recipient.x25519Pub];
        try {
          await sendMessage(failedMessage.packet.type, failedMessage.decryptedBody, recipients);
          setToastMessage('Message queued for retry.');
          setShowToast(true);
        } catch (error) {
          setToastMessage('Failed to retry message.');
          setShowToast(true);
        }
      } else {
        setToastMessage('Could not find message to retry.');
        setShowToast(true);
      }
    }, [storeMessages, recipient, sendMessage]);
  const handleViewLocation = useCallback((lat: number, lon: number) => {
    setModalLocation({ lat, lon });
    setShowLocationModal(true);
  }, []);

  const getRecipientName = () => {
    return 'alias' in recipient ? recipient.alias : recipient.name;
  };

  const getConnectionStatus = () => {
    if (!meshStatus.active) return 'Mesh offline';
    if (meshStatus.peerCount === 0) return 'No peers';
    return `${meshStatus.peerCount} peer${meshStatus.peerCount === 1 ? '' : 's'}`;
  };

  return (
    <>
      <IonHeader>
        <IonToolbar color={isEmergency ? 'danger' : 'primary'}>
          <IonButton
            slot="start"
            fill="clear"
            onClick={onClose}
            aria-label="Close chat and return to messages list"
          >
            <IonIcon icon={arrowBackOutline} aria-hidden="true" />
          </IonButton>

          <IonTitle>
            {isEmergency && <IonIcon icon={alertCircleOutline} className="emergency-icon" aria-label="Emergency channel" />}
            {getRecipientName()}
          </IonTitle>

          <div slot="end" className="connection-status" role="status" aria-live="polite">
            <IonBadge color={isConnected ? 'success' : 'warning'} aria-label={`Network status: ${getConnectionStatus()}`}>
              {getConnectionStatus()}
            </IonBadge>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="messages-container" ref={messagesContainerRef} role="log" aria-live="polite" aria-label="Message history">
          {messages.length === 0 ? (
            <div className="empty-state" role="status">
              <p>No messages yet. Start the conversation!</p>
              {isEmergency && (
                <p className="emergency-note" role="alert">
                  <IonIcon icon={alertCircleOutline} aria-hidden="true" />
                  This is an emergency channel. Messages will be sent with high priority.
                </p>
              )}
            </div>
          ) : (
            <div className="messages-list">
              {hasMoreMessages && (
                <div className="load-more-container">
                  <IonButton
                    fill="clear"
                    size="small"
                    onClick={handleLoadMoreMessages}
                    disabled={isLoadingMore}
                    aria-label={`Load ${Math.min(messagesPerPage, messages.length - displayedMessages.length)} more previous messages`}
                  >
                    {isLoadingMore ? (
                      <>
                        <IonSpinner name="crescent" aria-label="Loading messages" />
                        <span style={{ marginLeft: '8px' }}>Loading...</span>
                      </>
                    ) : (
                      <>Load {Math.min(messagesPerPage, messages.length - displayedMessages.length)} more messages</>
                    )}
                  </IonButton>
                </div>
              )}
              {displayedMessages.map((message, index) => {
                const isOwn = message.packet.senderPub === keyPair?.ed25519Pub;
                const showTimestamp = index === 0 ||
                  (displayedMessages[index - 1].localTimestamp - message.localTimestamp) > 300000; // 5 minutes
                const isNewMessage = index === displayedMessages.length - 1 && displayedMessages.length > lastMessageCount - 1;

                return (
                  <MessageBubble
                    key={message.packet.id}
                    message={message}
                    isOwn={isOwn}
                    showTimestamp={showTimestamp}
                    onRetry={handleRetryMessage}
                    onViewLocation={handleViewLocation}
                  />
                );
              })}

              {/* Show typing indicator when recipient is typing */}
              {isTyping && (
                <TypingIndicator senderName={getRecipientName()} />
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </IonContent>

      <div className="composer-container">
        <MessageComposer
          isEmergency={isEmergency}
          onSend={handleSendMessage}
          disabled={!keyPair}
        />
      </div>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        position="top"
      />

      <LocationMapModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        latitude={modalLocation?.lat || 0}
        longitude={modalLocation?.lon || 0}
      />
    </>
  );
};

export default ChatInterface;