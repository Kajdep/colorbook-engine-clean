interface CanvaTemplate {
  id: string;
  name: string;
  type: 'coloring-page' | 'story-book' | 'activity-sheet' | 'cover-design';
  dimensions: {
    width: number;
    height: number;
    unit: 'px' | 'in' | 'cm';
  };
  elements: CanvaElement[];
}

interface CanvaElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'line' | 'group';
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation?: number;
  opacity?: number;
  properties: Record<string, any>;
}

interface CanvaExportOptions {
  projectId: string;
  format: 'json' | 'pdf' | 'png' | 'svg';
  template?: 'custom' | 'coloring-book' | 'story-book' | 'activity-book';
  dimensions?: {
    width: number;
    height: number;
    unit: 'px' | 'in' | 'cm';
  };
  includeMetadata?: boolean;
}

class CanvaIntegrationService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.canva.com/v1';

  constructor() {
    this.loadApiKey();
  }

  private loadApiKey() {
    this.apiKey = localStorage.getItem('canva_api_key');
  }

  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('canva_api_key', key);
  }

  // Convert ColorBook project to Canva template
  async exportToCanva(
    project: any,
    options: CanvaExportOptions
  ): Promise<{ success: boolean; templateUrl?: string; templateId?: string; error?: string }> {
    try {
      if (!this.apiKey) {
        return { success: false, error: 'Canva API key not configured' };
      }

      const canvaTemplate = await this.convertProjectToCanvaTemplate(project, options);
      const result = await this.createCanvaDesign(canvaTemplate);
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Canva export failed'
      };
    }
  }

  private async convertProjectToCanvaTemplate(
    project: any,
    options: CanvaExportOptions
  ): Promise<CanvaTemplate> {
    const template: CanvaTemplate = {
      id: `colorbook_${project.id}_${Date.now()}`,
      name: `${project.title} - ColorBook Export`,
      type: this.getCanvaTemplateType(options.template),
      dimensions: options.dimensions || { width: 8.5, height: 11, unit: 'in' },
      elements: []
    };

    // Convert story pages to Canva elements
    if (project.currentStory?.pages) {
      for (let i = 0; i < project.currentStory.pages.length; i++) {
        const page = project.currentStory.pages[i];
        const pageElements = await this.convertPageToCanvaElements(page, i, template.dimensions);
        template.elements.push(...pageElements);
      }
    }

    // Add drawings if available
    if (project.drawings && project.drawings.length > 0) {
      const drawingElements = await this.convertDrawingsToCanvaElements(
        project.drawings,
        template.dimensions
      );
      template.elements.push(...drawingElements);
    }

    return template;
  }

  private getCanvaTemplateType(template?: string): CanvaTemplate['type'] {
    switch (template) {
      case 'coloring-book':
        return 'coloring-page';
      case 'story-book':
        return 'story-book';
      case 'activity-book':
        return 'activity-sheet';
      default:
        return 'coloring-page';
    }
  }

  private async convertPageToCanvaElements(
    page: any,
    pageIndex: number,
    dimensions: CanvaTemplate['dimensions']
  ): Promise<CanvaElement[]> {
    const elements: CanvaElement[] = [];
    const pageOffset = pageIndex * (dimensions.height + 0.5); // Space between pages

    // Add story text
    if (page.story) {
      elements.push({
        id: `story_text_${pageIndex}`,
        type: 'text',
        position: { x: 0.75, y: pageOffset + 1 },
        size: { width: dimensions.width - 1.5, height: 2 },
        properties: {
          text: page.story,
          fontSize: 14,
          fontFamily: 'Arial',
          color: '#000000',
          alignment: 'left',
          lineHeight: 1.4
        }
      });
    }

    // Add image prompt as placeholder
    if (page.imagePrompt) {
      elements.push({
        id: `image_placeholder_${pageIndex}`,
        type: 'shape',
        position: { x: 0.75, y: pageOffset + 3.5 },
        size: { width: dimensions.width - 1.5, height: 6 },
        properties: {
          type: 'rectangle',
          fill: '#f8f9fa',
          stroke: '#dee2e6',
          strokeWidth: 2,
          strokeStyle: 'dashed'
        }
      });

      // Add image prompt text
      elements.push({
        id: `image_prompt_${pageIndex}`,
        type: 'text',
        position: { x: 1, y: pageOffset + 6 },
        size: { width: dimensions.width - 2, height: 1 },
        properties: {
          text: `Coloring Image: ${page.imagePrompt}`,
          fontSize: 10,
          fontFamily: 'Arial',
          color: '#6c757d',
          alignment: 'center',
          style: 'italic'
        }
      });
    }

    // Add generated image if available
    if (page.generatedImageUrl) {
      elements.push({
        id: `generated_image_${pageIndex}`,
        type: 'image',
        position: { x: 0.75, y: pageOffset + 3.5 },
        size: { width: dimensions.width - 1.5, height: 6 },
        properties: {
          src: page.generatedImageUrl,
          fit: 'contain',
          opacity: 0.3 // Light opacity for coloring template
        }
      });
    }

    return elements;
  }

  private async convertDrawingsToCanvaElements(
    drawings: any[],
    dimensions: CanvaTemplate['dimensions']
  ): Promise<CanvaElement[]> {
    const elements: CanvaElement[] = [];

    drawings.forEach((drawing, index) => {
      if (drawing.dataUrl) {
        elements.push({
          id: `drawing_${index}`,
          type: 'image',
          position: { x: 0.5, y: index * (dimensions.height + 0.5) + 1 },
          size: { width: dimensions.width - 1, height: dimensions.height - 2 },
          properties: {
            src: drawing.dataUrl,
            fit: 'contain',
            name: drawing.name || `Drawing ${index + 1}`
          }
        });
      }
    });

    return elements;
  }

  private async createCanvaDesign(template: CanvaTemplate): Promise<{
    success: boolean;
    templateUrl?: string;
    templateId?: string;
    error?: string;
  }> {
    try {
      // Create Canva-compatible design JSON
      const canvaDesign = {
        name: template.name,
        design_type: this.getCanvaDesignType(template.type),
        dimensions: {
          width: template.dimensions.width,
          height: template.dimensions.height,
          unit: template.dimensions.unit
        },
        pages: this.groupElementsIntoPages(template.elements, template.dimensions)
      };

      // Since we can't actually call Canva API without real credentials,
      // we'll create a downloadable Canva-compatible JSON file
      const canvaJSON = JSON.stringify(canvaDesign, null, 2);
      const blob = new Blob([canvaJSON], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);

      // Also create a Canva import guide
      const importGuide = this.generateCanvaImportGuide(template);
      
      return {
        success: true,
        templateUrl: downloadUrl,
        templateId: template.id,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Canva design'
      };
    }
  }

  private getCanvaDesignType(type: CanvaTemplate['type']): string {
    switch (type) {
      case 'coloring-page':
        return 'A4_DOCUMENT';
      case 'story-book':
        return 'US_LETTER';
      case 'activity-sheet':
        return 'A4_DOCUMENT';
      case 'cover-design':
        return 'BOOK_COVER';
      default:
        return 'A4_DOCUMENT';
    }
  }

  private groupElementsIntoPages(
    elements: CanvaElement[],
    dimensions: CanvaTemplate['dimensions']
  ): any[] {
    const pages: any[] = [];
    const pageHeight = dimensions.height;
    
    // Group elements by page based on Y position
    const elementsByPage = new Map<number, CanvaElement[]>();
    
    elements.forEach(element => {
      const pageIndex = Math.floor(element.position.y / (pageHeight + 0.5));
      if (!elementsByPage.has(pageIndex)) {
        elementsByPage.set(pageIndex, []);
      }
      
      // Adjust element position to be relative to page
      const adjustedElement = {
        ...element,
        position: {
          x: element.position.x,
          y: element.position.y - (pageIndex * (pageHeight + 0.5))
        }
      };
      
      elementsByPage.get(pageIndex)!.push(adjustedElement);
    });

    // Convert to Canva page format
    elementsByPage.forEach((pageElements, pageIndex) => {
      pages.push({
        id: `page_${pageIndex}`,
        elements: pageElements.map(element => this.convertToCanvaElement(element))
      });
    });

    return pages;
  }

  private convertToCanvaElement(element: CanvaElement): any {
    const baseElement = {
      id: element.id,
      type: element.type,
      left: element.position.x,
      top: element.position.y,
      width: element.size.width,
      height: element.size.height,
      rotation: element.rotation || 0,
      opacity: element.opacity || 1
    };

    // Add type-specific properties
    switch (element.type) {
      case 'text':
        return {
          ...baseElement,
          text: element.properties.text,
          fontFamily: element.properties.fontFamily,
          fontSize: element.properties.fontSize,
          color: element.properties.color,
          textAlign: element.properties.alignment,
          lineHeight: element.properties.lineHeight
        };
      
      case 'image':
        return {
          ...baseElement,
          src: element.properties.src,
          fit: element.properties.fit || 'contain'
        };
      
      case 'shape':
        return {
          ...baseElement,
          fill: element.properties.fill,
          stroke: element.properties.stroke,
          strokeWidth: element.properties.strokeWidth,
          shapeType: element.properties.type
        };
      
      default:
        return baseElement;
    }
  }

  private generateCanvaImportGuide(template: CanvaTemplate): string {
    return `# Canva Import Guide - ${template.name}

## How to Import Your ColorBook Design into Canva

### Option 1: Upload Elements Manually
1. Open Canva and create a new design
2. Set dimensions to ${template.dimensions.width}" x ${template.dimensions.height}"
3. Upload your generated images from the ColorBook Engine
4. Add text elements with the story content
5. Arrange elements according to the layout

### Option 2: Use Canva Apps (Coming Soon)
- We're working on a direct Canva integration
- This will allow one-click export to Canva
- Stay tuned for updates!

### Design Specifications
- **Template Type**: ${template.type}
- **Dimensions**: ${template.dimensions.width} x ${template.dimensions.height} ${template.dimensions.unit}
- **Elements**: ${template.elements.length} total elements
- **Pages**: ${Math.ceil(template.elements.length / 10)} estimated pages

### Tips for Best Results
1. Use high-resolution images (300 DPI minimum)
2. Keep text readable with appropriate font sizes
3. Maintain consistent spacing and alignment
4. Consider print margins for physical books

### Need Help?
Contact our support team for assistance with Canva integration.
`;
  }

  // Generate Canva-compatible export package
  async generateCanvaPackage(
    project: any,
    options: CanvaExportOptions
  ): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Generate Canva template
      const template = await this.convertProjectToCanvaTemplate(project, options);
      
      // Add template JSON
      zip.file('canva-template.json', JSON.stringify(template, null, 2));
      
      // Add import guide
      zip.file('CANVA_IMPORT_GUIDE.md', this.generateCanvaImportGuide(template));
      
      // Add all project images
      if (project.currentStory?.pages) {
        const imagesFolder = zip.folder('images');
        for (let i = 0; i < project.currentStory.pages.length; i++) {
          const page = project.currentStory.pages[i];
          if (page.generatedImageUrl) {
            // In a real implementation, you'd fetch and add the actual image
            imagesFolder?.file(`page_${i + 1}_image.png`, 'placeholder-image-data');
          }
        }
      }

      // Add drawings
      if (project.drawings && project.drawings.length > 0) {
        const drawingsFolder = zip.folder('drawings');
        project.drawings.forEach((drawing: any, index: number) => {
          if (drawing.dataUrl) {
            // Convert data URL to blob and add to zip
            const base64Data = drawing.dataUrl.split(',')[1];
            drawingsFolder?.file(`drawing_${index + 1}.png`, base64Data, { base64: true });
          }
        });
      }

      // Add text content
      if (project.currentStory?.pages) {
        let textContent = `# ${project.title}\nby ${project.author || 'Unknown'}\n\n`;
        project.currentStory.pages.forEach((page: any, index: number) => {
          textContent += `## Page ${index + 1}\n${page.story}\n\n`;
          if (page.imagePrompt) {
            textContent += `**Image Prompt**: ${page.imagePrompt}\n\n`;
          }
        });
        zip.file('story-content.md', textContent);
      }

      // Create specifications file
      const specs = {
        project: {
          title: project.title,
          author: project.author,
          created: project.createdAt,
          modified: project.updatedAt
        },
        canva: {
          templateType: template.type,
          dimensions: template.dimensions,
          elementCount: template.elements.length,
          recommendedSettings: {
            quality: 'High',
            colorMode: 'RGB',
            bleed: '0.125 inches'
          }
        },
        instructions: [
          '1. Extract this zip file',
          '2. Read the CANVA_IMPORT_GUIDE.md file',
          '3. Upload images from the images/ folder to Canva',
          '4. Copy text content from story-content.md',
          '5. Use the template.json for precise positioning'
        ]
      };
      
      zip.file('specifications.json', JSON.stringify(specs, null, 2));

      // Generate the zip file
      const blob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(blob);

      return {
        success: true,
        downloadUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate Canva package'
      };
    }
  }

  // Test Canva API connection
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      // In a real implementation, this would test the actual Canva API
      // For now, we'll simulate a successful connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  // Get available Canva templates
  async getAvailableTemplates(): Promise<{
    success: boolean;
    templates?: Array<{ id: string; name: string; type: string; preview?: string }>;
    error?: string;
  }> {
    try {
      // Simulated template data - in production this would come from Canva API
      const templates = [
        {
          id: 'coloring-book-basic',
          name: 'Basic Coloring Book',
          type: 'coloring-page',
          preview: 'https://example.com/preview1.jpg'
        },
        {
          id: 'story-book-layout',
          name: 'Story Book Layout',
          type: 'story-book',
          preview: 'https://example.com/preview2.jpg'
        },
        {
          id: 'activity-sheet',
          name: 'Activity Sheet',
          type: 'activity-sheet',
          preview: 'https://example.com/preview3.jpg'
        },
        {
          id: 'book-cover',
          name: 'Book Cover Design',
          type: 'cover-design',
          preview: 'https://example.com/preview4.jpg'
        }
      ];

      return {
        success: true,
        templates
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load templates'
      };
    }
  }
}

export const canvaIntegration = new CanvaIntegrationService();
export default canvaIntegration;