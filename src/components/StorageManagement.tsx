import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface StorageManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

const StorageManagement: React.FC<StorageManagementProps> = ({ isOpen, onClose }) => {
  const {
    storageStats,
    syncStatus,
    driveConnected,
    projects,
    updateStorageStats,
    updateSyncStatus,
    connectDrive,
    disconnectDrive,
    syncProjectToDrive,
    clearAllData,
    exportAllData,
    importData,
    forceSyncAll
  } = useAppStore();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      updateStorageStats();
      updateSyncStatus();
      
      // Update stats every 5 seconds while open
      const interval = setInterval(() => {
        updateStorageStats();
        updateSyncStatus();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen, updateStorageStats, updateSyncStatus]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      
      // Create download link
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `colorbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      await importData(text);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await clearAllData();
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Clear failed:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await forceSyncAll();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDriveConnect = async () => {
    setIsDriveConnecting(true);
    try {
      await connectDrive();
    } catch (err) {
      console.error('Drive connect error:', err);
    } finally {
      setIsDriveConnecting(false);
    }
  };

  const handleDriveSyncAll = async () => {
    setIsDriveSyncing(true);
    try {
      for (const project of projects) {
        await syncProjectToDrive(project);
      }
    } catch (err) {
      console.error('Drive sync error:', err);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">💾 Storage Management</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Storage Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{storageStats.projects}</div>
              <div className="text-sm text-blue-800">Projects</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{storageStats.stories}</div>
              <div className="text-sm text-green-800">Stories</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{storageStats.images}</div>
              <div className="text-sm text-purple-800">Images</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{storageStats.drawings}</div>
              <div className="text-sm text-orange-800">Drawings</div>
            </div>
          </div>

          {/* Storage Usage */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Storage Usage</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Size:</span>
                <span className="font-mono">{formatBytes(storageStats.totalSize)}</span>
              </div>
              <div className="flex justify-between">
                <span>Sync Queue:</span>
                <span className="font-mono">{storageStats.syncQueueSize} items</span>
              </div>
            </div>
          </div>

          {/* Sync Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Synchronization Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Connection Status:</span>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${
                    syncStatus.isOnline ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className={syncStatus.isOnline ? 'text-green-600' : 'text-red-600'}>
                    {syncStatus.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Sync Status:</span>
                <div className="flex items-center">
                  {syncStatus.syncInProgress && (
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse mr-2"></div>
                  )}
                  <span className={syncStatus.syncInProgress ? 'text-blue-600' : 'text-gray-600'}>
                    {syncStatus.syncInProgress ? 'Syncing...' : 'Idle'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between">
                <span>Pending Items:</span>
                <span className="font-mono">{syncStatus.queueSize} items</span>
              </div>
              
              <div className="flex justify-between">
                <span>Last Sync:</span>
                <span className="text-sm text-gray-600">
                  {syncStatus.lastSync 
                    ? new Date(syncStatus.lastSync).toLocaleString()
                    : 'Never'
                  }
                </span>
              </div>
              
              <button
                onClick={handleSync}
                disabled={isSyncing || !syncStatus.isOnline}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSyncing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Syncing...
                  </>
                ) : (
                  '🔄 Force Sync Now'
                )}
              </button>
            </div>
          </div>

          {/* Google Drive */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Google Drive</h3>
            {driveConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-green-700">Connected</p>
                <button
                  onClick={handleDriveSyncAll}
                  disabled={isDriveSyncing}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 disabled:bg-gray-400 flex items-center justify-center"
                >
                  {isDriveSyncing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Syncing
                    </>
                  ) : (
                    'Sync All Projects'
                  )}
                </button>
                <ul className="text-sm divide-y divide-gray-200">
                  {projects.map(p => (
                    <li key={p.id} className="flex justify-between py-1">
                      <span>{p.title}</span>
                      <span className="capitalize">
                        {getProjectDriveStatus(p.id)}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={disconnectDrive}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-700">Not connected</p>
                <button
                  onClick={handleDriveConnect}
                  disabled={isDriveConnecting}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 disabled:bg-gray-400 flex items-center justify-center"
                >
                  {isDriveConnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Connecting
                    </>
                  ) : (
                    'Connect Google Drive'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Data Management Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Export Data */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">📤 Export Data</h4>
              <p className="text-sm text-green-700 mb-3">
                Download all your projects, stories, and settings as a backup file.
              </p>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                    Exporting...
                  </>
                ) : (
                  'Export Backup'
                )}
              </button>
            </div>

            {/* Import Data */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">📥 Import Data</h4>
              <p className="text-sm text-blue-700 mb-3">
                Restore data from a previously exported backup file.
              </p>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={isImporting}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <button
                  disabled={isImporting}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Importing...
                    </>
                  ) : (
                    'Import Backup'
                  )}
                </button>
              </div>
            </div>

            {/* Clear Data */}
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-2">🗑️ Clear Data</h4>
              <p className="text-sm text-red-700 mb-3">
                Permanently delete all projects, stories, and settings. This cannot be undone.
              </p>
              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
                >
                  Clear All Data
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-800 font-semibold">Are you sure? This cannot be undone!</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="bg-gray-500 text-white py-1 px-2 rounded text-sm hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClearData}
                      disabled={isClearing}
                      className="bg-red-600 text-white py-1 px-2 rounded text-sm hover:bg-red-700 disabled:bg-gray-400"
                    >
                      {isClearing ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mx-auto"></div>
                      ) : (
                        'Delete All'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Storage Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">📊 Storage Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Local Storage</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• IndexedDB: Projects, stories, images, drawings</li>
                  <li>• localStorage: Settings and preferences</li>
                  <li>• Session storage: Temporary UI state</li>
                  <li>• Offline-first architecture</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Cloud Sync</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Automatic background synchronization</li>
                  <li>• Conflict resolution for concurrent edits</li>
                  <li>• Offline queue for failed operations</li>
                  <li>• Cross-device data consistency</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Performance Tips */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">💡 Performance Tips</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>• <strong>Export regularly:</strong> Create backups of your important projects.</p>
              <p>• <strong>Manage large files:</strong> Large images and drawings consume more storage space.</p>
              <p>• <strong>Sync when online:</strong> Ensure you're connected to sync your latest changes.</p>
              <p>• <strong>Clear cache:</strong> If experiencing issues, try clearing browser cache (not app data).</p>
            </div>
          </div>

          {/* Debug Information */}
          <details className="bg-gray-100 p-4 rounded-lg">
            <summary className="font-semibold cursor-pointer">🔧 Debug Information</summary>
            <div className="mt-3 text-sm font-mono bg-white p-3 rounded border">
              <pre>{JSON.stringify({
                storageStats,
                syncStatus,
                browserInfo: {
                  userAgent: navigator.userAgent,
                  cookieEnabled: navigator.cookieEnabled,
                  onLine: navigator.onLine,
                  language: navigator.language
                },
                storageQuotas: {
                  // Note: Storage quota API not universally supported
                  indexedDBSupported: 'indexedDB' in window,
                  localStorageSupported: 'localStorage' in window
                }
              }, null, 2)}</pre>
            </div>
          </details>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageManagement;