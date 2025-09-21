import React, { useState } from 'react';
import { 
  BookOpen, 
  Users, 
  MapPin, 
  Target, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface PlotPoint {
  id: string;
  title: string;
  description: string;
  type: 'setup' | 'conflict' | 'climax' | 'resolution';
  pageNumber?: number;
}

interface Character {
  id: string;
  name: string;
  description: string;
  role: 'protagonist' | 'antagonist' | 'supporting';
  traits: string[];
}

interface PlotOutline {
  id: string;
  title: string;
  summary: string;
  target_age: string;
  genre: string;
  theme: string;
  plotPoints: PlotPoint[];
  characters: Character[];
  totalPages: number;
  createdAt: string;
  updatedAt: string;
}

const Plot: React.FC = () => {
  const { 
    currentProject, 
    addNotification,
    setCurrentSection
  } = useAppStore();

  const [currentOutline, setCurrentOutline] = useState<PlotOutline | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'plotpoints' | 'structure'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [newCharacter, setNewCharacter] = useState<Partial<Character>>({});
  const [newPlotPoint, setNewPlotPoint] = useState<Partial<PlotPoint>>({});

  // Initialize a new outline
  const createNewOutline = () => {
    const newOutline: PlotOutline = {
      id: Math.random().toString(36).substr(2, 9),
      title: `${currentProject?.title || 'New'} Plot Outline`,
      summary: '',
      target_age: '4-8',
      genre: 'Adventure',
      theme: '',
      plotPoints: [],
      characters: [],
      totalPages: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCurrentOutline(newOutline);
    setIsEditing(true);
  };

  const saveOutline = () => {
    if (!currentOutline) return;
    
    // Update timestamp
    setCurrentOutline({
      ...currentOutline,
      updatedAt: new Date().toISOString()
    });
    
    setIsEditing(false);
    addNotification({
      type: 'success',
      message: 'Plot outline saved successfully!'
    });
  };

  const addCharacter = () => {
    if (!currentOutline || !newCharacter.name) return;

    const character: Character = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCharacter.name,
      description: newCharacter.description || '',
      role: newCharacter.role || 'supporting',
      traits: []
    };

    setCurrentOutline({
      ...currentOutline,
      characters: [...currentOutline.characters, character],
      updatedAt: new Date().toISOString()
    });

    setNewCharacter({});
  };

  const addPlotPoint = () => {
    if (!currentOutline || !newPlotPoint.title) return;

    const plotPoint: PlotPoint = {
      id: Math.random().toString(36).substr(2, 9),
      title: newPlotPoint.title,
      description: newPlotPoint.description || '',
      type: newPlotPoint.type || 'setup',
      pageNumber: newPlotPoint.pageNumber
    };

    setCurrentOutline({
      ...currentOutline,
      plotPoints: [...currentOutline.plotPoints, plotPoint],
      updatedAt: new Date().toISOString()
    });

    setNewPlotPoint({});
  };

  const removeCharacter = (id: string) => {
    if (!currentOutline) return;
    setCurrentOutline({
      ...currentOutline,
      characters: currentOutline.characters.filter(c => c.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  const removePlotPoint = (id: string) => {
    if (!currentOutline) return;
    setCurrentOutline({
      ...currentOutline,
      plotPoints: currentOutline.plotPoints.filter(p => p.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  const generateStoryFromPlot = () => {
    if (!currentOutline) return;
    
    addNotification({
      type: 'info',
      message: 'Transferring plot to Story Generator...'
    });
    
    // Switch to story generator with plot data
    setCurrentSection('story-generator');
  };

  if (!currentProject) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-600 mb-2">No Project Selected</h2>
          <p className="text-gray-500 mb-6">Please select or create a project to start plotting your story.</p>
          <button
            onClick={() => setCurrentSection('projects')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Story Plot</h1>
              <p className="text-gray-600">Plan and structure your story before writing</p>
            </div>
          </div>
          <div className="flex gap-2">
            {currentOutline && (
              <>
                <button
                  onClick={isEditing ? saveOutline : () => setIsEditing(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  {isEditing ? <Save size={16} /> : <Edit size={16} />}
                  {isEditing ? 'Save' : 'Edit'}
                </button>
                <button
                  onClick={generateStoryFromPlot}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  Generate Story
                </button>
              </>
            )}
            {!currentOutline && (
              <button
                onClick={createNewOutline}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                Create Outline
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {currentOutline ? (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <div className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Eye },
                { id: 'characters', label: 'Characters', icon: Users },
                { id: 'plotpoints', label: 'Plot Points', icon: Target },
                { id: 'structure', label: 'Structure', icon: MapPin }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={currentOutline.title}
                    onChange={(e) => isEditing && setCurrentOutline({
                      ...currentOutline,
                      title: e.target.value,
                      updatedAt: new Date().toISOString()
                    })}
                    disabled={!isEditing}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                  <select
                    value={currentOutline.genre}
                    onChange={(e) => isEditing && setCurrentOutline({
                      ...currentOutline,
                      genre: e.target.value,
                      updatedAt: new Date().toISOString()
                    })}
                    disabled={!isEditing}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="Adventure">Adventure</option>
                    <option value="Fantasy">Fantasy</option>
                    <option value="Friendship">Friendship</option>
                    <option value="Educational">Educational</option>
                    <option value="Mystery">Mystery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Age</label>
                  <select
                    value={currentOutline.target_age}
                    onChange={(e) => isEditing && setCurrentOutline({
                      ...currentOutline,
                      target_age: e.target.value,
                      updatedAt: new Date().toISOString()
                    })}
                    disabled={!isEditing}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="3-5">Ages 3-5</option>
                    <option value="4-8">Ages 4-8</option>
                    <option value="6-10">Ages 6-10</option>
                    <option value="8-12">Ages 8-12</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Pages</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={currentOutline.totalPages}
                    onChange={(e) => isEditing && setCurrentOutline({
                      ...currentOutline,
                      totalPages: parseInt(e.target.value) || 5,
                      updatedAt: new Date().toISOString()
                    })}
                    disabled={!isEditing}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme/Moral</label>
                  <textarea
                    value={currentOutline.theme}
                    onChange={(e) => isEditing && setCurrentOutline({
                      ...currentOutline,
                      theme: e.target.value,
                      updatedAt: new Date().toISOString()
                    })}
                    disabled={!isEditing}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="What lesson or theme does your story convey?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
                  <textarea
                    value={currentOutline.summary}
                    onChange={(e) => isEditing && setCurrentOutline({
                      ...currentOutline,
                      summary: e.target.value,
                      updatedAt: new Date().toISOString()
                    })}
                    disabled={!isEditing}
                    rows={6}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Brief summary of your story..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Characters Tab */}
          {activeTab === 'characters' && (
            <div className="space-y-6">
              {/* Add New Character */}
              {isEditing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4">Add New Character</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Character name"
                      value={newCharacter.name || ''}
                      onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                      className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={newCharacter.role || 'supporting'}
                      onChange={(e) => setNewCharacter({ ...newCharacter, role: e.target.value as any })}
                      className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="protagonist">Protagonist</option>
                      <option value="antagonist">Antagonist</option>
                      <option value="supporting">Supporting</option>
                    </select>
                    <button
                      onClick={addCharacter}
                      disabled={!newCharacter.name}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                  <textarea
                    placeholder="Character description..."
                    value={newCharacter.description || ''}
                    onChange={(e) => setNewCharacter({ ...newCharacter, description: e.target.value })}
                    className="w-full mt-2 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              )}

              {/* Characters List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentOutline.characters.map((character) => (
                  <div key={character.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{character.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          character.role === 'protagonist' ? 'bg-green-100 text-green-800' :
                          character.role === 'antagonist' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {character.role}
                        </span>
                      </div>
                      {isEditing && (
                        <button
                          onClick={() => removeCharacter(character.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm">{character.description}</p>
                  </div>
                ))}
                {currentOutline.characters.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No characters added yet. {isEditing ? 'Add your first character above!' : 'Enable editing to add characters.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Plot Points Tab */}
          {activeTab === 'plotpoints' && (
            <div className="space-y-6">
              {/* Add New Plot Point */}
              {isEditing && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-purple-800 mb-4">Add New Plot Point</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                      type="text"
                      placeholder="Plot point title"
                      value={newPlotPoint.title || ''}
                      onChange={(e) => setNewPlotPoint({ ...newPlotPoint, title: e.target.value })}
                      className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                      value={newPlotPoint.type || 'setup'}
                      onChange={(e) => setNewPlotPoint({ ...newPlotPoint, type: e.target.value as any })}
                      className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="setup">Setup</option>
                      <option value="conflict">Conflict</option>
                      <option value="climax">Climax</option>
                      <option value="resolution">Resolution</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Page #"
                      value={newPlotPoint.pageNumber || ''}
                      onChange={(e) => setNewPlotPoint({ ...newPlotPoint, pageNumber: parseInt(e.target.value) || undefined })}
                      className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={addPlotPoint}
                      disabled={!newPlotPoint.title}
                      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                  <textarea
                    placeholder="Plot point description..."
                    value={newPlotPoint.description || ''}
                    onChange={(e) => setNewPlotPoint({ ...newPlotPoint, description: e.target.value })}
                    className="w-full mt-2 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={2}
                  />
                </div>
              )}

              {/* Plot Points List */}
              <div className="space-y-4">
                {currentOutline.plotPoints
                  .sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0))
                  .map((plotPoint) => (
                  <div key={plotPoint.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-gray-900">{plotPoint.title}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          plotPoint.type === 'setup' ? 'bg-blue-100 text-blue-800' :
                          plotPoint.type === 'conflict' ? 'bg-orange-100 text-orange-800' :
                          plotPoint.type === 'climax' ? 'bg-red-100 text-red-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {plotPoint.type}
                        </span>
                        {plotPoint.pageNumber && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            Page {plotPoint.pageNumber}
                          </span>
                        )}
                      </div>
                      {isEditing && (
                        <button
                          onClick={() => removePlotPoint(plotPoint.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <p className="text-gray-600">{plotPoint.description}</p>
                  </div>
                ))}
                {currentOutline.plotPoints.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No plot points added yet. {isEditing ? 'Add your first plot point above!' : 'Enable editing to add plot points.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Structure Tab */}
          {activeTab === 'structure' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Story Structure Overview</h3>
                
                {/* Visual Story Arc */}
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Story Arc</h4>
                  <div className="relative h-32 bg-gray-50 rounded-lg p-4">
                    <svg viewBox="0 0 400 80" className="w-full h-full">
                      <path
                        d="M 20 60 Q 120 60 120 40 Q 200 20 280 20 Q 320 20 380 60"
                        stroke="#8b5cf6"
                        strokeWidth="3"
                        fill="none"
                      />
                      <circle cx="20" cy="60" r="4" fill="#3b82f6" />
                      <circle cx="120" cy="40" r="4" fill="#f59e0b" />
                      <circle cx="280" cy="20" r="4" fill="#ef4444" />
                      <circle cx="380" cy="60" r="4" fill="#10b981" />
                    </svg>
                    <div className="absolute bottom-1 left-4 text-xs text-blue-600">Setup</div>
                    <div className="absolute bottom-1 left-1/4 text-xs text-amber-600">Conflict</div>
                    <div className="absolute bottom-1 right-1/4 text-xs text-red-600">Climax</div>
                    <div className="absolute bottom-1 right-4 text-xs text-green-600">Resolution</div>
                  </div>
                </div>

                {/* Page Breakdown */}
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Page Breakdown</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: currentOutline.totalPages }, (_, i) => {
                      const pageNum = i + 1;
                      const plotPoint = currentOutline.plotPoints.find(p => p.pageNumber === pageNum);
                      return (
                        <div
                          key={i}
                          className={`p-3 rounded border text-center ${
                            plotPoint 
                              ? plotPoint.type === 'setup' ? 'bg-blue-50 border-blue-200' :
                                plotPoint.type === 'conflict' ? 'bg-orange-50 border-orange-200' :
                                plotPoint.type === 'climax' ? 'bg-red-50 border-red-200' :
                                'bg-green-50 border-green-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="font-medium text-sm">Page {pageNum}</div>
                          {plotPoint && (
                            <div className="text-xs mt-1 text-gray-600">{plotPoint.title}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Statistics */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded">
                    <div className="text-2xl font-bold text-blue-600">{currentOutline.characters.length}</div>
                    <div className="text-sm text-blue-800">Characters</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded">
                    <div className="text-2xl font-bold text-purple-600">{currentOutline.plotPoints.length}</div>
                    <div className="text-sm text-purple-800">Plot Points</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">{currentOutline.totalPages}</div>
                    <div className="text-sm text-green-800">Total Pages</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded">
                    <div className="text-2xl font-bold text-orange-600">
                      {currentOutline.plotPoints.filter(p => p.pageNumber).length}
                    </div>
                    <div className="text-sm text-orange-800">Mapped Points</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Empty state
        <div className="text-center py-16">
          <BookOpen className="mx-auto h-20 w-20 text-gray-400 mb-6" />
          <h2 className="text-3xl font-bold text-gray-600 mb-4">Create Your Story Plot</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Start by creating a plot outline to organize your story structure, characters, and key plot points.
          </p>
          <button
            onClick={createNewOutline}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
          >
            <Plus size={20} />
            Create New Plot Outline
          </button>
        </div>
      )}
    </div>
  );
};

export default Plot;