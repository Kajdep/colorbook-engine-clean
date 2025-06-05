import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  BookOpen,
  X,
  LucideProps
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<LucideProps>;
  content: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface UserOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const UserOnboarding: React.FC<UserOnboardingProps> = ({ isOpen, onClose, onComplete }) => {
  const { setCurrentSection, addNotification } = useAppStore();
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to ColorBook Engine!',
      description: 'Your professional coloring book creation platform',
      icon: Sparkles,
      content: (
        <div className="text-center">
          <div className="text-6xl mb-4">🎨</div>
          <p className="text-lg text-gray-700 mb-6">
            Create amazing coloring books with AI-powered stories, professional drawing tools, 
            and print-ready PDFs.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">✨ AI-Powered</h4>
              <p className="text-blue-700">Generate stories and images with advanced AI</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">🎨 Professional Tools</h4>
              <p className="text-green-700">Drawing canvas with professional features</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-2">📄 Print-Ready</h4>
              <p className="text-purple-700">Export PDFs ready for Amazon KDP</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-semibold text-orange-800 mb-2">☁️ Cloud Sync</h4>
              <p className="text-orange-700">Never lose your projects</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'projects',
      title: 'Organize Your Projects',
      description: 'Learn how to create and manage your coloring book projects',
      icon: BookOpen,
      content: (
        <div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <h4 className="font-semibold">Create Projects</h4>
                <p className="text-gray-600">Organize different coloring book ideas into separate projects</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h4 className="font-semibold">Add Metadata</h4>
                <p className="text-gray-600">Set target age, theme, and other project details</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h4 className="font-semibold">Track Progress</h4>
                <p className="text-gray-600">Monitor completion status and export readiness</p>
              </div>
            </div>
          </div>
        </div>
      ),
      action: {
        label: 'Try Creating a Project',
        onClick: () => {
          setCurrentSection('projects');
          addNotification({
            type: 'info',
            message: 'Click "New Project" to create your first coloring book!'
          });
        }
      }
    },
    {
      id: 'story-generation',
      title: 'Generate AI Stories',
      description: 'Create engaging stories with AI assistance',
      icon: Sparkles,
      content: (
        <div>
          <div className="mb-6">
            <div className="bg-gradient-to-r from-purple-400 to-pink-400 p-6 rounded-lg text-white text-center">
              <Sparkles size={32} className="mx-auto mb-2" />
              <h4 className="font-bold text-lg">AI Story Magic</h4>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">🎭 Set Your Theme</h4>
              <p className="text-gray-600 text-sm">"Adventure in a magical forest" or "Friendship at the beach"</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">👥 Add Characters</h4>
              <p className="text-gray-600 text-sm">"Brave rabbit Luna, wise owl Oliver, playful fox Max"</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">💡 Pro Tip</h4>
              <p className="text-green-700 text-sm">The AI will create both story text AND detailed image prompts for each page!</p>
            </div>
          </div>
        </div>
      ),
      action: {
        label: 'Try Story Generation',
        onClick: () => {
          setCurrentSection('story-generator');
          addNotification({
            type: 'info',
            message: 'Fill out the story form and click "Generate Story" to see the magic!'
          });
        }
      }
    },
    {
      id: 'complete',
      title: 'You\'re Ready to Create!',
      description: 'Start building amazing coloring books',
      icon: Check,
      content: (
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Congratulations!</h3>
          <p className="text-lg text-gray-700 mb-6">
            You now know how to use ColorBook Engine to create professional coloring books.
          </p>
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg mb-6">
            <h4 className="font-bold text-lg mb-2">🚀 Your Next Steps</h4>
            <div className="text-left space-y-2 text-sm">
              <p>1. Create your first project</p>
              <p>2. Generate or write a story</p>
              <p>3. Add images and artwork</p>
              <p>4. Export a professional PDF</p>
              <p>5. Publish on Amazon KDP!</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <button
              onClick={() => setCurrentSection('help')}
              className="bg-blue-100 text-blue-800 p-3 rounded-lg hover:bg-blue-200 transition-colors"
            >
              📖 Browse Help Center
            </button>
            <button
              onClick={() => setCurrentSection('projects')}
              className="bg-green-100 text-green-800 p-3 rounded-lg hover:bg-green-200 transition-colors"
            >
              🎨 Create First Project
            </button>
          </div>
        </div>
      )
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    onComplete();
    addNotification({
      type: 'success',
      message: 'Welcome to ColorBook Engine! You\'re ready to create amazing coloring books! 🎉'
    });
  };

  const skipOnboarding = () => {
    onComplete();
    addNotification({
      type: 'info',
      message: 'Onboarding skipped. You can access the Help Center anytime from the sidebar.'
    });
  };

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <Icon size={32} />
            <div>
              <h2 className="text-2xl font-bold">{currentStepData.title}</h2>
              <p className="opacity-90">{currentStepData.description}</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index <= currentStep ? 'bg-white' : 'bg-white bg-opacity-30'
                } ${
                  index === currentStep ? 'w-8' : 'w-2'
                }`}
              />
            ))}
          </div>
          <div className="text-right text-sm opacity-75 mt-2">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-between items-center">
          <div className="flex gap-3">
            <button
              onClick={skipOnboarding}
              className="text-gray-600 hover:text-gray-800 text-sm transition-colors"
            >
              Skip tour
            </button>
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {currentStepData.action && (
              <button
                onClick={currentStepData.action.onClick}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {currentStepData.action.label}
              </button>
            )}
            <button
              onClick={isLastStep ? handleComplete : nextStep}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              {isLastStep ? 'Start Creating!' : 'Next'}
              {!isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserOnboarding;