/**
 * ResQLink File System Service
 *
 * Handles file operations for media attachments, including:
 * - Saving photos/videos from camera
 * - Reading media files for display
 * - Managing file lifecycle and cleanup
 * - Thumbnail generation for performance
 * - File size validation and compression
 */

import { Filesystem, Directory } from '@capacitor/filesystem';
import type { ReadFileResult, WriteFileResult } from '@capacitor/filesystem';

/**
 * Configuration for file storage and management
 */
export interface FileSystemConfig {
  maxFileSizeBytes: number; // Maximum file size (default 5MB)
  maxTotalStorageMB: number; // Maximum total storage (default 100MB)
  thumbnailMaxDimension: number; // Max width/height for thumbnails (default 200px)
  compressionQuality: number; // JPEG compression quality 0-1 (default 0.8)
  cleanupIntervalMs: number; // How often to run cleanup (default 1 hour)
}

/**
 * Metadata for stored files
 */
export interface FileMetadata {
  path: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  thumbnail?: string; // Base64 thumbnail for quick display
}

/**
 * Result of file operation
 */
export interface FileOperationResult {
  success: boolean;
  path?: string;
  error?: string;
  metadata?: FileMetadata;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: FileSystemConfig = {
  maxFileSizeBytes: 5 * 1024 * 1024, // 5MB
  maxTotalStorageMB: 100,
  thumbnailMaxDimension: 200,
  compressionQuality: 0.8,
  cleanupIntervalMs: 60 * 60 * 1000, // 1 hour
};

/**
 * File System Service for managing media attachments
 */
export class FileSystemService {
  private config: FileSystemConfig;
  private fileRegistry: Map<string, FileMetadata> = new Map();
  private cleanupTimer?: number;

  constructor(config: Partial<FileSystemConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeCleanup();
  }

