/**
 * Comprehensive Persistent Storage System
 * Supports IndexedDB, localStorage, and backend synchronization
 */

import { Project, StoryData, APISettings, DrawingSettings, ExportSettings } from '../types';
import backendAPI from './backendAPI';

// Storage configuration
const STORAGE_CONFIG = {
  dbName: 'ColorBookEngine',
  dbVersion: 1,
  stores: {
    projects: 'projects',
    stories: 'stories', 
    settings: 'settings',
    images: 'images',
    drawings: 'drawings',
    exports: 'exports'
  },
  localStorageKeys: {
    apiSettings: 'cbe_api_settings',
    drawingSettings: 'cbe_drawing_settings',
    exportSettings: 'cbe_export_settings',
    userPreferences: 'cbe_user_preferences',
    lastSync: 'cbe_last_sync',
    syncQueue: 'cbe_sync_queue'
  }
};

interface StorageMetadata {
  id: string;
  type: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  size?: number;
  syncStatus: 'local' | 'synced' | 'conflict' | 'syncing';
  cloudId?: string;
}

interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  type: string;
  data?: any;
  timestamp: string;
  retryCount: number;
}

class PersistentStorageManager {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncQueue: SyncQueueItem[] = [];
  private syncInProgress: boolean = false;

  constructor() {
    // Monitor online status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Load sync queue from localStorage
    this.loadSyncQueue();
  }

