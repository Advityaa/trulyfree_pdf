import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, FileEdit, Combine, Split, Trash2, FileText, FileImage, PenTool, Shield, Lock, Unlock, Minimize, ScanText } from 'lucide-react';
import '../App.css';

const TOOL_CATEGORIES = [
  {
    title: 'Organize',
    tools: [
      { id: 'merge', name: 'Merge PDF', icon: Combine, path: '/tool/merge' },
      { id: 'split', name: 'Split PDF', icon: Split, path: '/tool/split' },
      { id: 'remove', name: 'Remove Pages', icon: Trash2, path: '/tool/remove' },
    ]
  },
  {
    title: 'Optimize',
    tools: [
      { id: 'compress', name: 'Compress PDF', icon: Minimize, path: '/tool/compress' },
    ]
  },
  {
    title: 'Convert',
    tools: [
      { id: 'pdf-to-jpg', name: 'PDF to JPG', icon: FileImage, path: '/tool/pdf-to-jpg' },
      { id: 'ocr', name: 'OCR PDF', icon: ScanText, path: '/tool/ocr' },
    ]
  },
  {
    title: 'Edit and sign',
    tools: [
      { id: 'editor', name: 'PDF Editor', icon: PenTool, path: '/editor' },
      { id: 'sign', name: 'Sign PDF', icon: FileEdit, path: '/editor' },
    ]
  }
];

export default function Home() {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const fileUrl = URL.createObjectURL(file);
      // By default, dropzone goes to the full editor.
      navigate('/editor', { state: { file, url: fileUrl } });
    } else {
      alert("That file isn't a pdf. Choose a pdf file to continue.");
    }
  };

  const handleToolClick = (toolPath) => {
    navigate(toolPath);
  };

  return (
    <div className="home-container" style={{ minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5rem 2rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem', color: '#171717' }}>
          <FileEdit size={24} color="#3b82f6" />
          TrulyFree PDF
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <a href="#tools" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 500 }}>All tools</a>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No sign-up, no ads</span>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 2rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 700, textAlign: 'center', marginBottom: '1rem', color: '#171717', letterSpacing: '-0.02em' }}>
          Every pdf tool, free from start to finish
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#64748b', marginBottom: '3rem' }}>
          Drop a file in or pick a tool below
        </p>

        <div 
          className="upload-overlay glass-panel" 
          onClick={() => fileInputRef.current?.click()}
          style={{ width: '100%', maxWidth: '600px', marginBottom: '1rem' }}
        >
          <FileUp className="upload-icon" />
          <h2 style={{ fontSize: '1.5rem', color: '#171717', marginBottom: '0.5rem' }}>Drop your pdf here or browse files</h2>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf" 
            className="hidden-input"
          />
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '5rem' }}>No sign-up, no ads</p>

        <section id="tools" style={{ width: '100%', maxWidth: '1000px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
            {TOOL_CATEGORIES.map(category => (
              <div key={category.title}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#171717', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {category.title}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {category.tools.map(tool => (
                    <button 
                      key={tool.id} 
                      onClick={() => handleToolClick(tool.path)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        padding: '1rem', 
                        background: 'white', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'all 0.2s',
                        color: '#171717',
                        fontWeight: 500
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'none'; }}
                    >
                      <tool.icon size={20} color="#3b82f6" />
                      {tool.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
