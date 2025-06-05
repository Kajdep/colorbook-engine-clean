import React, { useState, useEffect } from 'react';
import { Settings, Key, Eye, EyeOff, ExternalLink, Save, TestTube, BookOpen } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { googleImagesAI } from '../utils/googleImagesAI';
import { APISettings as APISettingsType, ImageService } from '../types';

const APISettings: React.FC = () => {
  const { apiSettings, updateApiSettings, addNotification } = useAppStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showImageApiKey, setShowImageApiKey] = useState(false);
  const [showGoogleApiKey, setShowGoogleApiKey] = useState(false);
  const [formData, setFormData] = useState<APISettingsType>(apiSettings);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<Array<{ id: string; name: string }>>([]);
  const [imageModels, setImageModels] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    setFormData(apiSettings);
  }, [apiSettings]);

  useEffect(() => {
    if (formData.apiKey && openRouterModels.length === 0 && !isTestingConnection) {
      // Consider auto-fetch on load: testConnection();
    }
    if (formData.imageApiKey && formData.imageService && formData.imageService !== 'none' && !formData.imageService.startsWith('google-') && imageModels.length === 0 && !isTestingConnection) {
      // Consider auto-fetch on load: testImageServiceConnection();
    }
  }, [formData.apiKey, formData.imageApiKey, formData.imageService, openRouterModels.length, imageModels.length, isTestingConnection]);

  const handleInputChange = (field: keyof APISettingsType, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateApiSettings(formData);
    if (formData.googleApiKey && formData.googleProjectId) {
      googleImagesAI.setCredentials(formData.googleApiKey, formData.googleProjectId);
    }
    addNotification({
      type: 'success',
      message: 'API settings saved successfully!'
    });
  };

  const testConnection = async () => {
    if (!formData.apiKey) {
      addNotification({ type: 'warning', message: 'Please enter an API key first' });
      setOpenRouterModels([]);
      return;
    }
    setIsTestingConnection(true);
    setOpenRouterModels([]);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${formData.apiKey}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'ColorBook Engine' }
      });
      if (response.ok) {
        const { data } = await response.json();
        const fetchedModels: Array<{ id: string; name: string }> = data.map((model: any) => ({ id: model.id, name: model.name || model.id }));
        setOpenRouterModels(fetchedModels);
        if (fetchedModels.length > 0 && (!formData.aiModel || !fetchedModels.find(m => m.id === formData.aiModel))) {
          handleInputChange('aiModel', fetchedModels[0].id);
        }
        addNotification({ type: 'success', message: 'OpenRouter API connection successful! Models loaded. ✅' });
      } else {
        setOpenRouterModels([]);
        const errorData = await response.text();
        addNotification({ type: 'error', message: `OpenRouter API connection failed: ${response.status} ${errorData || 'Please check your key.'}` });
      }
    } catch (error) {
      setOpenRouterModels([]);
      addNotification({ type: 'error', message: `Network error: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testImageServiceConnection = async () => {
    if (!formData.imageApiKey) {
      addNotification({ type: 'warning', message: 'Please enter an Image API key.' });
      setImageModels([]);
      return;
    }
    if (!formData.imageService || formData.imageService === 'none' || formData.imageService.startsWith('google-')) {
      addNotification({ type: 'warning', message: 'Select a non-Google image service (OpenAI, StabilityAI, Replicate) to test.' });
      setImageModels([]);
      return;
    }
    setIsTestingConnection(true);
    setImageModels([]);
    let models: Array<{ id: string; name: string }> = [];
    let success = false;
    const currentImageService = formData.imageService as Exclude<ImageService, 'none' | 'google-imagen' | 'google-imagen2' | 'google-vertex'>;
    const serviceName = currentImageService.charAt(0).toUpperCase() + currentImageService.slice(1);
    let errorMessage = `Failed to connect or fetch models for ${serviceName}.`;

    try {
      if (currentImageService === 'openai') {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${formData.imageApiKey}` }
        });
        if (response.ok) {
          const data = await response.json();
          models = (data.data || [])
            .filter((model: any) => model.id && model.id.startsWith('dall-e'))
            .map((model: any) => ({ id: model.id, name: model.id }));
          success = true;
        } else {
          errorMessage = await response.text();
        }
      } else if (currentImageService === 'stabilityai') {
        const response = await fetch('https://api.stability.ai/v1alpha/models', {
          headers: { 'Authorization': `Bearer ${formData.imageApiKey}` }
        });
        if (response.ok) {
          const data = await response.json();
          models = (data || []).map((model: any) => ({ id: model.id, name: model.name || model.id }));
          success = true;
        } else {
          errorMessage = await response.text();
        }
      } else if (currentImageService === 'replicate') {
        const response = await fetch('https://api.replicate.com/v1/models', {
          headers: { 'Authorization': `Token ${formData.imageApiKey}` }
        });
        if (response.ok) {
          const data = await response.json();
          const list = data.results || data.models || [];
          models = list.map((model: any) => ({ id: model.slug || model.id, name: model.name || model.slug || model.id }));
          if (models.length > 0) success = true;
        } else {
          errorMessage = await response.text();
        }
      }

      if (success) {
        setImageModels(models);
        if (models.length > 0 && (!formData.imageModel || !models.find(m => m.id === formData.imageModel))) {
          handleInputChange('imageModel', models[0].id);
        }
        addNotification({ type: 'success', message: `${serviceName} connection successful! Models updated. ✅` });
      } else {
        addNotification({ type: 'error', message: errorMessage });
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Error connecting to ${serviceName}: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testGoogleConnection = async () => {
    if (!formData.googleApiKey || !formData.googleProjectId) {
      addNotification({ type: 'warning', message: 'Please enter both Google API key and Project ID' });
      return;
    }
    setIsTestingConnection(true);
    try {
      googleImagesAI.setCredentials(formData.googleApiKey, formData.googleProjectId);
      const result = await googleImagesAI.testConnection('imagen-2');
      if (result.success) {
        addNotification({ type: 'success', message: `Google AI connection successful! ✅ (${result.responseTime}ms)` });
      } else {
        addNotification({ type: 'error', message: `Google AI connection failed: ${result.error}` });
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Google AI connection test failed: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const openSetupGuide = () => {
    window.open('/GOOGLE_AI_SETUP_GUIDE.md', '_blank');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ... Header ... */}
      <div className="flex items-center gap-3 mb-8">
        <Settings size={32} className="text-gray-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">API Settings</h1>
          <p className="text-gray-600">Configure AI services for story and image generation</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* OpenRouter API Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <Key className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-semibold">OpenRouter API Configuration</h2>
              <p className="text-gray-600 text-sm">Required for AI story generation</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">API Key *</label>
              <div className="relative">
                <input id="apiKey" type={showApiKey ? 'text' : 'password'} value={formData.apiKey} onChange={(e) => handleInputChange('apiKey', e.target.value)} className="form-input pr-10" placeholder="sk-or-v1-..." />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute inset-y-0 right-0 pr-3 flex items-center" aria-label={showApiKey ? "Hide API key" : "Show API key"}>
                  {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">OpenRouter <ExternalLink size={12} /></a></p>
            </div>
            <div>
              <label htmlFor="aiModel" className="block text-sm font-medium text-gray-700 mb-2">AI Model</label>
              <select id="aiModel" value={formData.aiModel} onChange={(e) => handleInputChange('aiModel', e.target.value)} className="form-input" disabled={!formData.apiKey || openRouterModels.length === 0} aria-label="Select AI Model">
                {openRouterModels.length > 0 ? (
                  openRouterModels.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))
                ) : (
                  <>
                    <option value="" disabled>{formData.apiKey ? 'Test Connection to load models' : 'Enter API key first'}</option>
                    {(!formData.apiKey || (formData.apiKey && openRouterModels.length === 0)) && (
                        <>
                            <option value="google/gemma-2-9b-it:free">Gemma 2 9B (Free - Fallback)</option>
                            <option value="meta-llama/llama-3.1-8b-instruct:free">Llama 3.1 8B (Free - Fallback)</option>
                            <option value="microsoft/phi-3-mini-128k-instruct:free">Phi-3 Mini (Free - Fallback)</option>
                            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Paid - Fallback)</option>
                            <option value="openai/gpt-4o">GPT-4o (Paid - Fallback)</option>
                            <option value="google/gemini-pro-1.5">Gemini Pro 1.5 (Paid - Fallback)</option>
                        </>
                    )}
                  </>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">{openRouterModels.length > 0 ? 'Select a model from the list.' : 'Models will load after successful API key test.'} Free models may have rate limits. Paid models generally offer better quality and speed.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={testConnection} disabled={isTestingConnection || !formData.apiKey} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {isTestingConnection && !formData.googleApiKey ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <TestTube size={16} />} Test Connection
              </button>
              <a href="https://openrouter.ai/docs" target="_blank" rel="noopener noreferrer" className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors inline-flex items-center gap-2">View Docs <ExternalLink size={16} /></a>
            </div>
          </div>
        </div>

        {/* Image Generation Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-100 p-2 rounded-lg"><span className="text-purple-600 text-xl">🎨</span></div>
            <div>
              <h2 className="text-xl font-semibold">Image Generation API</h2>
              <p className="text-gray-600 text-sm">Optional: For AI-generated coloring page images</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="imageService" className="block text-sm font-medium text-gray-700 mb-2">Image Service</label>
              <select id="imageService" value={formData.imageService} onChange={(e) => { handleInputChange('imageService', e.target.value); setImageModels([]); handleInputChange('imageModel', ''); }} className="form-input" aria-label="Select Image Service">
                <option value="none">None (Use placeholder images)</option>
                <option value="openai">OpenAI DALL-E</option>
                <option value="stabilityai">Stability AI</option>
                <option value="replicate">Replicate</option>
                <option value="google-imagen2">Google Imagen 2 (Recommended)</option>
                <option value="google-vertex">Google Vertex AI (Advanced)</option>
                 {/* <option value=\"google-imagen\">Google Imagen v1 (Legacy)</option> */}
              </select>
            </div>

            {formData.imageService && formData.imageService !== 'none' && (
              <>
                {(formData.imageService.startsWith('google-')) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-blue-900">Google AI Configuration ({formData.imageService === 'google-imagen2' ? 'Imagen 2' : 'Vertex AI'})</h4>
                      <button onClick={openSetupGuide} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm hover:bg-blue-200 transition-colors flex items-center gap-1"><BookOpen size={14} /> Setup Guide</button>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                      <h5 className="font-medium text-yellow-800 text-sm mb-1">📋 Quick Setup Steps:</h5>
                      <ol className="text-xs text-yellow-700 space-y-1">
                        <li>1. Create Google Cloud project & Enable Vertex AI API.</li>
                        <li>2. Create Service Account Key (JSON) or API Key with "Vertex AI User" role.</li>
                        <li>3. Enter Project ID and the Key (JSON content or API Key string) below.</li>
                      </ol>
                      <p className="text-xs text-yellow-600 mt-2">Refer to "Setup Guide". Google Cloud free tier may offer credits, otherwise usage is billed.</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="googleProjectId" className="block text-sm font-medium text-blue-800 mb-1">Google Cloud Project ID *</label>
                        <input id="googleProjectId" type="text" value={formData.googleProjectId || ''} onChange={(e) => handleInputChange('googleProjectId', e.target.value)} className="form-input" placeholder="your-project-id" />
                        <p className="text-xs text-blue-600 mt-1">Find this in your Google Cloud Console.</p>
                      </div>
                      <div>
                        <label htmlFor="googleApiKey" className="block text-sm font-medium text-blue-800 mb-1">Service Account Key (JSON) or API Key *</label>
                        <div className="relative">
                          <textarea id="googleApiKey" rows={3} value={formData.googleApiKey || ''} onChange={(e) => handleInputChange('googleApiKey', e.target.value)} className="form-input pr-10" placeholder="Paste your Google AI API key or full service account JSON content here" />
                          <button type="button" onClick={() => setShowGoogleApiKey(!showGoogleApiKey)} className="absolute top-0 right-0 p-2.5 flex items-center" aria-label={showGoogleApiKey ? "Hide Google API key" : "Show Google API key"}>
                            {showGoogleApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">Paste entire JSON content if using a service account key.</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={testGoogleConnection} disabled={isTestingConnection || !formData.googleApiKey || !formData.googleProjectId} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                          {isTestingConnection && formData.googleApiKey ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <TestTube size={16} />} Test Google AI
                        </button>
                        <a href="https://console.cloud.google.com/vertex-ai" target="_blank" rel="noopener noreferrer" className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors inline-flex items-center gap-2">Google Cloud <ExternalLink size={16} /></a>
                      </div>
                    </div>
                  </div>
                )}

                {!formData.imageService.startsWith('google-') && (
                  <div>
                    <label htmlFor="imageApiKey" className="block text-sm font-medium text-gray-700 mb-2">{formData.imageService?.charAt(0).toUpperCase() + formData.imageService?.slice(1)} API Key</label>
                    <div className="relative">
                      <input id="imageApiKey" type={showImageApiKey ? 'text' : 'password'} value={formData.imageApiKey} onChange={(e) => handleInputChange('imageApiKey', e.target.value)} className="form-input pr-10" placeholder={`Enter your ${formData.imageService} API key...`} />
                      <button type="button" onClick={() => setShowImageApiKey(!showImageApiKey)} className="absolute inset-y-0 right-0 pr-3 flex items-center" aria-label={showImageApiKey ? "Hide image API key" : "Show image API key"}>
                        {showImageApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <button onClick={testImageServiceConnection} disabled={isTestingConnection || !formData.imageApiKey} className="mt-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                      {isTestingConnection && !formData.googleApiKey ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <TestTube size={14} />} Test {formData.imageService?.charAt(0).toUpperCase() + formData.imageService?.slice(1)} Key
                    </button>
                  </div>
                )}

                <div>
                  <label htmlFor="imageModel" className="block text-sm font-medium text-gray-700 mb-2">Image Model</label>
                  <select
                    id="imageModel"
                    value={formData.imageModel}
                    onChange={(e) => handleInputChange('imageModel', e.target.value)}
                    className="form-input"
                    disabled={
                      (formData.imageService === 'openai' ||
                        formData.imageService === 'stabilityai' ||
                        formData.imageService === 'replicate') &&
                      imageModels.length === 0
                    }
                    aria-label="Select Image Model"
                  >
                    {formData.imageService === 'google-imagen2' && (
                      <option value="imagen-2">Google Imagen 2</option>
                    )}
                    {formData.imageService === 'google-vertex' && (
                      <option value="vertex-ai">Vertex AI Imagen</option>
                    )}
                    {/* <option value=\"imagegeneration@002\">Imagen v1 (Legacy - imagegeneration@002)</option> */}

                    {(formData.imageService === 'openai' || formData.imageService === 'stabilityai' || formData.imageService === 'replicate') && imageModels.length > 0 && (
                      imageModels.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))
                    )}
                    
                    {formData.imageService === 'openai' && imageModels.length === 0 && (
                      <><option value="" disabled>{formData.imageApiKey ? 'Test Key to load models' : 'Enter API key first'}</option><option value="dall-e-3">DALL-E 3 (Fallback)</option><option value="dall-e-2">DALL-E 2 (Fallback)</option></>
                    )}
                    {formData.imageService === 'stabilityai' && imageModels.length === 0 && (
                      <><option value="" disabled>{formData.imageApiKey ? 'Test Key to load models' : 'Enter API key first'}</option><option value="stable-diffusion-xl-1024-v1-0">Stable Diffusion XL (Fallback)</option><option value="stable-diffusion-v1-6">Stable Diffusion v1.6 (Fallback)</option></>
                    )}
                    {formData.imageService === 'replicate' && imageModels.length === 0 && (
                      <><option value="" disabled>{formData.imageApiKey ? 'Test Key to load models' : 'Enter API key first'}</option><option value="stability-ai/sdxl">SDXL (Replicate - Fallback)</option></>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.imageService === 'openai' ||
                    formData.imageService === 'stabilityai' ||
                    formData.imageService === 'replicate'
                      ? imageModels.length > 0
                        ? 'Select a model.'
                        : 'Models will load after API key test.'
                      : formData.imageService && formData.imageService.startsWith('google-')
                      ? 'Select a Google model or ensure Project ID/Key are correct.'
                      : 'Select an image service first.'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-8">
          <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"><Save size={18} /> Save Settings</button>
        </div>
      </div>
    </div>
  );
};

export default APISettings;