  /**
   * Initialize IndexedDB
   */
  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(STORAGE_CONFIG.dbName, STORAGE_CONFIG.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORAGE_CONFIG.stores.projects)) {
          const projectStore = db.createObjectStore(STORAGE_CONFIG.stores.projects, { keyPath: 'id' });
          projectStore.createIndex('title', 'title', { unique: false });
          projectStore.createIndex('createdAt', 'createdAt', { unique: false });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          projectStore.createIndex('syncStatus', 'metadata.syncStatus', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORAGE_CONFIG.stores.stories)) {
          const storyStore = db.createObjectStore(STORAGE_CONFIG.stores.stories, { keyPath: 'id' });
          storyStore.createIndex('projectId', 'projectId', { unique: false });
          storyStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORAGE_CONFIG.stores.images)) {
          const imageStore = db.createObjectStore(STORAGE_CONFIG.stores.images, { keyPath: 'id' });
          imageStore.createIndex('projectId', 'projectId', { unique: false });
          imageStore.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORAGE_CONFIG.stores.drawings)) {
          const drawingStore = db.createObjectStore(STORAGE_CONFIG.stores.drawings, { keyPath: 'id' });
          drawingStore.createIndex('projectId', 'projectId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORAGE_CONFIG.stores.exports)) {
          const exportStore = db.createObjectStore(STORAGE_CONFIG.stores.exports, { keyPath: 'id' });
          exportStore.createIndex('projectId', 'projectId', { unique: false });
          exportStore.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORAGE_CONFIG.stores.settings)) {
          db.createObjectStore(STORAGE_CONFIG.stores.settings, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Generic IndexedDB operations
   */
  private async dbOperation<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Project Storage Operations
   */
  async saveProject(project: Project): Promise<void> {
    const projectWithMetadata = {
      ...project,
      metadata: this.createMetadata(project.id, 'project')
    };

    await this.dbOperation(
      STORAGE_CONFIG.stores.projects,
      'readwrite',
      (store) => store.put(projectWithMetadata)
    );

    // Add to sync queue
    this.addToSyncQueue({
      id: project.id,
      action: 'update',
      type: 'project',
      data: projectWithMetadata,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });

    console.log('Project saved to IndexedDB:', project.title);
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const project = await this.dbOperation<Project>(
        STORAGE_CONFIG.stores.projects,
        'readonly',
        (store) => store.get(id)
      );
      return project || null;
    } catch (error) {
      console.error('Error getting project:', error);
      return null;
    }
  }

  async getAllProjects(): Promise<Project[]> {
    try {
      const projects = await this.dbOperation<Project[]>(
        STORAGE_CONFIG.stores.projects,
        'readonly',
        (store) => store.getAll()
      );
      return projects || [];
    } catch (error) {
      console.error('Error getting all projects:', error);
      return [];
    }
  }

  async deleteProject(id: string): Promise<void> {
    await this.dbOperation(
      STORAGE_CONFIG.stores.projects,
      'readwrite',
      (store) => store.delete(id)
    );

    // Delete related data
    await this.deleteProjectStories(id);
    await this.deleteProjectImages(id);
    await this.deleteProjectDrawings(id);

    // Add to sync queue
    this.addToSyncQueue({
      id,
      action: 'delete',
      type: 'project',
      timestamp: new Date().toISOString(),
      retryCount: 0
    });

    console.log('Project deleted from IndexedDB:', id);
  }

  /**
   * Story Storage Operations
   */
  async saveStory(story: StoryData, projectId: string): Promise<void> {
    const storyWithMetadata = {
      ...story,
      projectId,
      metadata: this.createMetadata(story.id || this.generateId(), 'story')
    };

    await this.dbOperation(
      STORAGE_CONFIG.stores.stories,
      'readwrite',
      (store) => store.put(storyWithMetadata)
    );

    this.addToSyncQueue({
      id: storyWithMetadata.id!,
      action: 'update',
      type: 'story',
      data: storyWithMetadata,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });
  }

  async getProjectStories(projectId: string): Promise<StoryData[]> {
    try {
      const stories = await this.dbOperation<StoryData[]>(
        STORAGE_CONFIG.stores.stories,
        'readonly',
        (store) => {
          const index = store.index('projectId');
          return index.getAll(projectId);
        }
      );
      return stories || [];
    } catch (error) {
      console.error('Error getting project stories:', error);
      return [];
    }
  }

  async deleteProjectStories(projectId: string): Promise<void> {
    const stories = await this.getProjectStories(projectId);
    for (const story of stories) {
      if (story.id) {
        await this.dbOperation(
          STORAGE_CONFIG.stores.stories,
          'readwrite',
          (store) => store.delete(story.id!)
        );
      }
    }
  }

  /**
   * Image Storage Operations
   */
  async saveImage(imageData: {
    id: string;
    projectId: string;
    type: 'story' | 'cover' | 'drawing';
    data: string;
    metadata?: any;
  }): Promise<void> {
    const imageWithMetadata = {
      ...imageData,
      metadata: this.createMetadata(imageData.id, 'image'),
      size: new Blob([imageData.data]).size
    };

    await this.dbOperation(
      STORAGE_CONFIG.stores.images,
      'readwrite',
      (store) => store.put(imageWithMetadata)
    );

    this.addToSyncQueue({
      id: imageData.id,
      action: 'update',
      type: 'image',
      data: imageWithMetadata,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });
  }

  async getProjectImages(projectId: string): Promise<any[]> {
    try {
      const images = await this.dbOperation<any[]>(
        STORAGE_CONFIG.stores.images,
        'readonly',
        (store) => {
          const index = store.index('projectId');
          return index.getAll(projectId);
        }
      );
      return images || [];
    } catch (error) {
      console.error('Error getting project images:', error);
      return [];
    }
  }

  async deleteProjectImages(projectId: string): Promise<void> {
    const images = await this.getProjectImages(projectId);
    for (const image of images) {
      await this.dbOperation(
        STORAGE_CONFIG.stores.images,
        'readwrite',
        (store) => store.delete(image.id)
      );
    }
  }

  /**
   * Drawing Storage Operations
   */
  async saveDrawing(drawingData: {
    id: string;
    projectId: string;
    canvasData: string;
    metadata?: any;
  }): Promise<void> {
    const drawingWithMetadata = {
      ...drawingData,
      metadata: this.createMetadata(drawingData.id, 'drawing'),
      size: new Blob([drawingData.canvasData]).size
    };

    await this.dbOperation(
      STORAGE_CONFIG.stores.drawings,
      'readwrite',
      (store) => store.put(drawingWithMetadata)
    );
  }

  async getProjectDrawings(projectId: string): Promise<any[]> {
    try {
      const drawings = await this.dbOperation<any[]>(
        STORAGE_CONFIG.stores.drawings,
        'readonly',
        (store) => {
          const index = store.index('projectId');
          return index.getAll(projectId);
        }
      );
      return drawings || [];
    } catch (error) {
      console.error('Error getting project drawings:', error);
      return [];
    }
  }

  async deleteProjectDrawings(projectId: string): Promise<void> {
    const drawings = await this.getProjectDrawings(projectId);
    for (const drawing of drawings) {
      await this.dbOperation(
        STORAGE_CONFIG.stores.drawings,
        'readwrite',
        (store) => store.delete(drawing.id)
      );
    }
  }

  /**
   * Settings Storage Operations (localStorage for fast access)
   */
  saveAPISettings(settings: APISettings): void {
    localStorage.setItem(
      STORAGE_CONFIG.localStorageKeys.apiSettings,
      JSON.stringify(settings)
    );
    this.addToSyncQueue({
      id: 'api_settings',
      action: 'update',
      type: 'settings',
      data: settings,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });
  }

  getAPISettings(): APISettings | null {
    try {
      const settings = localStorage.getItem(STORAGE_CONFIG.localStorageKeys.apiSettings);
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      console.error('Error getting API settings:', error);
      return null;
    }
  }

  saveDrawingSettings(settings: DrawingSettings): void {
    localStorage.setItem(
      STORAGE_CONFIG.localStorageKeys.drawingSettings,
      JSON.stringify(settings)
    );
  }

  getDrawingSettings(): DrawingSettings | null {
    try {
      const settings = localStorage.getItem(STORAGE_CONFIG.localStorageKeys.drawingSettings);
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      console.error('Error getting drawing settings:', error);
      return null;
    }
  }

  saveExportSettings(settings: ExportSettings): void {
    localStorage.setItem(
      STORAGE_CONFIG.localStorageKeys.exportSettings,
      JSON.stringify(settings)
    );
  }

  getExportSettings(): ExportSettings | null {
    try {
      const settings = localStorage.getItem(STORAGE_CONFIG.localStorageKeys.exportSettings);
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      console.error('Error getting export settings:', error);
      return null;
    }
  }

  /**
   * Sync Queue Management
   */
  private addToSyncQueue(item: SyncQueueItem): void {
    this.syncQueue.push(item);
    this.saveSyncQueue();
    
    if (this.isOnline && !this.syncInProgress) {
      this.processSyncQueue();
    }
  }

  private saveSyncQueue(): void {
    localStorage.setItem(
      STORAGE_CONFIG.localStorageKeys.syncQueue,
      JSON.stringify(this.syncQueue)
    );
  }

  private loadSyncQueue(): void {
    try {
      const queue = localStorage.getItem(STORAGE_CONFIG.localStorageKeys.syncQueue);
      this.syncQueue = queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error loading sync queue:', error);
      this.syncQueue = [];
    }
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log('Processing sync queue:', this.syncQueue.length, 'items');

    const processedItems: string[] = [];
    
    for (const item of this.syncQueue) {
      try {
        // Here you would implement actual backend sync
        await this.syncToBackend(item);
        processedItems.push(item.id);
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);
        item.retryCount++;
        
        // Remove items that have failed too many times
        if (item.retryCount > 3) {
          processedItems.push(item.id);
        }
      }
    }

    // Remove processed items from queue
    this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item.id));
    this.saveSyncQueue();
    this.syncInProgress = false;

    if (processedItems.length > 0) {
      localStorage.setItem(
        STORAGE_CONFIG.localStorageKeys.lastSync,
        new Date().toISOString()
      );
    }

    console.log('Sync queue processed. Remaining items:', this.syncQueue.length);
  }

  private async syncToBackend(item: SyncQueueItem): Promise<void> {
    try {
      await this.updateSyncStatus(item.type, item.id, 'syncing');

      let response: { error?: string; message?: string } | undefined;

      switch (item.type) {
        case 'project':
          if (item.action === 'delete') {
            response = await backendAPI.deleteProject(item.id);
          } else if (item.action === 'create') {
            response = await backendAPI.createProject(item.data);
          } else {
            response = await backendAPI.updateProject(item.id, item.data);
          }
          break;
        case 'story':
          if (item.action === 'delete') {
            response = await backendAPI.deleteStory(item.id);
          } else if (item.action === 'create') {
            response = await backendAPI.createStory(item.data);
          } else {
            response = await backendAPI.updateStory(item.id, item.data);
          }
          break;
        default:
          return;
      }

      if (response?.error) {
        await this.updateSyncStatus(item.type, item.id, 'conflict');
        throw new Error(response.error || response.message || 'Sync failed');
      }

      await this.updateSyncStatus(item.type, item.id, 'synced');
    } catch (error) {
      await this.updateSyncStatus(item.type, item.id, 'conflict');
      throw error;
    }
  }

  /**
   * Storage Statistics and Management
   */
  async getStorageStats(): Promise<{
    projects: number;
    stories: number;
    images: number;
    drawings: number;
    totalSize: number;
    syncQueueSize: number;
  }> {
    const projects = await this.getAllProjects();
    const allImages = await this.dbOperation<any[]>(
      STORAGE_CONFIG.stores.images,
      'readonly',
      (store) => store.getAll()
    );
    const allDrawings = await this.dbOperation<any[]>(
      STORAGE_CONFIG.stores.drawings,
      'readonly',
      (store) => store.getAll()
    );
    const allStories = await this.dbOperation<any[]>(
      STORAGE_CONFIG.stores.stories,
      'readonly',
      (store) => store.getAll()
    );

    const totalSize = [...allImages, ...allDrawings].reduce((size, item) => {
      return size + (item.size || 0);
    }, 0);

    return {
      projects: projects.length,
      stories: allStories.length,
      images: allImages.length,
      drawings: allDrawings.length,
      totalSize,
      syncQueueSize: this.syncQueue.length
    };
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.initDB();
    
    const stores = Object.values(STORAGE_CONFIG.stores);
    for (const storeName of stores) {
      await this.dbOperation(
        storeName,
        'readwrite',
        (store) => store.clear()
      );
    }

    // Clear localStorage
    Object.values(STORAGE_CONFIG.localStorageKeys).forEach(key => {
      localStorage.removeItem(key);
    });

    this.syncQueue = [];
    console.log('All data cleared');
  }

  async exportAllData(): Promise<string> {
    const projects = await this.getAllProjects();
    const allStories = await this.dbOperation<any[]>(
      STORAGE_CONFIG.stores.stories,
      'readonly',
      (store) => store.getAll()
    );
    const allImages = await this.dbOperation<any[]>(
      STORAGE_CONFIG.stores.images,
      'readonly',
      (store) => store.getAll()
    );

    const exportData = {
      projects,
      stories: allStories,
      images: allImages,
      exportedAt: new Date().toISOString(),
      version: STORAGE_CONFIG.dbVersion
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.projects) {
        for (const project of data.projects) {
          await this.saveProject(project);
        }
      }
      
      if (data.stories) {
        for (const story of data.stories) {
          await this.dbOperation(
            STORAGE_CONFIG.stores.stories,
            'readwrite',
            (store) => store.put(story)
          );
        }
      }
      
      if (data.images) {
        for (const image of data.images) {
          await this.dbOperation(
            STORAGE_CONFIG.stores.images,
            'readwrite',
            (store) => store.put(image)
          );
        }
      }

      console.log('Data imported successfully');
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  /**
   * Utility Methods
   */
  private createMetadata(id: string, type: string): StorageMetadata {
    return {
      id,
      type,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'local'
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private getStoreForType(type: string): string | null {
    switch (type) {
      case 'project':
        return STORAGE_CONFIG.stores.projects;
      case 'story':
        return STORAGE_CONFIG.stores.stories;
      case 'image':
        return STORAGE_CONFIG.stores.images;
      case 'drawing':
        return STORAGE_CONFIG.stores.drawings;
      default:
        return null;
    }
  }

  private async updateSyncStatus(
    type: string,
    id: string,
    status: 'local' | 'synced' | 'conflict' | 'syncing'
  ): Promise<void> {
    const storeName = this.getStoreForType(type);
    if (!storeName) return;

    try {
      const record = await this.dbOperation<any>(
        storeName,
        'readonly',
        (store) => store.get(id)
      );
      if (record) {
        record.metadata = {
          ...record.metadata,
          syncStatus: status,
          updatedAt: new Date().toISOString(),
        };
        await this.dbOperation(
          storeName,
          'readwrite',
          (store) => store.put(record)
        );
      }
    } catch (error) {
      console.error('Failed to update sync status:', error);
    }
  }

  /**
   * Manual sync triggers
   */
  async forceSyncAll(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    
    await this.processSyncQueue();
  }

  getSyncStatus(): {
    isOnline: boolean;
    syncInProgress: boolean;
    queueSize: number;
    lastSync: string | null;
  } {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      queueSize: this.syncQueue.length,
      lastSync: localStorage.getItem(STORAGE_CONFIG.localStorageKeys.lastSync)
    };
  }
}

// Export singleton instance
export const persistentStorage = new PersistentStorageManager();

// Auto-initialize on first use
persistentStorage.initDB().catch(console.error);

export default persistentStorage;