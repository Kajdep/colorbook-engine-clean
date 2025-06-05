import { Project, StoryPage } from '../types';
import { AIService } from '../utils/aiService';

export async function generateImagesForProject(project: Project, ai: AIService, onProgress?: (completed: number, total: number) => void) {
  const pages = project.pages.filter(p => p.content.imagePrompt);
  const total = pages.length;
  let completed = 0;

  for (const page of pages) {
    if (page.content.imagePrompt) {
      const url = await ai.generateImage(page.content.imagePrompt);
      page.content.imageData = url;
    }
    completed++;
    onProgress?.(completed, total);
  }
}

