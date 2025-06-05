import { Project } from '../types';
import advancedPublishing from '../utils/advancedPublishing';

export interface BatchProgress {
  total: number;
  current: number;
}

export async function exportProjectsToPDF(projects: Project[], onProgress?: (p: BatchProgress) => void) {
  const total = projects.length;
  let current = 0;
  for (const project of projects) {
    await advancedPublishing.generateKDPPDF({
      title: project.title,
      author: project.metadata.author || 'Unknown',
      language: project.metadata.language || 'en',
      pages: project.pages.map(p => ({ type: 'coloring', content: p.content.text || '' }))
    });
    current++;
    onProgress?.({ total, current });
  }
}

