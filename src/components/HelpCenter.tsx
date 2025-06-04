import React, { useState } from 'react';
import { 
  HelpCircle, 
  BookOpen, 
  Play, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft, // Added for sidebar toggle
  MessageCircle,
  Mail,
  Users,
  FileText,
  Lightbulb, // Added for General Instructions help item
  Settings,
  Upload, // Re-used or for Importing Files
  Palette,
  PenTool, // Re-used or for Magic Editor
  Image,
  FileImage,
  DollarSign,
  Globe,
  Plus,
  Sparkles,
  CheckCircle,
  Edit, // Added for Magic Editor help item
  UserCog, // Added for Managing Account help item
  FileUp, // Added for Importing Files help item
  LucideProps
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface HelpItem {
  id: string;
  title: string;
  content: string;
  category: string;
  icon: React.ComponentType<LucideProps>;
  videoUrl?: string;
  steps?: string[];
}

const helpCategories = [
  { id: 'getting-started', name: 'Getting Started', icon: BookOpen },
  { id: 'story-generation', name: 'Story Generation', icon: BookOpen },
  { id: 'drawing-canvas', name: 'Drawing Canvas', icon: Palette },
  { id: 'pdf-export', name: 'PDF Export', icon: FileText },
  { id: 'publishing', name: 'Publishing', icon: Upload },
  { id: 'account', name: 'Account & Billing', icon: Users },
  { id: 'troubleshooting', name: 'Troubleshooting', icon: Settings },
  { id: 'api-setup', name: 'API Setup', icon: Globe },
];

const helpItems: HelpItem[] = [
  // Getting Started
  {
    id: 'welcome',
    title: 'Welcome to ColorBook Engine',
    category: 'getting-started',
    icon: BookOpen,
    content: 'ColorBook Engine is a professional platform for creating AI-powered coloring books. You can generate stories, create custom artwork, and export print-ready PDFs for publishing on Amazon KDP and other platforms.',
    steps: [
      'Create your first project from the Dashboard',
      'Generate an AI story or write your own',
      'Add images using AI generation or upload your own',
      'Use the drawing canvas to create custom artwork',
      'Export professional PDFs ready for publishing',
      'Check KDP compliance before publishing'
    ]
  },
  {
    id: 'first-project',
    title: 'Creating Your First Project',
    category: 'getting-started',
    icon: Plus,
    content: 'Learn how to create and organize your coloring book projects effectively.',
    steps: [
      'Click "New Project" in the sidebar or dashboard',
      'Enter a descriptive project name',
      'Add optional description and target age group',
      'Choose project template (optional)',
      'Click "Create Project" to get started',
      'Your project will appear in the Projects section'
    ]
  },

  // Story Generation
  {
    id: 'ai-stories',
    title: 'Generating AI Stories',
    category: 'story-generation',
    icon: Sparkles,
    content: 'Use our AI integration to create engaging stories for your coloring books. Specify the number of story segments; each segment typically generates one text page and one accompanying illustration page (e.g., 10 segments result in approximately 20 pages, including text and images).',
    steps: [
      'Go to Story Generator section',
      'Enter your story theme (e.g., "Adventure in magical forest")',
      'Add main characters with descriptions',
      'Set age range for appropriate content',
      'Specify desired number of story segments. Note: Each segment usually produces one story page and one image page.',
      'Define words per page for text segments.',
      'Add a moral or lesson (optional)',
      'Select image style and line weight for illustrations',
      'Click "Generate Story" and wait for AI to create your content'
    ]
  },
  {
    id: 'edit-stories',
    title: 'Editing Generated Stories',
    category: 'story-generation',
    icon: PenTool,
    content: 'Customize and perfect your AI-generated stories to match your vision.',
    steps: [
      'Click the "Edit" button on any story page',
      'Modify the story text directly',
      'Adjust image prompts for better illustrations',
      'Add or remove characters as needed',
      'Save changes to update the story',
      'Use "Regenerate" to create variations'
    ]
  },
  {
    id: 'character-consistency',
    title: 'Maintaining Character Consistency',
    category: 'story-generation',
    icon: Users,
    content: 'Keep your characters looking the same throughout your book.',
    steps: [
      'Create character references in Story Generator',
      'Describe physical appearance in detail',
      'Use consistent character names',
      'Reference previous character descriptions',
      'Review generated images for consistency',
      'Regenerate if characters don\'t match'
    ]
  },
  {
    id: 'general-story-instructions',
    title: 'Providing General Instructions for Story AI',
    category: 'story-generation',
    icon: Lightbulb,
    content: 'Guide the AI story generation with overall instructions to better align the narrative with your vision. This allows for more control over tone, style, and recurring themes.',
    steps: [
      'In the Story Generator, locate the "General Instructions" field.',
      'Input your overarching guidelines (e.g., "Maintain a lighthearted and adventurous tone", "Focus on themes of friendship and courage", "Avoid complex vocabulary for younger audiences").',
      'These instructions will be considered by the AI alongside specific prompts for each segment.',
      'Experiment with different instructions to see how they influence the generated story.'
    ]
  },
  {
    id: 'magic-editor',
    title: 'Using the Magic Editor for Text Refinement',
    category: 'story-generation',
    icon: Edit, 
    content: 'Refine specific parts of your generated story using the Magic Editor. Highlight text and instruct the AI to make targeted changes, such as rephrasing, shortening, or elaborating.',
    steps: [
      'Once a story is generated, open it in the editor view.',
      'Select the portion of text you wish to modify.',
      'Click the "Magic Edit" (or similarly named) button that appears.',
      'Provide a prompt to the AI describing the desired change (e.g., "Make this paragraph more descriptive", "Simplify this sentence", "Change the tone to be more mysterious").',
      'Review the AI-suggested revision and accept or discard it.'
    ]
  },

  // Drawing Canvas
  {
    id: 'drawing-tools',
    title: 'Using the Drawing Canvas',
    category: 'drawing-canvas',
    icon: Palette,
    content: 'Master the professional drawing tools to create custom coloring pages.',
    steps: [
      'Select brush or eraser tool',
      'Adjust brush size (1-50 pixels)',
      'Set opacity (10-100%)',
      'Choose colors from the palette',
      'Click and drag to draw',
      'Use Undo/Redo for corrections',
      'Save your artwork when finished'
    ]
  },
  {
    id: 'drawing-templates',
    title: 'Using Drawing Templates',
    category: 'drawing-canvas',
    icon: FileImage,
    content: 'Start with pre-built templates to speed up your creative process.',
    steps: [
      'Go to Drawing Canvas section',
      'Click on template buttons (Butterfly, Flower, Star, Heart)',
      'Template loads automatically on canvas',
      'Customize the template with additional drawing',
      'Change colors and add details',
      'Save the modified template as your artwork'
    ]
  },

  // PDF Export
  {
    id: 'pdf-export',
    title: 'Exporting Professional PDFs',
    category: 'pdf-export',
    icon: FileText,
    content: 'Create print-ready PDFs with professional formatting and KDP compliance.',
    steps: [
      'Go to PDF Export section',
      'Select the project to export',
      'Choose page size (Letter, A4, or Square)',
      'Configure bleed and margin settings',
      'Select content to include (cover, story, coloring pages)',
      'Preview the PDF layout',
      'Click "Export Professional PDF"',
      'Download starts automatically'
    ]
  },
  {
    id: 'kdp-compliance',
    title: 'Ensuring KDP Compliance',
    category: 'pdf-export',
    icon: CheckCircle,
    content: 'Make sure your book meets Amazon KDP publishing requirements.',
    steps: [
      'Go to KDP Compliance section',
      'Select your project for analysis',
      'Review all compliance checks',
      'Fix any red or yellow warnings',
      'Ensure minimum 24 pages',
      'Check bleed and margin requirements',
      'Verify image quality and resolution',
      'Get green checkmarks for all requirements'
    ]
  },
  {
    id: 'import-for-compliance',
    title: 'Importing Files for KDP Compliance (PDF, EPUB)',
    category: 'pdf-export',
    icon: FileUp, 
    content: 'Import existing PDF or EPUB files directly into the KDP Compliance Checker to analyze them against Amazon KDP publishing requirements. This is useful for books created outside ColorBook Engine or for checking revised versions.',
    steps: [
      'Navigate to the KDP Compliance section.',
      'Look for an "Import File" or "Upload PDF/EPUB" option.',
      'Select the PDF or EPUB file from your device.',
      'The tool will attempt to parse the file and run compliance checks.',
      'Review the results and address any identified issues.'
    ]
  },

  // Publishing
  {
    id: 'amazon-kdp',
    title: 'Publishing on Amazon KDP',
    category: 'publishing',
    icon: Upload,
    content: 'Step-by-step guide to publish your coloring book on Amazon KDP.',
    steps: [
      'Ensure your PDF passes KDP compliance checks',
      'Create an Amazon KDP account at kdp.amazon.com',
      'Click "Create New Title" and choose "Paperback"',
      'Enter book details (title, author, description)',
      'Upload your PDF as the manuscript',
      'Create or upload a cover design',
      'Set pricing and distribution options',
      'Preview your book and submit for review'
    ]
  },
  {
    id: 'other-platforms',
    title: 'Publishing on Other Platforms',
    category: 'publishing',
    icon: Globe,
    content: 'Expand your reach by publishing on multiple platforms.',
    steps: [
      'IngramSpark: Upload print-ready PDFs with exact specifications',
      'Apple Books: Convert to EPUB format for digital distribution',
      'Barnes & Noble Press: Similar to KDP with different requirements',
      'Lulu: Self-publishing platform with global distribution',
      'Local Print Shops: Use high-quality PDFs for local printing',
      'Etsy: Sell digital downloads of your coloring pages'
    ]
  },

  // Account & Billing
  {
    id: 'subscription-plans',
    title: 'Subscription Plans',
    category: 'account',
    icon: DollarSign,
    content: 'Understand the different subscription tiers and their benefits.',
    steps: [
      'Free Plan: 3 projects, basic features, watermarked exports',
      'Pro Plan ($19/month): Unlimited projects, all AI features, HD exports',
      'Enterprise Plan ($99/month): Team collaboration, white-label, priority support',
      'Upgrade anytime from your account settings',
      'Cancel or downgrade with no penalty',
      'All your projects remain accessible on all plans'
    ]
  },
  {
    id: 'api-costs',
    title: 'Understanding API Costs',
    category: 'account',
    icon: DollarSign,
    content: 'Learn about API costs and how to manage your usage efficiently.',
    steps: [
      'You provide your own API keys (no platform markup)',
      'OpenRouter: ~$0.01-0.05 per story generation',
      'OpenAI DALL-E: ~$0.02-0.04 per image',
      'Google Imagen: ~$0.02-0.06 per image',
      'Monitor usage in your API provider dashboards',
      'Set spending limits in your API accounts',
      'Use fallback options to minimize costs'
    ]
  },
  {
    id: 'managing-account',
    title: 'Managing Your Account Details',
    category: 'account',
    icon: UserCog, 
    content: 'Access your account page to manage your profile information, subscription plan, view billing history, and potentially manage centralized API key settings.',
    steps: [
      'Click on your profile icon or "Account" in the navigation menu.',
      'Update personal information such as name and email.',
      'View current subscription details and upgrade/downgrade options.',
      'Access billing history and invoices.',
      'If applicable, manage API keys for integrated services from a central location.'
    ]
  },

  // Troubleshooting
  {
    id: 'common-issues',
    title: 'Common Issues & Solutions',
    category: 'troubleshooting',
    icon: Settings,
    content: 'Quick fixes for the most common problems users encounter.',
    steps: [
      'Story generation fails: Check API key and internet connection',
      'Images not loading: Verify API keys and try different providers',
      'PDF export empty: Ensure project has content and images',
      'Drawing not working: Clear browser cache and reload',
      'Projects not saving: Check storage permissions and available space',
      'Slow performance: Close other browser tabs and restart app'
    ]
  },
  {
    id: 'browser-support',
    title: 'Browser Compatibility',
    category: 'troubleshooting',
    icon: Globe,
    content: 'Ensure optimal performance across different browsers.',
    steps: [
      'Recommended: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+',
      'Enable JavaScript and local storage',
      'Allow pop-ups for PDF downloads',
      'Update your browser to the latest version',
      'Clear cache if experiencing issues',
      'Disable ad blockers that might interfere'
    ]
  },

  // API Setup
  {
    id: 'openrouter-setup',
    title: 'Setting Up OpenRouter API',
    category: 'api-setup',
    icon: Globe,
    content: 'Complete guide to setting up OpenRouter for AI story generation.',
    steps: [
      'Visit https://openrouter.ai and create an account',
      'Go to "API Keys" in your dashboard',
      'Click "Create New Key" and give it a name',
      'Copy the API key (starts with sk-or-)',
      'In ColorBook Engine, go to Settings',
      'Paste the key in "OpenRouter API Key" field',
      'Click "Test Connection" to verify',
      'Save settings and start generating stories!'
    ]
  },
  {
    id: 'image-api-setup',
    title: 'Setting Up Image Generation APIs',
    category: 'api-setup',
    icon: Image,
    content: 'Configure multiple image generation providers for best results.',
    steps: [
      'OpenAI: Visit platform.openai.com, create account, get API key',
      'Google AI: Set up Google Cloud project, enable Vertex AI API',
      'Stability AI: Register at platform.stability.ai, generate API key',
      'Replicate: Sign up at replicate.com, create API token',
      'Add keys to Settings in ColorBook Engine',
      'Test each connection before use',
      'Primary provider will be tried first, others as fallbacks'
    ]
  }
];

const faqItems = [
  {
    question: 'Do I need to pay for AI features?',
    answer: 'You provide your own API keys from providers like OpenRouter and OpenAI. This typically costs $5-20/month for regular use. The ColorBook Engine platform subscription is separate and covers the software features.'
  },
  {
    question: 'Can I sell the coloring books I create?',
    answer: 'Yes! You own all the content you create, including AI-generated stories and images. You can publish and sell your coloring books on Amazon KDP, IngramSpark, or any other platform.'
  },
  {
    question: 'What happens if I cancel my subscription?',
    answer: 'Your projects remain accessible, but you may lose access to premium features. Free users can still create 3 projects and access basic features. You can re-subscribe anytime to regain full access.'
  },
  {
    question: 'Can I use this on mobile devices?',
    answer: 'Yes! ColorBook Engine is fully responsive and works on tablets and smartphones. The drawing canvas is optimized for touch input on mobile devices.'
  },
  {
    question: 'How do I backup my projects?',
    answer: 'All projects are automatically saved to your browser. For cloud backup and sharing, you can use integrations like Google Drive or Dropbox (when available), or export individual projects as JSON files from the project settings.'
  },
  {
    question: 'Can I collaborate with others?',
    answer: 'Team collaboration features are available on Enterprise plans. You can share projects, assign roles, and work together on coloring book creation.'
  }
];

const HelpCenter: React.FC = () => {
  const { addNotification } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('getting-started');
  const [expandedItems, setExpandedItems] = useState<string[]>(['welcome']);
  const [showVideo, setShowVideo] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Added state for sidebar visibility

  const filteredItems = helpItems.filter(item => {
    const matchesCategory = item.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleContactSupport = () => {
    addNotification({
      type: 'info',
      message: 'Support contact form opened in new tab',
      duration: 3000
    });
    window.open('mailto:support@colorbookengine.com?subject=Help Request', '_blank');
  };

  const getCurrentCategoryIcon = () => {
    const category = helpCategories.find(cat => cat.id === selectedCategory);
    return category ? category.icon : HelpCircle;
  };

  const CategoryIcon = getCurrentCategoryIcon();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="gradient-bg text-white rounded-xl p-8 mb-6">
          <HelpCircle size={48} className="mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-2">Help Center</h1>
          <p className="text-xl opacity-90">Everything you need to master ColorBook Engine</p>
        </div>

        {/* Search */}
        <div className="relative max-w-lg mx-auto">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search help articles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Categories Sidebar */}
        {/* Updated className for responsive collapsible sidebar */}
        <div className={`
            ${sidebarOpen ? 'block' : 'hidden'} lg:block 
            lg:col-span-1 
            fixed inset-y-0 left-0 z-30 w-3/4 max-w-xs bg-white shadow-xl transform transition-transform duration-300 ease-in-out 
            lg:relative lg:inset-auto lg:z-auto lg:w-auto lg:translate-x-0 lg:shadow-md
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 
            `}>
          <div className="p-4 sticky top-0"> {/* Removed bg-white, shadow, rounded from here as it's on parent now */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">Categories</h3>
                <button 
                    onClick={() => setSidebarOpen(false)} 
                    className="text-gray-500 hover:text-gray-700 lg:hidden"
                    aria-label="Close sidebar"
                >
                    <ChevronLeft size={20} />
                </button>
            </div>
            <div className="space-y-2">
              {helpCategories.map(category => {
                const Icon = category.icon;
                const isActive = selectedCategory === category.id;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                        setSelectedCategory(category.id);
                        if (window.innerWidth < 1024) { // Tailwind 'lg' breakpoint
                            setSidebarOpen(false); // Close sidebar on selection on small screens
                        }
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                      isActive 
                        ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-500' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{category.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Contact */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Need More Help?</h4>
              <div className="space-y-2">
                <button
                  onClick={handleContactSupport}
                  className="w-full text-left p-2 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-2"
                >
                  <Mail size={16} />
                  Email Support
                </button>
                <button
                  onClick={() => window.open('https://discord.gg/colorbookengine', '_blank')}
                  className="w-full text-left p-2 text-sm text-purple-600 hover:bg-purple-50 rounded flex items-center gap-2"
                >
                  <MessageCircle size={16} />
                  Community Discord
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {/* Updated className for dynamic column span */}
        <div className={`${sidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'} col-span-full`}>
          {/* Toggle Sidebar Button for all screens, adjusted for responsiveness */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
            aria-label={sidebarOpen ? "Hide categories" : "Show categories"}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            <span>{sidebarOpen ? 'Hide Categories' : 'Show Categories'}</span>
          </button>
           <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:inline-flex items-center gap-2 mb-4 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            <span className="sr-only">{sidebarOpen ? 'Collapse Menu' : 'Expand Menu'}</span>
          </button>

          {/* Category Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <CategoryIcon size={24} className="text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                {helpCategories.find(cat => cat.id === selectedCategory)?.name}
              </h2>
            </div>
            <p className="text-gray-600">
              {selectedCategory === 'getting-started' && 'Learn the basics of creating amazing coloring books'}
              {selectedCategory === 'story-generation' && 'Master AI-powered story creation and editing'}
              {selectedCategory === 'drawing-canvas' && 'Create beautiful artwork with professional tools'}
              {selectedCategory === 'pdf-export' && 'Export print-ready PDFs for publishing'}
              {selectedCategory === 'publishing' && 'Publish your books on various platforms'}
              {selectedCategory === 'account' && 'Manage your account and subscription'}
              {selectedCategory === 'troubleshooting' && 'Solve common issues and problems'}
              {selectedCategory === 'api-setup' && 'Configure AI providers for best results'}
            </p>
          </div>

          {/* Help Articles */}
          <div className="space-y-4">
            {filteredItems.map(item => {
              const Icon = item.icon;
              const isExpanded = expandedItems.includes(item.id);
              
              return (
                <div key={item.id} className="bg-white rounded-lg shadow-md">
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="w-full text-left p-6 hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon size={20} className="text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                      </div>
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-gray-100">
                      <p className="text-gray-700 mb-4 mt-4">{item.content}</p>
                      
                      {item.steps && (
                        <div className="mb-4">
                          <h4 className="font-medium text-gray-900 mb-2">Step-by-Step Guide:</h4>
                          <ol className="list-decimal list-inside space-y-2 text-gray-700">
                            {item.steps.map((step, index) => (
                              <li key={index} className="text-sm">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      
                      {item.videoUrl && (
                        <button
                          onClick={() => setShowVideo(item.videoUrl!)}
                          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
                        >
                          <Play size={16} />
                          Watch Video Tutorial
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* FAQ Section */}
          {selectedCategory === 'getting-started' && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h3>
              <div className="space-y-4">
                {faqItems.map((faq, index) => (
                  <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <h4 className="font-medium text-gray-900 mb-2">{faq.question}</h4>
                    <p className="text-gray-700 text-sm">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {filteredItems.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Search size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-600 mb-4">
                Try searching with different keywords or browse a different category.
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Video Modal */}
      {showVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Video Tutorial</h3>
              <button
                onClick={() => setShowVideo(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="aspect-video bg-gray-200 rounded flex items-center justify-center">
              <p className="text-gray-600">Video tutorial would load here</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpCenter;