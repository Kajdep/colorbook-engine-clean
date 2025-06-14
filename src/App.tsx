import { useEffect, useState } from 'react';
import APISettings from './components/APISettings';
import AuthModal from './components/AuthModal';
import Dashboard from './components/Dashboard';
import StorageManagement from './components/StorageManagement';
import HelpCenter from './components/HelpCenter';
import NotificationContainer from './components/NotificationContainer';
import Sidebar from './components/Sidebar';
import StoryGenerator from './components/StoryGenerator';
import ImageGenerator from './components/ImageGenerator';
import Projects from './components/Projects';
import DrawingCanvas from './components/DrawingCanvas';
import PDFExport from './components/PDFExport';
import KDPCompliance from './components/KDPCompliance';
import { useAppStore } from './store/useAppStore';
import './App.css';

function App() {
  const {
    isAuthenticated,
    currentSection,
    currentProject,
    isSidebarCollapsed,
    initializeApp,
  } = useAppStore();

  const [showStorage, setShowStorage] = useState(false);

  const openStorage = () => setShowStorage(true);
  const closeStorage = () => setShowStorage(false);

  // Initialize the app on first load
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setShowStorage(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {isAuthenticated && <Sidebar />}
      <main 
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          isAuthenticated ? (isSidebarCollapsed ? 'ml-20' : 'ml-64') : 'ml-0'
        }`}
      >
        {isAuthenticated ? (
          <>
            {currentProject && (
              <header className="bg-white shadow-md p-4 sticky top-0 z-10">
                <h2 className="text-xl font-semibold text-gray-700 truncate text-center">
                  {currentProject.title}
                </h2>
              </header>
            )}
            <div className="p-6 overflow-auto flex-grow">
              {currentSection === 'dashboard' && (
                <Dashboard onOpenStorage={openStorage} />
              )}
              {currentSection === 'projects' && <Projects />}
              {currentSection === 'api-settings' && <APISettings />}
              {currentSection === 'story-generator' && <StoryGenerator />}
              {currentSection === 'image-generator' && <ImageGenerator />}
              {currentSection === 'canvas' && <DrawingCanvas />}
              {currentSection === 'pdf' && <PDFExport />}
              {currentSection === 'kdp' && <KDPCompliance />}
              {currentSection === 'cloud-upload' && (
                <div className="text-center p-10">
                  <h2 className="text-2xl font-bold text-gray-600 mb-4">Cloud Upload</h2>
                  <p className="text-gray-500">Google Drive and Dropbox integration coming soon!</p>
                </div>
              )}
              {currentSection === 'account' && (
                <div className="text-center p-10">
                  <h2 className="text-2xl font-bold text-gray-600 mb-4">Account Settings</h2>
                  <p className="text-gray-500">Account management features coming soon!</p>
                </div>
              )}
              {currentSection === 'help' && <HelpCenter />}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <AuthModal isOpen={!isAuthenticated} onClose={() => {}} />
          </div>
        )}
      </main>
      <StorageManagement isOpen={showStorage} onClose={closeStorage} />
      <NotificationContainer />
    </div>
  );
}

export default App;
