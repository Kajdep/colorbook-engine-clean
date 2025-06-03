import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { canvaIntegration } from '../utils/canvaIntegration';
import { errorTracker } from '../utils/errorTracking';

interface CanvaExportProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

const CanvaExport: React.FC<CanvaExportProps> = ({ isOpen, onClose, projectId }) => {
  const { projects, addNotification } = useAppStore();
  const [selectedProject, setSelectedProject] = useState(projectId || '');
  const [exportFormat, setExportFormat] = useState<'json' | 'package'>('package');
  const [template, setTemplate] = useState('coloring-book');
  const [dimensions, setDimensions] = useState({ width: 8.5, height: 11, unit: 'in' as const });
  const [isExporting, setIsExporting] = useState(false);
  const [canvaApiKey, setCanvaApiKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error' | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCanvaSettings();
    }
  }, [isOpen]);

  const loadCanvaSettings = () => {
    const storedApiKey = localStorage.getItem('canva_api_key');
    if (storedApiKey) {
      setCanvaApiKey(storedApiKey);
    }
  };

  const testCanvaConnection = async () => {
    if (!canvaApiKey.trim()) {
      addNotification({
        type: 'error',
        message: 'Please enter your Canva API key'
      });
      return;
    }

    setConnectionStatus('testing');
    
    try {
      canvaIntegration.setApiKey(canvaApiKey);
      const result = await canvaIntegration.testConnection();
      
      if (result.success) {
        setConnectionStatus('success');
        addNotification({
          type: 'success',
          message: 'Canva connection successful!'
        });
      } else {
        setConnectionStatus('error');
        addNotification({
          type: 'error',
          message: result.error || 'Canva connection failed'
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      addNotification({
        type: 'error',
        message: 'Failed to test Canva connection'
      });
      errorTracker.captureError(
        error instanceof Error ? error : new Error('Canva connection test failed'),
        { apiKeyPresent: !!canvaApiKey },
        'medium'
      );
    }
  };

  const handleExport = async () => {
    if (!selectedProject) {
      addNotification({
        type: 'error',
        message: 'Please select a project to export'
      });
      return;
    }

    const project = projects.find(p => p.id === selectedProject);
    if (!project) {
      addNotification({
        type: 'error',
        message: 'Selected project not found'
      });
      return;
    }

    setIsExporting(true);

    try {
      errorTracker.captureUserAction('canva_export_started', {
        projectId: selectedProject,
        format: exportFormat,
        template
      });

      const options = {
        projectId: selectedProject,
        format: exportFormat,
        template,
        dimensions,
        includeMetadata: true
      };

      let result;
      
      if (exportFormat === 'package') {
        result = await canvaIntegration.generateCanvaPackage(project, options as any);
      } else {
        result = await canvaIntegration.exportToCanva(project, options as any);
      }

      if (result.success) {
        if (result.downloadUrl) {
          const link = document.createElement('a');
          link.href = result.downloadUrl;
          link.download = `${project.title}-canva-export.${exportFormat === 'package' ? 'zip' : 'json'}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        addNotification({
          type: 'success',
          message: `Canva export completed! Download started automatically.`
        });

        errorTracker.captureUserAction('canva_export_completed', {
          projectId: selectedProject,
          format: exportFormat,
          success: true
        });

        onClose();
      } else {
        addNotification({
          type: 'error',
          message: result.error || 'Export to Canva failed'
        });

        errorTracker.captureError(
          new Error(result.error || 'Canva export failed'),
          { projectId: selectedProject, format: exportFormat },
          'medium'
        );
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to export to Canva'
      });

      errorTracker.captureError(
        error instanceof Error ? error : new Error('Canva export error'),
        { projectId: selectedProject, format: exportFormat },
        'medium'
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">🎨 Export to Canva</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={isExporting}
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* API Key Configuration */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">🔑 Canva API Configuration</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-1">
                    Canva API Key (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={canvaApiKey}
                      onChange={(e) => setCanvaApiKey(e.target.value)}
                      className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your Canva API key (optional)"
                    />
                    <button
                      onClick={testCanvaConnection}
                      disabled={connectionStatus === 'testing' || !canvaApiKey.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {connectionStatus === 'testing' && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      )}
                      Test
                    </button>
                  </div>
                  {connectionStatus === 'success' && (
                    <p className="text-sm text-green-600 mt-1">✅ Connection successful!</p>
                  )}
                  {connectionStatus === 'error' && (
                    <p className="text-sm text-red-600 mt-1">❌ Connection failed</p>
                  )}
                </div>
                <p className="text-xs text-blue-700">
                  💡 API key enables direct export to Canva. Without it, you'll get a downloadable package for manual import.
                </p>
              </div>
            </div>

            {/* Project Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project to Export
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isExporting}
              >
                <option value="">Choose a project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.title} ({project.currentStory?.pages?.length || 0} pages)
                  </option>
                ))}
              </select>
            </div>

            {/* Export Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    exportFormat === 'package' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setExportFormat('package')}
                >
                  <div className="font-semibold">📦 Complete Package</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Zip file with all assets, templates, and instructions
                  </div>
                </div>
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    exportFormat === 'json' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setExportFormat('json')}
                >
                  <div className="font-semibold">📄 Template Only</div>
                  <div className="text-sm text-gray-600 mt-1">
                    JSON template file for manual import
                  </div>
                </div>
              </div>
            </div>

            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canva Template Type
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isExporting}
              >
                <option value="coloring-book">🎨 Coloring Book Layout</option>
                <option value="story-book">📚 Story Book Layout</option>
                <option value="activity-book">🎯 Activity Book Layout</option>
                <option value="custom">⚡ Custom Layout</option>
              </select>
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canvas Dimensions
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Width</label>
                  <input
                    type="number"
                    value={dimensions.width}
                    onChange={(e) => setDimensions(prev => ({ ...prev, width: parseFloat(e.target.value) || 8.5 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.1"
                    min="1"
                    disabled={isExporting}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Height</label>
                  <input
                    type="number"
                    value={dimensions.height}
                    onChange={(e) => setDimensions(prev => ({ ...prev, height: parseFloat(e.target.value) || 11 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.1"
                    min="1"
                    disabled={isExporting}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unit</label>
                  <select
                    value={dimensions.unit}
                    onChange={(e) => setDimensions(prev => ({ ...prev, unit: e.target.value as 'in' | 'cm' | 'px' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isExporting}
                  >
                    <option value="in">Inches</option>
                    <option value="cm">Centimeters</option>
                    <option value="px">Pixels</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Preview Info */}
            {selectedProject && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">📋 Export Preview</h3>
                {(() => {
                  const project = projects.find(p => p.id === selectedProject);
                  const pageCount = project?.currentStory?.pages?.length || 0;
                  const hasDrawings = project?.drawings && project.drawings.length > 0;
                  
                  return (
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Project: <span className="font-medium">{project?.title}</span></div>
                      <div>Pages: <span className="font-medium">{pageCount}</span></div>
                      <div>Drawings: <span className="font-medium">{hasDrawings ? 'Yes' : 'None'}</span></div>
                      <div>Template: <span className="font-medium">{template}</span></div>
                      <div>Dimensions: <span className="font-medium">{dimensions.width}" × {dimensions.height}"</span></div>
                      <div>Format: <span className="font-medium">{exportFormat === 'package' ? 'Complete Package' : 'Template Only'}</span></div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Export Instructions */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">📝 How to Use in Canva</h3>
              <div className="text-sm text-yellow-700 space-y-1">
                <div>1. Download the export package from ColorBook Engine</div>
                <div>2. Extract the zip file to access all assets</div>
                <div>3. Create a new design in Canva with the specified dimensions</div>
                <div>4. Upload images from the package to Canva's media library</div>
                <div>5. Copy text content and arrange according to the layout guide</div>
                <div>6. Customize colors, fonts, and styling in Canva</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleExport}
                disabled={!selectedProject || isExporting}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    🚀 Export to Canva
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                disabled={isExporting}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvaExport;