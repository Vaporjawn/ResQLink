/**
 * ResQLink - Attachment Viewer Component
 *
 * Modal component for viewing and managing message attachments
 * Supports images, videos, and documents with lazy loading from filesystem
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonSpinner,
  IonText,
  IonToast
} from '@ionic/react';
import {
  closeOutline,
  downloadOutline,
  shareOutline,
  trashOutline
} from 'ionicons/icons';
import { fileSystemService } from '../services/FileSystemService';
import type { FileAttachmentMetadata } from '../lib/schema';

interface AttachmentViewerProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** File path in filesystem */
  filePath?: string;
  /** File metadata */
  metadata?: FileAttachmentMetadata;
  /** Optional thumbnail for quick preview */
  thumbnail?: string;
  /** Allow deletion of attachment */
  allowDelete?: boolean;
  /** Callback when attachment is deleted */
  onDelete?: () => void;
}

/**
 * Attachment Viewer Component
 */
export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
  isOpen,
  onClose,
  filePath,
  metadata,
  thumbnail,
  allowDelete = false,
  onDelete
}) => {
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Function to load file data from filesystem (memoized to avoid useEffect dependency issues)
  const loadFileData = useCallback(async () => {
    if (!filePath) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fileSystemService.readMediaFile(filePath);

      if (result.success && result.path) {
        setFileData(result.path);
      } else {
        setError(result.error || 'Failed to load attachment');
      }
    } catch (err) {
      console.error('Error loading attachment:', err);
      setError('Failed to load attachment');
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  // Load file data when modal opens
  useEffect(() => {
    if (isOpen && filePath) {
      loadFileData();
    } else {
      // Clear data when modal closes
      setFileData(null);
      setError(null);
    }
  }, [isOpen, filePath, loadFileData]);

  const handleDownload = () => {
    if (!fileData || !metadata) return;

    try {
      // Create download link
      const link = document.createElement('a');
      link.href = `data:${metadata.mimeType};base64,${fileData}`;
      link.download = metadata.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToastMessage('File downloaded');
    } catch (err) {
      console.error('Download failed:', err);
      showToastMessage('Download failed');
    }
  };

  const handleShare = async () => {
    if (!fileData || !metadata) return;

    try {
      // Convert base64 to blob
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: metadata.mimeType });

      // Create file from blob
      const file = new File([blob], metadata.filename, { type: metadata.mimeType });

      // Use Web Share API if available
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: metadata.filename
        });
        showToastMessage('Shared successfully');
      } else {
        showToastMessage('Sharing not supported on this device');
      }
    } catch (err) {
      console.error('Share failed:', err);
      if ((err as Error).name !== 'AbortError') {
        showToastMessage('Share failed');
      }
    }
  };

  const handleDelete = async () => {
    if (!filePath) return;

    try {
      const result = await fileSystemService.deleteMediaFile(filePath);

      if (result.success) {
        showToastMessage('Attachment deleted');
        onDelete?.();
        onClose();
      } else {
        showToastMessage(result.error || 'Failed to delete');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      showToastMessage('Failed to delete');
    }
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="attachment-viewer-center">
          <IonSpinner name="crescent" />
          <IonText>
            <p>Loading attachment...</p>
          </IonText>
        </div>
      );
    }

    if (error) {
      return (
        <div className="attachment-viewer-center">
          <IonText color="danger">
            <h3>Error Loading Attachment</h3>
            <p>{error}</p>
          </IonText>
        </div>
      );
    }

    if (!fileData && thumbnail) {
      // Show thumbnail while loading
      return (
        <div className="attachment-viewer-content">
          <img
            src={`data:${metadata?.mimeType};base64,${thumbnail}`}
            alt={metadata?.filename || 'Attachment'}
            className="attachment-viewer-image"
            style={{ opacity: 0.6 }}
          />
        </div>
      );
    }

    if (!fileData) {
      return (
        <div className="attachment-viewer-center">
          <IonText color="medium">
            <p>No attachment data</p>
          </IonText>
        </div>
      );
    }

    // Render based on MIME type
    if (metadata?.mimeType.startsWith('image/')) {
      return (
        <div className="attachment-viewer-content">
          <img
            src={`data:${metadata.mimeType};base64,${fileData}`}
            alt={metadata.filename}
            className="attachment-viewer-image"
          />
        </div>
      );
    }

    if (metadata?.mimeType.startsWith('video/')) {
      return (
        <div className="attachment-viewer-content">
          <video
            src={`data:${metadata.mimeType};base64,${fileData}`}
            controls
            className="attachment-viewer-video"
          />
        </div>
      );
    }

    // For documents and other types
    return (
      <div className="attachment-viewer-center">
        <IonText>
          <h3>{metadata?.filename}</h3>
          <p>Type: {metadata?.mimeType}</p>
          <p>Size: {metadata ? (metadata.sizeBytes / 1024).toFixed(2) : 0} KB</p>
          <IonButton onClick={handleDownload}>
            <IonIcon icon={downloadOutline} slot="start" />
            Download
          </IonButton>
        </IonText>
      </div>
    );
  };

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{metadata?.filename || 'Attachment'}</IonTitle>
            <IonButtons slot="end">
              {metadata?.mimeType.startsWith('image/') && fileData && (
                <>
                  <IonButton onClick={handleDownload}>
                    <IonIcon icon={downloadOutline} />
                  </IonButton>
                  <IonButton onClick={handleShare}>
                    <IonIcon icon={shareOutline} />
                  </IonButton>
                </>
              )}
              {allowDelete && (
                <IonButton color="danger" onClick={handleDelete}>
                  <IonIcon icon={trashOutline} />
                </IonButton>
              )}
              <IonButton onClick={onClose}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent className="attachment-viewer-modal">
          {renderContent()}
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={2000}
        position="bottom"
      />

      <style>{`
        .attachment-viewer-modal {
          --background: #000;
        }

        .attachment-viewer-content {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 16px;
        }

        .attachment-viewer-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 32px;
          text-align: center;
        }

        .attachment-viewer-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .attachment-viewer-video {
          max-width: 100%;
          max-height: 100%;
        }
      `}</style>
    </>
  );
};

export default AttachmentViewer;
