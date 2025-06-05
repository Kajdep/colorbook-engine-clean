# 🎨 ColorBook Engine

**Professional AI-Powered Coloring Book Creation Platform**

A comprehensive tool for creating professional-quality coloring books with AI-generated stories, images, and publishing-ready PDFs.

## 🌟 Features

### 🚧 Current Features
- **🎨 Story Generation**: AI-powered stories with customizable themes, characters, and image prompts
- **📁 Project Management**: Create, organize, duplicate, and manage multiple coloring book projects
- **🖼️ Image Generation**: Real AI APIs (OpenAI, Stability AI, Replicate) with advanced SVG fallbacks
- **🎨 Digital Canvas**: Professional drawing tools with brushes, colors, templates, and undo/redo
- **📄 PDF Export**: Print-ready PDFs with professional formatting and KDP compliance
- **✅ KDP Compliance**: Comprehensive Amazon KDP requirements checker
- **⚙️ Settings**: API configuration, project settings, and preferences
- **🔔 Notifications**: Real-time feedback system with toast notifications
- **💾 Persistent Storage**: Manage and back up all projects with IndexedDB and
  local backups
- **📱 Responsive**: Works perfectly on desktop, tablet, and mobile devices

### 🎯 AI Integration
- **OpenRouter API**: GPT-4, Claude, Llama for story generation
- **OpenAI DALL-E**: High-quality AI image generation
- **Stability AI**: Stable Diffusion for creative artwork
- **Replicate**: Alternative AI models for variety
- **Smart Fallbacks**: 10+ beautiful SVG templates when APIs are unavailable

### 📚 Professional Publishing
- **KDP Ready**: Amazon Kindle Direct Publishing compliance checker
- **Print Quality**: 300 DPI, proper margins, bleed areas
- **Multiple Formats**: Letter, A4, Square, Custom sizes
- **Professional Layout**: Story pages, coloring pages, covers, copyright

## 🚀 Quick Start

### Installation
```bash
cd C:\Users\kajal\build\colorbook-engine-clean
npm install
npm run dev
```

Or double-click: `start-dev.bat`

### Configuration
1. Open the app at `http://localhost:5173`
2. Go to **Settings** (⚙️)
3. Add your **OpenRouter API key**
4. Configure image generation APIs (optional)
5. Start creating!

## 📖 Usage Guide

### 1. Create a Project
- Dashboard → "Create New Project"
- Add title, description, and metadata
- Set target age group and theme

### 2. Generate Story
- Story Generator → Fill in theme and characters
- Customize age range, page count, style
- Click "Generate Story with Image Prompts"
- Watch as AI creates your story with detailed image descriptions

### 3. Generate Images
- Click "Generate Image" on any story page
- Choose from multiple AI providers
- Download as SVG or PNG
- Regenerate for variations

### 4. Create Custom Art
- Drawing Canvas → Use professional tools
- Multiple brush sizes and colors
- Templates for quick starts
- Save and export your creations

### 5. Export PDF
- PDF Export → Select your project
- Choose page size and orientation
- Configure margins and layout
- Download print-ready PDF

### 6. Check Compliance
- KDP Compliance → Select project
- Run comprehensive checks
- Fix any issues found
- Get publishing readiness score

## 🛠️ Technical Details

### Architecture
- **React 18** with TypeScript
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Vite** for fast development
- **jsPDF** for PDF generation
- **Fabric.js** for canvas drawing

### Project Structure
```
src/
├── components/          # React components
│   ├── Dashboard.tsx    # Main dashboard
│   ├── Projects.tsx     # Project management
│   ├── StoryGenerator.tsx # AI story creation
│   ├── DrawingCanvas.tsx  # Digital canvas
│   ├── PDFExport.tsx      # PDF generation
│   ├── KDPCompliance.tsx  # Compliance checker
│   └── ...
├── store/               # State management
├── types/               # TypeScript definitions
├── utils/               # Utility functions
└── styles/              # CSS and styling
```

## 🚧 Development Status

ColorBook Engine is actively being developed. Core functionality like story and image generation is working, but features such as payments, authentication and cloud sync are still in progress.

### How to Run
```bash
cd C:\Users\kajal\build\colorbook-engine-clean
npm install
npm run dev
```

### Database Backups
Use the `backend/backup.sh` script to create PostgreSQL dumps. Ensure `.env` contains your database credentials and run:

```bash
cd backend
./backup.sh
```
Backups are stored in the `backups` directory unless another path is provided.

### Rate Limiting
The backend's request limits can be configured with two environment variables:

- `RATE_LIMIT_POINTS` – maximum number of requests allowed
- `RATE_LIMIT_DURATION` – time window in seconds

Update these values in `.env` or your production configuration to tune API rate
limits for your deployment.
- The backend relies on **rate-limiter-flexible** v7.1.1 for in-memory limiting.

## License

This project is licensed under the [MIT License](LICENSE).

---

*From messy prototype to a more polished yet still evolving application.*
