import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Section } from '../types'; // Import Section type
import {
  Home,
  Settings,
  BookOpen,
  Palette,
  FileText,
  FolderOpen,
  CheckCircle,
  UploadCloud,
  User,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Map,
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const {
    currentSection,
    setCurrentSection,
    logout,
    isAuthenticated,
    isSidebarCollapsed,
    toggleSidebar,
    currentProject,
  } = useAppStore();

  const handleNavigation = (section: Section) => {
    setCurrentSection(section);
  };

  if (!isAuthenticated) {
    return null; // Don't render sidebar if not authenticated
  }

  return (
    <div className={`bg-gray-800 text-white flex flex-col transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="p-4 flex items-center justify-between border-b border-gray-700">
        {!isSidebarCollapsed && <h1 className="text-xl font-semibold truncate">Colorbook Engine</h1>}
        <button 
          onClick={toggleSidebar} 
          className="p-2 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
        </button>
      </div>

      {!isSidebarCollapsed && currentProject && (
        <div className="p-4 border-b border-gray-700">
          <p className="text-xs text-gray-400 mb-1">Current Project:</p>
          <p className="text-sm font-medium truncate" title={currentProject.title}>{currentProject.title}</p>
        </div>
      )}

      <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
        {[
          { id: 'dashboard' as Section, label: 'Dashboard', icon: Home },
          { id: 'projects' as Section, label: 'Projects', icon: FolderOpen },
          { id: 'plot' as Section, label: 'Plot', icon: Map },
          { id: 'story-generator' as Section, label: 'Story Generator', icon: BookOpen },
          { id: 'image-generator' as Section, label: 'Image Generator', icon: Palette },
          { id: 'canvas' as Section, label: 'Canvas', icon: Palette },
          { id: 'pdf' as Section, label: 'PDF Export', icon: FileText },
          { id: 'kdp' as Section, label: 'KDP Compliance', icon: CheckCircle },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.id)}
            className={`w-full flex items-center p-3 rounded hover:bg-gray-700 transition-colors 
                        ${currentSection === item.id ? 'bg-blue-600 text-white' : 'text-gray-300'}
                        ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title={item.label}
          >
            <item.icon size={20} />
            {!isSidebarCollapsed && <span className="ml-3 truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700 space-y-2">
        {[
          { id: 'api-settings' as Section, label: 'API Settings', icon: Settings, disabled: false },
          { id: 'cloud-upload' as Section, label: 'Cloud Upload', icon: UploadCloud, disabled: true }, // Changed CloudUpload to UploadCloud
          { id: 'account' as Section, label: 'Account', icon: User, disabled: true },
          { id: 'help' as Section, label: 'Help/Docs', icon: HelpCircle, disabled: false },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.id)}
            className={`w-full flex items-center p-3 rounded hover:bg-gray-700 transition-colors 
                        ${currentSection === item.id ? 'bg-blue-600 text-white' : 'text-gray-300'}
                        ${isSidebarCollapsed ? 'justify-center' : ''}
                        ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={item.label}
            disabled={item.disabled}
          >
            <item.icon size={20} />
            {!isSidebarCollapsed && <span className="ml-3 truncate">{item.label}</span>}
          </button>
        ))}
        <button
          onClick={() => {
            logout();
            // Handle logout navigation if needed
          }}
          className={`w-full flex items-center p-3 rounded hover:bg-red-600 transition-colors text-red-300 hover:text-white 
                      ${isSidebarCollapsed ? 'justify-center' : ''}`}
          title="Logout"
        >
          <LogOut size={20} />
          {!isSidebarCollapsed && <span className="ml-3 truncate">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;