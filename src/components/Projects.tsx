import React, { useState } from 'react';
import {
  Plus,
  FolderOpen,
  BookOpen,
  MoreHorizontal,
  Copy,
  Trash2,
  Calendar
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../utils/helpers';
import { Project } from '../types';

const Projects: React.FC = () => {
  const { 
    projects, 
    createProject, 
    deleteProject, 
    duplicateProject,
    setCurrentProject,
    setCurrentSection,
    addNotification 
  } = useAppStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    description: ''
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProject.title.trim()) {
      addNotification({
        type: 'warning',
        message: 'Please enter a project title'
      });
      return;
    }

    const project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
      title: newProject.title.trim(),
      description: newProject.description.trim(),
      pages: [],
      metadata: {}
    };

    createProject(project);
    setNewProject({ title: '', description: '' });
    setShowCreateModal(false);
  };

  const handleDeleteProject = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      deleteProject(id);
    }
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    setCurrentSection('story-generator');
    addNotification({
      type: 'success',
      message: `Opened project: ${project.title}`
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📁 Project Manager</h1>
          <p className="text-gray-600 mt-2">Organize and manage your coloring book projects</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Create New Project
        </button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-400 mb-6">
            <FolderOpen size={64} className="mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-600 mb-6">Create your first project to get started with ColorBook Engine</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard 
              key={project.id}
              project={project}
              onOpen={handleOpenProject}
              onDuplicate={duplicateProject}
              onDelete={handleDeleteProject}
            />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                  className="form-input"
                  placeholder="My Amazing Coloring Book"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="form-input h-20 resize-none"
                  placeholder="Optional description of your project"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface ProjectCardProps {
  project: Project;
  onOpen: (project: Project) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  onOpen, 
  onDuplicate, 
  onDelete 
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const storyPages = project.pages.filter(p => p.type === 'story').length;
  const coloringPages = project.pages.filter(p => p.type === 'coloring').length;

  return (
    <div className="project-card bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
              {project.title}
            </h3>
            {project.description && (
              <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                {project.description}
              </p>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreHorizontal size={20} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-32 z-10">
                <button
                  onClick={() => {
                    onDuplicate(project.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                >
                  <Copy size={16} />
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    onDelete(project.id, project.title);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-red-600"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Project Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <BookOpen size={16} />
            <span>{project.pages.length} pages</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={16} />
            <span>{formatDate(project.createdAt)}</span>
          </div>
        </div>

        {/* Page Type Breakdown */}
        <div className="flex gap-2 mb-6">
          {storyPages > 0 && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
              {storyPages} stories
            </span>
          )}
          {coloringPages > 0 && (
            <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
              {coloringPages} coloring
            </span>
          )}
          {project.pages.length === 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">
              Empty project
            </span>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={() => onOpen(project)}
          className="w-full btn-primary"
        >
          Open Project
        </button>
      </div>
    </div>
  );
};

export default Projects;
