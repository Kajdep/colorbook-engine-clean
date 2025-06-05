class SimpleEmitter extends EventTarget {
  emit(name: string, detail?: any) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

export interface DriveCredentials {
  clientId: string;
  apiKey: string;
  scope?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

/**
 * Simple Google Drive integration using the gapi script.
 * Handles OAuth sign-in and basic file upload/download.
 */
class DriveService extends SimpleEmitter {
  private token: gapi.auth2.GoogleUser | null = null;
  private credentials: DriveCredentials | null = null;

  init(creds: DriveCredentials): Promise<void> {
    this.credentials = creds;
    return new Promise((resolve, reject) => {
      gapi.load('client:auth2', async () => {
        try {
          await gapi.client.init({
            apiKey: creds.apiKey,
            clientId: creds.clientId,
            scope: creds.scope || 'https://www.googleapis.com/auth/drive.file'
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  async signIn(): Promise<void> {
    if (!gapi.auth2) throw new Error('gapi not initialized');
    const auth = gapi.auth2.getAuthInstance();
    this.token = await auth.signIn();
    this.emit('authChange', true);
  }

  async signOut(): Promise<void> {
    if (this.token) {
      await gapi.auth2.getAuthInstance().signOut();
      this.token = null;
      this.emit('authChange', false);
    }
  }

  isSignedIn(): boolean {
    return !!this.token;
  }

  async uploadFile(blob: Blob, name: string, folderId?: string): Promise<DriveFile> {
    if (!this.isSignedIn()) throw new Error('Not signed in');
    const metadata: any = {
      name,
      mimeType: blob.type
    };
    if (folderId) metadata.parents = [folderId];

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.token?.getAuthResponse().access_token },
      body: form
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  }

  async downloadFile(fileId: string): Promise<Blob> {
    if (!this.isSignedIn()) throw new Error('Not signed in');
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: 'Bearer ' + this.token?.getAuthResponse().access_token }
    });
    if (!response.ok) throw new Error('Download failed');
    return response.blob();
  }
}

export const driveService = new DriveService();
export default driveService;


