/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Google Drive Service
 * Provides OAuth authentication and project synchronization
 */

import { Project } from '../types';

// Declare gapi global provided by Google API script
declare const gapi: any;

interface DriveConfig {
  apiKey: string;
  clientId: string;
}

type SyncState = 'local' | 'syncing' | 'synced' | 'error';

class GoogleDriveService {
  private apiKey = '';
  private clientId = '';
  private scope = 'https://www.googleapis.com/auth/drive.file';
  private discoveryDocs = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
  private initialized = false;
  private syncStatus: Record<string, SyncState> = {};
  private cloudFileMap: Record<string, string> = {};

  /** Load gapi script and initialize client */
  async init(config: DriveConfig): Promise<void> {
    this.apiKey = config.apiKey;
    this.clientId = config.clientId;

    if (typeof gapi === 'undefined') {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load gapi script'));
        document.body.appendChild(script);
      });
    }

    return new Promise((resolve, reject) => {
      gapi.load('client:auth2', async () => {
        try {
          await gapi.client.init({
            apiKey: this.apiKey,
            clientId: this.clientId,
            discoveryDocs: this.discoveryDocs,
            scope: this.scope
          });
          this.initialized = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /** Trigger Google sign-in */
  async signIn(): Promise<void> {
    if (!this.initialized) throw new Error('Drive client not initialized');
    await gapi.auth2.getAuthInstance().signIn();
  }

  /** Sign out of Google account */
  async signOut(): Promise<void> {
    if (!this.initialized) return;
    await gapi.auth2.getAuthInstance().signOut();
  }

  /** Is a user currently signed in? */
  isSignedIn(): boolean {
    return this.initialized && gapi.auth2.getAuthInstance().isSignedIn.get();
  }

  /** Upload raw data to Drive and return file ID */
  private async uploadFile(name: string, data: Blob): Promise<string> {
    const accessToken = gapi.auth.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name })], { type: 'application/json' }));
    form.append('file', data);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Upload failed: ${err}`);
    }

    const json = await res.json();
    return json.id as string;
  }

  /** Update an existing Drive file */
  private async updateFile(fileId: string, name: string, data: Blob): Promise<void> {
    const accessToken = gapi.auth.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name })], { type: 'application/json' }));
    form.append('file', data);

    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Update failed: ${err}`);
    }
  }

  /** Download a file from Drive */
  async downloadFile(fileId: string): Promise<Blob> {
    if (!this.isSignedIn()) throw new Error('Not authenticated');
    const accessToken = gapi.auth.getToken().access_token;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Download failed: ${err}`);
    }

    return res.blob();
  }

  /** List JSON project files stored in Drive */
  async listProjectFiles(): Promise<any[]> {
    if (!this.isSignedIn()) throw new Error('Not authenticated');
    const res = await gapi.client.drive.files.list({
      q: "mimeType='application/json' and trashed=false",
      fields: 'files(id,name,modifiedTime)'
    });
    return res.result.files || [];
  }

  /** Sync a project object to Drive */
  async syncProject(project: Project): Promise<void> {
    if (!this.isSignedIn()) throw new Error('Not authenticated');

    this.syncStatus[project.id] = 'syncing';
    const fileName = `${project.title}-${project.id}.json`;
    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });

    try {
      const existingId = this.cloudFileMap[project.id];
      if (existingId) {
        await this.updateFile(existingId, fileName, blob);
      } else {
        const id = await this.uploadFile(fileName, blob);
        this.cloudFileMap[project.id] = id;
      }
      this.syncStatus[project.id] = 'synced';
    } catch (error) {
      console.error('Drive sync failed:', error);
      this.syncStatus[project.id] = 'error';
      throw error;
    }
  }

  /** Get the sync status of a project */
  getSyncStatus(projectId: string): SyncState {
    return this.syncStatus[projectId] || 'local';
  }

  /** Get stored Drive file ID for a project */
  getFileId(projectId: string): string | undefined {
    return this.cloudFileMap[projectId];
  }
}

export const driveService = new GoogleDriveService();

export default driveService;