  /**
   * Initialize automatic cleanup timer
   */
  private initializeCleanup() {
    this.cleanupTimer = window.setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Save a media file to persistent storage
   * @param base64Data - Base64 encoded file data
   * @param filename - Name for the file (will be sanitized)
   * @param mimeType - MIME type (e.g., 'image/jpeg', 'video/mp4')
   * @returns Result with file path and metadata
   */
  async saveMediaFile(
    base64Data: string,
    filename: string,
    mimeType: string
  ): Promise<FileOperationResult> {
    try {
      // Validate file size
      const sizeBytes = this.estimateBase64Size(base64Data);
      if (sizeBytes > this.config.maxFileSizeBytes) {
        return {
          success: false,
          error: `File size (${(sizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed (${(this.config.maxFileSizeBytes / 1024 / 1024).toFixed(2)}MB)`,
        };
      }

      // Check total storage
      const totalStorage = await this.getTotalStorageUsage();
      if (totalStorage + sizeBytes > this.config.maxTotalStorageMB * 1024 * 1024) {
        // Try cleanup first
        await this.performCleanup();
        const newTotalStorage = await this.getTotalStorageUsage();
        if (newTotalStorage + sizeBytes > this.config.maxTotalStorageMB * 1024 * 1024) {
          return {
            success: false,
            error: 'Storage quota exceeded. Please delete old attachments.',
          };
        }
      }

      // Sanitize filename
      const sanitizedFilename = this.sanitizeFilename(filename);
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}_${sanitizedFilename}`;

      // Write file to filesystem
      const result: WriteFileResult = await Filesystem.writeFile({
        path: `media/${uniqueFilename}`,
        data: base64Data,
        directory: Directory.Data,
      });

      // Generate thumbnail for images
      let thumbnail: string | undefined;
      if (mimeType.startsWith('image/')) {
        thumbnail = await this.generateThumbnail(base64Data, mimeType);
      }

      // Store metadata
      const metadata: FileMetadata = {
        path: result.uri,
        filename: uniqueFilename,
        mimeType,
        sizeBytes,
        createdAt: timestamp,
        thumbnail,
      };

      this.fileRegistry.set(result.uri, metadata);

      return {
        success: true,
        path: result.uri,
        metadata,
      };
    } catch (error) {
      console.error('Error saving media file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error saving file',
      };
    }
  }

  /**
   * Read a media file from storage
   * @param filepath - Path to the file (from saveMediaFile result)
   * @returns Base64 encoded file data
   */
  async readMediaFile(filepath: string): Promise<FileOperationResult> {
    try {
      // Extract filename from URI
      const filename = this.extractFilename(filepath);

      const result: ReadFileResult = await Filesystem.readFile({
        path: `media/${filename}`,
        directory: Directory.Data,
      });

      const metadata = this.fileRegistry.get(filepath);

      return {
        success: true,
        path: result.data as string,
        metadata,
      };
    } catch (error) {
      console.error('Error reading media file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error reading file',
      };
    }
  }

  /**
   * Delete a media file from storage
   * @param filepath - Path to the file
   */
  async deleteMediaFile(filepath: string): Promise<FileOperationResult> {
    try {
      const filename = this.extractFilename(filepath);

      await Filesystem.deleteFile({
        path: `media/${filename}`,
        directory: Directory.Data,
      });

      this.fileRegistry.delete(filepath);

      return { success: true };
    } catch (error) {
      console.error('Error deleting media file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deleting file',
      };
    }
  }

  /**
   * List all media files
   */
  async listMediaFiles(): Promise<FileMetadata[]> {
    return Array.from(this.fileRegistry.values());
  }

  /**
   * Get file metadata
   */
  getFileInfo(filepath: string): FileMetadata | undefined {
    return this.fileRegistry.get(filepath);
  }

  /**
   * Get total storage usage in bytes
   */
  private async getTotalStorageUsage(): Promise<number> {
    let total = 0;
    for (const metadata of this.fileRegistry.values()) {
      total += metadata.sizeBytes;
    }
    return total;
  }

  /**
   * Perform cleanup of old files (LRU strategy)
   */
  private async performCleanup() {
    try {
      const totalUsage = await this.getTotalStorageUsage();
      const maxBytes = this.config.maxTotalStorageMB * 1024 * 1024;

      // If under 80% capacity, no cleanup needed
      if (totalUsage < maxBytes * 0.8) {
        return;
      }

      console.log('Performing file cleanup...');

      // Sort files by age (oldest first)
      const sortedFiles = Array.from(this.fileRegistry.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt);

      // Delete oldest files until under 70% capacity
      const targetBytes = maxBytes * 0.7;
      let currentUsage = totalUsage;

      for (const [filepath, metadata] of sortedFiles) {
        if (currentUsage <= targetBytes) break;

        await this.deleteMediaFile(filepath);
        currentUsage -= metadata.sizeBytes;

        console.log(`Deleted old file: ${metadata.filename} (${(metadata.sizeBytes / 1024).toFixed(2)}KB)`);
      }

      console.log(`Cleanup complete. Storage: ${(currentUsage / 1024 / 1024).toFixed(2)}MB / ${this.config.maxTotalStorageMB}MB`);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Generate thumbnail for an image
   */
  private async generateThumbnail(base64Data: string, mimeType: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Data); // Return original if can't create thumbnail
          return;
        }

        // Calculate thumbnail dimensions
        const maxDim = this.config.thumbnailMaxDimension;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = (height * maxDim) / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = (width * maxDim) / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const thumbnail = canvas.toDataURL('image/jpeg', this.config.compressionQuality);

        resolve(thumbnail.split(',')[1]); // Return base64 without data URI prefix
      };

      img.onerror = () => {
        resolve(base64Data); // Return original on error
      };

      img.src = `data:${mimeType};base64,${base64Data}`;
    });
  }

  /**
   * Estimate base64 string size in bytes
   */
  private estimateBase64Size(base64: string): number {
    // Remove data URI prefix if present
    const cleanBase64 = base64.replace(/^data:.*?;base64,/, '');
    // Base64 is roughly 4/3 of original size
    return (cleanBase64.length * 3) / 4;
  }

  /**
   * Sanitize filename for safe storage
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);
  }

  /**
   * Extract filename from URI
   */
  private extractFilename(filepath: string): string {
    // Handle both URI and path formats
    const parts = filepath.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

// Export singleton instance
export const fileSystemService = new FileSystemService();
