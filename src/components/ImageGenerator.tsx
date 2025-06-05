import React, { useState, useEffect } from 'react';
import { Image, UploadCloud, Sparkles, Download } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AIService } from '../utils/aiService';
import { readFileAsDataURL, generateId, downloadFile } from '../utils/helpers';

interface GeneratedImage {
  id: string;
  prompt: string;
  data: string;
}

const ImageGenerator: React.FC = () => {
  const {
    apiSettings,
    currentProject,
    addNotification,
    saveImage,
    loadProjectImages,
  } = useAppStore();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);

  useEffect(() => {
    async function loadImages() {
      if (currentProject) {
        const loaded = await loadProjectImages(currentProject.id);
        setImages(
          loaded.map((img: any) => ({ id: img.id, prompt: img.metadata?.prompt || '', data: img.data }))
        );
      }
    }
    loadImages();
  }, [currentProject, loadProjectImages]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addNotification({ type: 'warning', message: 'Enter a prompt first' });
      return;
    }
    if (!apiSettings.imageApiKey && apiSettings.imageService !== 'none') {
      addNotification({ type: 'warning', message: 'Configure image API key first' });
      return;
    }
    setIsGenerating(true);
    try {
      const aiService = new AIService(apiSettings);
      let data = await aiService.generateImage(prompt);
      if (data.startsWith('data:image')) {
        const comma = data.indexOf(',');
        if (comma !== -1) data = data.slice(comma + 1);
      }
      const id = generateId();
      const img: GeneratedImage = { id, prompt, data };
      setImages(prev => [...prev, img]);
      if (currentProject) {
        await saveImage({ id, projectId: currentProject.id, type: 'story', data, metadata: { prompt } });
      }
      setPrompt('');
    } catch (err: any) {
      addNotification({ type: 'error', message: err.message || 'Failed to generate image' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addNotification({ type: 'warning', message: 'Max file size is 5MB' });
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      let base64 = dataUrl;
      if (dataUrl.startsWith('data:image')) {
        base64 = dataUrl.split(',')[1];
      }
      const id = generateId();
      const img: GeneratedImage = { id, prompt: file.name, data: base64 };
      setImages(prev => [...prev, img]);
      if (currentProject) {
        await saveImage({ id, projectId: currentProject.id, type: 'story', data: base64, metadata: { prompt: file.name } });
      }
      e.target.value = '';
    } catch (err: any) {
      addNotification({ type: 'error', message: 'Failed to read file' });
    }
  };

  const downloadImg = (img: GeneratedImage) => {
    downloadFile(`data:image/png;base64,${img.data}`, `image-${img.id}.png`);
  };

  if (!currentProject) {
    return (
      <div className="text-center p-10">
        <p className="text-gray-600">Create or select a project to manage images.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Image size={28} className="text-purple-600" />
        <h1 className="text-2xl font-bold text-gray-800">Image Generator</h1>
      </div>
      <div className="bg-white p-6 rounded shadow space-y-4">
        <textarea
          className="w-full border p-2 rounded"
          placeholder="Describe the coloring page you want to generate"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
        />
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Sparkles size={16} />
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
          <label className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer flex items-center gap-2">
            <UploadCloud size={16} /> Upload
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map(img => (
            <div key={img.id} className="border rounded p-2 bg-white flex flex-col">
              <img src={`data:image/png;base64,${img.data}`} alt="Generated" className="mb-2" />
              <div className="text-xs text-gray-600 truncate mb-2">{img.prompt}</div>
              <button
                onClick={() => downloadImg(img)}
                className="text-xs bg-green-500 text-white px-2 py-1 rounded flex items-center gap-1 justify-center"
              >
                <Download size={12} /> Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageGenerator;
