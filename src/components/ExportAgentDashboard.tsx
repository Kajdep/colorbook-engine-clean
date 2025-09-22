/**
 * Export Agent Dashboard - Demonstrates the Export Agent functionality
 * Shows active jobs, statistics, and allows testing different export formats
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useExportAgent } from '../hooks/useExportAgent';
import { 
  FileText, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  Trash2,
  BarChart3,
  Play,
  Package
} from 'lucide-react';
import { ExportFormat } from '../utils/exportAgent';

const ExportAgentDashboard: React.FC = () => {
  const { projects, addNotification } = useAppStore();
  const exportAgent = useExportAgent();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('PDF');

  // Get statistics and jobs
  const stats = exportAgent.getStats();
  const allJobs = exportAgent.getAllJobs();
  const projectJobs = selectedProject ? exportAgent.getProjectJobs(selectedProject) : [];

  useEffect(() => {
    if (projects.length === 1) {
      setSelectedProject(projects[0].id);
    }
  }, [projects]);

  const handleStartExport = async () => {
    if (!selectedProject) {
      addNotification({
        type: 'error',
        message: 'Please select a project first'
      });
      return;
    }

    try {
      await exportAgent.submitExport(selectedProject, selectedFormat, {
        priority: 'normal',
        settings: {
          timestamp: new Date().toISOString()
        }
      });
      
      addNotification({
        type: 'success',
        message: `${selectedFormat} export started for project`
      });
    } catch (error) {
      console.error('Export start error:', error);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await exportAgent.cancelExport(jobId);
      addNotification({
        type: 'info',
        message: 'Export job cancelled'
      });
    } catch (error) {
      console.error('Cancel error:', error);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const newJobId = await exportAgent.retryJob(jobId);
      if (newJobId) {
        addNotification({
          type: 'success',
          message: 'Export job restarted'
        });
      }
    } catch (error) {
      console.error('Retry error:', error);
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'pending': return { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' };
      case 'processing': return { icon: Download, color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'completed': return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' };
      case 'failed': return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' };
      case 'cancelled': return { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-50' };
      default: return { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

  const formatDuration = (start: Date, end?: Date) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = endTime - startTime;
    
    if (duration < 1000) return '<1s';
    if (duration < 60000) return `${Math.floor(duration / 1000)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <Package size={32} className="text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🤖 Export Agent Dashboard</h1>
          <p className="text-gray-600">Automated export workflows for multiple formats</p>
        </div>
      </div>

      {/* Statistics Card */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-600" />
            <h3 className="font-semibold">Total Jobs</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.totalJobs}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-2">
            <Download size={20} className="text-orange-600" />
            <h3 className="font-semibold">Active</h3>
          </div>
          <p className="text-2xl font-bold text-orange-600">{stats.activeJobs}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-yellow-600" />
            <h3 className="font-semibold">Pending</h3>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingJobs}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-green-600" />
            <h3 className="font-semibold">Completed</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.completedJobs}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-2">
            <XCircle size={20} className="text-red-600" />
            <h3 className="font-semibold">Failed</h3>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.failedJobs}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Play size={20} />
            Start New Export
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="PDF">PDF</option>
                <option value="EPUB">EPUB</option>
                <option value="DOCX">DOCX</option>
                <option value="CBZ">CBZ</option>
                <option value="Print-Package">Print Package</option>
                <option value="All-Formats">All Formats</option>
              </select>
            </div>

            <button
              onClick={handleStartExport}
              disabled={!selectedProject}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
            >
              <Play size={20} />
              Start Export
            </button>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock size={20} />
              Active Jobs
            </h2>
            <button
              onClick={() => exportAgent.clearCompletedJobs()}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Trash2 size={16} />
              Clear Completed
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allJobs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No export jobs yet</p>
            ) : (
              allJobs.map((job) => {
                const StatusIcon = formatStatus(job.status).icon;
                const project = projects.find(p => p.id === job.projectId);
                
                return (
                  <div key={job.id} className={`p-3 rounded-lg border ${formatStatus(job.status).bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon size={16} className={formatStatus(job.status).color} />
                        <span className="font-medium">{job.format}</span>
                      </div>
                      <div className="flex gap-2">
                        {job.status === 'failed' && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Retry"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        {(job.status === 'pending' || job.status === 'processing') && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Cancel"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <div>Project: {project?.title || 'Unknown'}</div>
                      <div>Status: {job.status}</div>
                      <div>Progress: {job.progress}%</div>
                      <div>Duration: {formatDuration(job.createdAt, job.completedAt)}</div>
                      {job.error && (
                        <div className="text-red-600 mt-1">Error: {job.error}</div>
                      )}
                    </div>

                    {job.status === 'processing' && (
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    )}

                    {job.status === 'completed' && job.result?.downloadUrl && (
                      <a
                        href={job.result.downloadUrl}
                        download
                        className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 text-sm mt-2"
                      >
                        <Download size={14} />
                        Download
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Project Jobs */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText size={20} />
            Project History
          </h2>

          {selectedProject ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {projectJobs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No exports for this project</p>
              ) : (
                projectJobs.map((job) => {
                  const StatusIcon = formatStatus(job.status).icon;
                  
                  return (
                    <div key={job.id} className={`p-3 rounded-lg border ${formatStatus(job.status).bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <StatusIcon size={16} className={formatStatus(job.status).color} />
                          <span className="font-medium">{job.format}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <div>Status: {job.status}</div>
                        <div>Progress: {job.progress}%</div>
                        {job.error && (
                          <div className="text-red-600 mt-1">Error: {job.error}</div>
                        )}
                      </div>

                      {job.status === 'completed' && job.result?.downloadUrl && (
                        <a
                          href={job.result.downloadUrl}
                          download
                          className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 text-sm mt-2"
                        >
                          <Download size={14} />
                          Download
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Select a project to view export history</p>
          )}
        </div>
      </div>

      {/* Success Rate Indicator */}
      {stats.totalJobs > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Export Success Rate</span>
            <span className="text-lg font-bold">{stats.successRate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
            <div 
              className="bg-green-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${stats.successRate}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportAgentDashboard;