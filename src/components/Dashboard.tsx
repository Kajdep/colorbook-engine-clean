import React from 'react';
import { 
  BookOpen, 
  Palette, 
  FileText, 
  FolderOpen, 
  CheckCircle, 
  Settings,
  TrendingUp,
  Users,
  Clock,
  Database,
  HardDrive,
  Cloud,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../utils/helpers';

interface DashboardProps {
  onOpenStorage: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onOpenStorage }) => {
  const { 
    projects, 
    setCurrentSection, 
    storageStats, 
    syncStatus 
  } = useAppStore();

  const recentProjects = projects
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  const stats = {
    totalProjects: projects.length,
    totalPages: projects.reduce((sum, project) => sum + project.pages.length, 0),
    recentActivity: projects.filter(p => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(p.updatedAt) > weekAgo;
    }).length
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const featureCards = [
    {
      title: 'AI Story Generator',
      description: 'Create engaging stories with detailed image prompts for coloring pages',
      icon: BookOpen,
      color: 'from-blue-500 to-purple-600',
      action: () => setCurrentSection('story')
    },
    {
      title: 'Digital Canvas',
      description: 'Draw and create custom coloring pages with professional tools',
      icon: Palette,
      color: 'from-green-500 to-blue-600',
      action: () => setCurrentSection('canvas')
    },
    {
      title: 'PDF Export',
      description: 'Export print-ready PDFs with professional formatting',
      icon: FileText,
      color: 'from-purple-500 to-pink-600',
      action: () => setCurrentSection('pdf')
    },
    {
      title: 'Project Manager',
      description: 'Organize and manage your coloring book projects',
      icon: FolderOpen,
      color: 'from-yellow-500 to-orange-600',
      action: () => setCurrentSection('projects')
    },
    {
      title: 'KDP Compliance',
      description: 'Ensure your books meet Amazon KDP publishing standards',
      icon: CheckCircle,
      color: 'from-red-500 to-pink-600',
      action: () => setCurrentSection('kdp')
    },
    {
      title: 'AI Configuration',
      description: 'Configure OpenRouter API for story and image generation',
      icon: Settings,
      color: 'from-gray-500 to-gray-700',
      action: () => setCurrentSection('settings')
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="gradient-bg text-white rounded-xl p-8 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Welcome to ColorBook Engine</h1>
            <p className="text-xl opacity-90">Create professional coloring books with AI-powered stories and images</p>
          </div>
          <div className="text-6xl">🎨</div>
        </div>
      </div>

      {/* Stats and Storage */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalProjects}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FolderOpen className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pages</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPages}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <FileText className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active This Week</p>
              <p className="text-3xl font-bold text-gray-900">{stats.recentActivity}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <TrendingUp className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        {/* Storage Status Card */}
        <div 
          className="bg-white rounded-lg p-6 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
          onClick={onOpenStorage}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Storage</p>
              <p className="text-2xl font-bold text-gray-900">{formatBytes(storageStats.totalSize)}</p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-full">
              <Database className="text-indigo-600" size={24} />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              {syncStatus.isOnline ? (
                <>
                  <Wifi className="text-green-500" size={12} />
                  <span className="text-green-600">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="text-red-500" size={12} />
                  <span className="text-red-600">Offline</span>
                </>
              )}
            </div>
            {syncStatus.queueSize > 0 && (
              <span className="text-orange-600">{syncStatus.queueSize} pending</span>
            )}
          </div>
        </div>
      </div>

      {/* Storage Quick Info */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 mb-8 border border-indigo-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-full">
              <HardDrive className="text-indigo-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Persistent Storage Active</h3>
              <p className="text-sm text-gray-600">
                {storageStats.projects} projects, {storageStats.images} images, {storageStats.stories} stories stored locally
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="text-gray-600">Sync Status</div>
              <div className={`font-medium ${syncStatus.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {syncStatus.syncInProgress ? 'Syncing...' : syncStatus.isOnline ? 'Ready' : 'Offline'}
              </div>
            </div>
            <button
              onClick={onOpenStorage}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Settings size={16} />
              Manage
            </button>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {featureCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              onClick={card.action}
              className={`feature-card bg-gradient-to-br ${card.color} text-white p-6 rounded-xl cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-xl`}
            >
              <div className="flex items-center justify-between mb-4">
                <Icon size={32} />
                <div className="opacity-80">→</div>
              </div>
              <h3 className="text-xl font-bold mb-2">{card.title}</h3>
              <p className="opacity-90 text-sm">{card.description}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Projects</h2>
          <button
            onClick={() => setCurrentSection('projects')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            View All →
          </button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FolderOpen size={48} className="mx-auto" />
            </div>
            <p className="text-gray-500 mb-4">No projects yet. Create your first project to get started!</p>
            <button
              onClick={() => setCurrentSection('projects')}
              className="btn-primary"
            >
              Create New Project
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setCurrentSection('projects')}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <BookOpen className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{project.title}</h3>
                    <p className="text-sm text-gray-500">
                      {project.pages.length} pages • Updated {formatDate(project.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {project.pages.filter(p => p.type === 'story').length} stories
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                    {project.pages.filter(p => p.type === 'coloring').length} coloring
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Getting Started */}
      {projects.length === 0 && (
        <div className="mt-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-8 border-2 border-dashed border-blue-200">
          <div className="text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Create Your First Coloring Book?</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Get started by creating a new project, generating an AI story with image prompts, 
              or jumping straight into the drawing canvas to create custom coloring pages.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => setCurrentSection('projects')}
                className="btn-primary"
              >
                Create New Project
              </button>
              <button
                onClick={() => setCurrentSection('story')}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors duration-200"
              >
                Generate AI Story
              </button>
              <button
                onClick={() => setCurrentSection('canvas')}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors duration-200"
              >
                Start Drawing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storage Tips */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="bg-yellow-100 p-2 rounded-full">
            <Database className="text-yellow-600" size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-yellow-800 mb-2">💡 Storage Tips</h4>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>• Your projects are automatically saved to your browser's storage and never lost</p>
              <p>• Export backups regularly to protect your work</p>
              <p>• Use Ctrl+S to quickly access storage management</p>
              <p>• Sync status shows your connection and pending uploads</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;