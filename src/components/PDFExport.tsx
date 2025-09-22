import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useExportAgent } from '../hooks/useExportAgent';
import { FileText, Download, Settings, AlertTriangle, Ruler, Palette, Clock, CheckCircle, XCircle } from 'lucide-react';
import CanvaExport from './CanvaExport';

// Core interfaces for PDF export
interface PDFSettings {
  pageSize: 'letter' | 'a4' | 'square-8.5' | 'square-6';
  margins: { inner: number; outer: number; top: number; bottom: number; };
  bleed: number;
  includeStoryPages: boolean;
  includeColoringPages: boolean;
  includeCover: boolean;
  includeBackMatter: boolean;
  resolution: 150 | 300 | 600;
  flatten: boolean;
}

interface PreviewPage {
  type: 'cover' | 'story' | 'coloring' | 'back' | 'copyright';
  content?: any;
  pageNumber: number;
}

interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  fix?: string;
}

const PDFExport: React.FC = () => {
  const { projects, addNotification } = useAppStore();
  const exportAgent = useExportAgent();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [previewPages, setPreviewPages] = useState<PreviewPage[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showCanvaExport, setShowCanvaExport] = useState(false);
  const [activeExports, setActiveExports] = useState<{[key: string]: any}>({});

  // PDF settings with professional defaults
  const [settings, setSettings] = useState<PDFSettings>({
    pageSize: 'letter',
    margins: { inner: 0.75, outer: 0.5, top: 0.75, bottom: 0.75 },
    bleed: 0.125, // Standard KDP bleed
    includeStoryPages: true,
    includeColoringPages: true,
    includeCover: false,
    includeBackMatter: false,
    resolution: 300, // Print quality
    flatten: true
  });

  // Page size specifications  
  const pageSizes = {
    letter: { width: 8.5, height: 11, name: '8.5" × 11" (Letter)' },
    a4: { width: 8.27, height: 11.69, name: '8.27" × 11.69" (A4)' },
    'square-8.5': { width: 8.5, height: 8.5, name: '8.5" × 8.5" (Square)' },
    'square-6': { width: 6, height: 6, name: '6" × 6" (Small Square)' }
  };

  // Validation logic
  const validateSettings = (): ValidationError[] => {
    const errors: ValidationError[] = [];
    const project = projects.find(p => p.id === selectedProject);

    if (!project) {
      errors.push({ type: 'error', message: 'No project selected', fix: 'Select a project to export' });
      return errors;
    }

    const storyPages = project.pages?.length || 0;
    const totalPages = (settings.includeStoryPages ? storyPages : 0) + 
                      (settings.includeColoringPages ? storyPages : 0) +
                      (settings.includeCover ? 1 : 0) +
                      (settings.includeBackMatter ? 2 : 0);

    if (totalPages < 24) {
      errors.push({
        type: 'error',
        message: `Only ${totalPages} pages. KDP requires minimum 24 pages.`,
        fix: 'Add more content or enable additional sections'
      });
    }

    if (settings.bleed < 0.125) {
      errors.push({
        type: 'warning',
        message: 'Bleed less than 0.125" may cause printing issues',
        fix: 'Set bleed to 0.125" or higher for professional printing'
      });
    }

    if (settings.margins.inner < 0.75) {
      errors.push({
        type: 'warning',
        message: 'Inner margin less than 0.75" may be cut off during binding',
        fix: 'Increase inner margin to 0.75" or more'
      });
    }

    return errors;
  };

  // Preview generation
  const generatePreviewPages = () => {
    const project = projects.find(p => p.id === selectedProject);
    if (!project) { setPreviewPages([]); return; }

    const pages: PreviewPage[] = [];
    let pageNumber = 1;

    if (settings.includeCover) {
      pages.push({
        type: 'cover', pageNumber: pageNumber++,
        content: { title: project.title, author: project.metadata?.author }
      });
    }

    if (settings.includeBackMatter) {
      pages.push({
        type: 'copyright', pageNumber: pageNumber++,
        content: { title: project.title, author: project.metadata?.author, year: new Date().getFullYear() }
      });
    }

    if (project.pages) {
      project.pages.forEach((storyPage) => {
        if (settings.includeStoryPages) {
          pages.push({ type: 'story', pageNumber: pageNumber++, content: storyPage });
        }
        if (settings.includeColoringPages) {
          pages.push({ type: 'coloring', pageNumber: pageNumber++, content: storyPage });
        }
      });
    }

    if (settings.includeBackMatter) {
      pages.push({ type: 'back', pageNumber: pageNumber++, content: { title: 'Notes' } });
    }

    setPreviewPages(pages);
  };

  // Calculate dimensions
  const calculateDimensions = () => {
    const pageSpec = pageSizes[settings.pageSize];
    const { width, height } = pageSpec;
    const bleed = settings.bleed;
    
    return {
      width, height,
      bleedWidth: width + (bleed * 2),
      bleedHeight: height + (bleed * 2),
      safeWidth: width - (settings.margins.inner + settings.margins.outer + 0.5),
      safeHeight: height - (settings.margins.top + settings.margins.bottom + 0.5)
    };
  };

  const updateSettings = (updates: Partial<PDFSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    if (projects.length === 1) setSelectedProject(projects[0].id);
  }, [projects]);

  useEffect(() => {
    const errors = validateSettings();
    setValidationErrors(errors);
    generatePreviewPages();
  }, [selectedProject, settings, projects]);

  const dimensions = calculateDimensions();

  // Enhanced PDF generation using Export Agent
  const generatePDF = async () => {
    const project = projects.find(p => p.id === selectedProject);
    if (!project || validationErrors.some(e => e.type === 'error')) {
      addNotification({
        type: 'error',
        message: 'Please fix validation errors before exporting'
      });
      return;
    }

    try {
      // Submit export job through the agent
      const jobId = await exportAgent.submitExport(selectedProject, 'PDF', {
        settings: {
          pdfSettings: settings,
          dimensions: dimensions
        },
        priority: 'normal'
      });

      // Track the export job
      setActiveExports(prev => ({
        ...prev,
        [jobId]: { format: 'PDF', progress: 0, status: 'pending' }
      }));

      // Subscribe to progress updates
      exportAgent.subscribeToJob(
        jobId,
        (progress) => {
          setActiveExports(prev => ({
            ...prev,
            [jobId]: {
              ...prev[jobId],
              progress: progress.progress,
              status: progress.status,
              currentStep: progress.currentStep
            }
          }));
        },
        (completedJob) => {
          if (completedJob.status === 'completed' && completedJob.result?.downloadUrl) {
            // Auto-download the file
            const link = document.createElement('a');
            link.href = completedJob.result.downloadUrl;
            const timestamp = new Date().toISOString().slice(0, 10);
            link.download = `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_Professional_${timestamp}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          
          // Remove from active exports
          setActiveExports(prev => {
            const updated = { ...prev };
            delete updated[jobId];
            return updated;
          });
        }
      );

    } catch (error) {
      console.error('Export submission error:', error);
      addNotification({
        type: 'error',
        message: '❌ Failed to start export. Please try again.'
      });
    }
  };

  // Generate using multiple formats via Export Agent
  const generateMultipleFormats = async () => {
    const project = projects.find(p => p.id === selectedProject);
    if (!project || validationErrors.some(e => e.type === 'error')) {
      addNotification({
        type: 'error',
        message: 'Please fix validation errors before exporting'
      });
      return;
    }

    try {
      const jobId = await exportAgent.submitExport(selectedProject, 'All-Formats', {
        settings: {
          pdfSettings: settings,
          dimensions: dimensions
        },
        priority: 'high'
      });

      setActiveExports(prev => ({
        ...prev,
        [jobId]: { format: 'All-Formats', progress: 0, status: 'pending' }
      }));

      exportAgent.subscribeToJob(
        jobId,
        (progress) => {
          setActiveExports(prev => ({
            ...prev,
            [jobId]: {
              ...prev[jobId],
              progress: progress.progress,
              status: progress.status,
              currentStep: progress.currentStep
            }
          }));
        },
        () => {
          setActiveExports(prev => {
            const updated = { ...prev };
            delete updated[jobId];
            return updated;
          });
        }
      );

    } catch (error) {
      console.error('Multi-format export error:', error);
      addNotification({
        type: 'error',
        message: '❌ Failed to start multi-format export. Please try again.'
      });
    }
  };

  // Legacy PDF generation functions (now handled by Export Agent)
  /*
  const addPageContent = (pdf: jsPDF, page: PreviewPage) => {
    const safeX = settings.bleed + settings.margins.inner;
    const safeY = settings.bleed + settings.margins.top;
    const safeWidth = dimensions.safeWidth;
    const safeHeight = dimensions.safeHeight;

    pdf.setTextColor(0, 0, 0);

    switch (page.type) {
      case 'cover':
        pdf.setFontSize(28);
        pdf.setFont('helvetica', 'bold');
        const titleLines = pdf.splitTextToSize(page.content?.title || 'Untitled', safeWidth);
        pdf.text(titleLines, safeX + safeWidth / 2, safeY + safeHeight / 3, { align: 'center' });

        if (page.content?.author) {
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`By ${page.content.author}`, safeX + safeWidth / 2, safeY + safeHeight / 2, { align: 'center' });
        }
        break;

      case 'copyright':
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const copyrightText = [
          `© ${page.content?.year || new Date().getFullYear()} ${page.content?.author || 'Author'}`,
          '',
          'All rights reserved. No part of this publication may be reproduced,',
          'distributed, or transmitted in any form or by any means, including',
          'photocopying, recording, or other electronic or mechanical methods,',
          'without the prior written permission of the publisher.',
          '',
          'Created with ColorBook Engine'
        ];
        copyrightText.forEach((line, index) => {
          pdf.text(line, safeX, safeY + (index * 0.15));
        });
        break;

      case 'story':
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Chapter ${page.content?.pageNumber || page.pageNumber}`, safeX, safeY + 0.4);

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        const storyLines = pdf.splitTextToSize(page.content?.text || 'Story content here...', safeWidth);
        pdf.text(storyLines, safeX, safeY + 0.8);
        break;

      case 'coloring':
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.02);
        pdf.rect(safeX + 0.5, safeY + 0.5, safeWidth - 1, safeHeight - 1);
        
        pdf.setFontSize(12);
        pdf.setTextColor(150, 150, 150);
        pdf.text('🎨 Coloring Page', safeX + safeWidth / 2, safeY + safeHeight / 2, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
        break;

      case 'back':
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Notes', safeX, safeY + 0.4);

        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.005);
        for (let i = 1; i < 25; i++) {
          const y = safeY + 0.8 + (i * 0.25);
          if (y < safeY + safeHeight - 0.3) {
            pdf.line(safeX, y, safeX + safeWidth, y);
          }
        }
        break;
    }

    if (page.type !== 'cover') {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        page.pageNumber.toString(),
        safeX + safeWidth / 2,
        dimensions.height + settings.bleed - 0.25,
        { align: 'center' }
      );
    }
  };

  const addCropMarks = (pdf: jsPDF) => {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.01);

    const markLength = 0.125;
    const markOffset = 0.05;

    // Top-left
    pdf.line(0, settings.bleed - markOffset, markLength, settings.bleed - markOffset);
    pdf.line(settings.bleed - markOffset, 0, settings.bleed - markOffset, markLength);
    
    // Top-right  
    pdf.line(dimensions.bleedWidth - markLength, settings.bleed - markOffset, dimensions.bleedWidth, settings.bleed - markOffset);
    pdf.line(dimensions.width + settings.bleed + markOffset, 0, dimensions.width + settings.bleed + markOffset, markLength);
    
    // Bottom-left
    pdf.line(0, dimensions.height + settings.bleed + markOffset, markLength, dimensions.height + settings.bleed + markOffset);
    pdf.line(settings.bleed - markOffset, dimensions.bleedHeight - markLength, settings.bleed - markOffset, dimensions.bleedHeight);
    
    // Bottom-right
    pdf.line(dimensions.bleedWidth - markLength, dimensions.height + settings.bleed + markOffset, dimensions.bleedWidth, dimensions.height + settings.bleed + markOffset);
    pdf.line(dimensions.width + settings.bleed + markOffset, dimensions.bleedHeight - markLength, dimensions.width + settings.bleed + markOffset, dimensions.bleedHeight);
  };
  */

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <FileText size={32} className="text-red-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📄 Professional PDF Export</h1>
          <p className="text-gray-600">Export print-ready PDFs with bleed, margins, and KDP compliance</p>
        </div>
      </div>

      {/* Export Options */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Settings size={20} />
            Quick Export
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Page Size</label>
              <select
                value={settings.pageSize}
                onChange={(e) => updateSettings({ pageSize: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(pageSizes).map(([key, spec]) => (
                  <option key={key} value={key}>
                    {spec.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Include</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.includeStoryPages}
                    onChange={(e) => updateSettings({ includeStoryPages: e.target.checked })}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm">📖 Story pages</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.includeColoringPages}
                    onChange={(e) => updateSettings({ includeColoringPages: e.target.checked })}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm">🎨 Coloring pages</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.includeCover}
                    onChange={(e) => updateSettings({ includeCover: e.target.checked })}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm">📚 Cover</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.includeBackMatter}
                    onChange={(e) => updateSettings({ includeBackMatter: e.target.checked })}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm">📄 Copyright & Notes</span>
                </label>
              </div>
            </div>

            {/* Export Progress Indicator */}
            {Object.keys(activeExports).length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Clock size={16} />
                  Active Exports
                </h4>
                {Object.entries(activeExports).map(([jobId, job]) => (
                  <div key={jobId} className="mb-2 last:mb-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-800">{job.format} Export</span>
                      <div className="flex items-center gap-2">
                        {job.status === 'processing' && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
                        {job.status === 'completed' && <CheckCircle size={16} className="text-green-600" />}
                        {job.status === 'failed' && <XCircle size={16} className="text-red-600" />}
                        <span>{job.progress}%</span>
                      </div>
                    </div>
                    {job.currentStep && (
                      <div className="text-xs text-blue-600 mt-1">{job.currentStep}</div>
                    )}
                    <div className="mt-1 w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Export Buttons */}
            <div className="space-y-3">
              <button
                onClick={generatePDF}
                disabled={!selectedProject || validationErrors.some(e => e.type === 'error') || Object.keys(activeExports).length > 0}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
              >
                <Download size={20} />
                Export PDF (Agent)
              </button>

              <button
                onClick={generateMultipleFormats}
                disabled={!selectedProject || validationErrors.some(e => e.type === 'error') || Object.keys(activeExports).length > 0}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
              >
                <FileText size={20} />
                Export All Formats
              </button>

              {/* NEW: Canva Export Button */}
              <button
                onClick={() => setShowCanvaExport(true)}
                disabled={!selectedProject}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
              >
                <Palette size={20} />
                Export to Canva
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Ruler size={16} />
            Specifications
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>📏 {dimensions.width}" × {dimensions.height}"</div>
            <div>🔲 Bleed: {dimensions.bleedWidth.toFixed(2)}" × {dimensions.bleedHeight.toFixed(2)}"</div>
            <div>✅ Safe: {dimensions.safeWidth.toFixed(2)}" × {dimensions.safeHeight.toFixed(2)}"</div>
            <div>🎯 {settings.resolution} DPI</div>
            <div>📐 Bleed: {settings.bleed}"</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle size={16} />
            Status
          </h3>
          {validationErrors.length === 0 ? (
            <div className="text-green-600 text-sm">✅ Ready to export</div>
          ) : (
            <div className="space-y-1">
              {validationErrors.slice(0, 3).map((error, i) => (
                <div key={i} className={`text-xs ${error.type === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>
                  {error.message}
                </div>
              ))}
            </div>
          )}
          <div className="text-sm text-gray-600 mt-2">
            📄 {previewPages.length} pages ready
          </div>
        </div>
      </div>

      {/* Export Options Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-purple-900 mb-3">🎨 Export Options Available</h3>
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div className="bg-white/70 p-3 rounded">
            <h4 className="font-medium text-red-700 mb-2">📄 PDF Export:</h4>
            <ul className="space-y-1 text-xs text-red-600">
              <li>• Print-ready with bleed & crop marks</li>
              <li>• KDP compliant formatting</li>
              <li>• Professional typography</li>
              <li>• Multiple page sizes available</li>
            </ul>
          </div>
          <div className="bg-white/70 p-3 rounded">
            <h4 className="font-medium text-purple-700 mb-2">🎨 Canva Export:</h4>
            <ul className="space-y-1 text-xs text-purple-600">
              <li>• Editable templates for customization</li>
              <li>• Complete asset package with images</li>
              <li>• Easy-to-follow import instructions</li>
              <li>• Perfect for design collaboration</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-900 mb-3">🎉 Professional Export Suite - COMPLETE!</h3>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div className="bg-white/70 p-3 rounded">
            <h4 className="font-medium text-green-700 mb-2">✅ PDF Export:</h4>
            <ul className="space-y-1 text-xs text-green-600">
              <li>• Professional print-ready output</li>
              <li>• KDP compliance validation</li>
              <li>• Bleed and crop marks</li>
              <li>• Multiple format support</li>
            </ul>
          </div>
          <div className="bg-white/70 p-3 rounded">
            <h4 className="font-medium text-purple-700 mb-2">🎨 Canva Integration:</h4>
            <ul className="space-y-1 text-xs text-purple-600">
              <li>• Complete design packages</li>
              <li>• Template import system</li>
              <li>• Asset organization</li>
              <li>• Design collaboration ready</li>
            </ul>
          </div>
          <div className="bg-white/70 p-3 rounded">
            <h4 className="font-medium text-blue-700 mb-2">📚 Publishing Ready:</h4>
            <ul className="space-y-1 text-xs text-blue-600">
              <li>• Amazon KDP compatible</li>
              <li>• Professional specifications</li>
              <li>• Multiple export formats</li>
              <li>• Commercial print ready</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 text-center">
          <span className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium">
            🚀 Complete Export Suite Ready!
          </span>
        </div>
      </div>

      {/* Canva Export Modal */}
      <CanvaExport 
        isOpen={showCanvaExport}
        onClose={() => setShowCanvaExport(false)}
        projectId={selectedProject}
      />
    </div>
  );
};

export default PDFExport;