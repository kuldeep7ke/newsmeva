import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Trash2, Play, Settings2 } from 'lucide-react';
import '../mobile.css';

interface ScriptEntry {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

const STORAGE_KEY = 'newsmeva_scripts';

export default function ScriptEditor() {
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);
  const [currentScript, setCurrentScript] = useState<ScriptEntry | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [showList, setShowList] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setScripts(JSON.parse(saved));
      } catch {
        setScripts([]);
      }
    }
  }, []);

  const saveScripts = (newScripts: ScriptEntry[]) => {
    setScripts(newScripts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newScripts));
  };

  const handleCreateNew = () => {
    setCurrentScript(null);
    setTitle('');
    setContent('');
    setShowList(false);
  };

  const handleLoadScript = (script: ScriptEntry) => {
    setCurrentScript(script);
    setTitle(script.title);
    setContent(script.content);
    setShowList(false);
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    const newScript: ScriptEntry = {
      id: currentScript?.id || Date.now().toString(),
      title: title.trim(),
      content,
      updatedAt: new Date().toISOString(),
    };

    let newScripts;
    if (currentScript) {
      newScripts = scripts.map(s => s.id === currentScript.id ? newScript : s);
    } else {
      newScripts = [...scripts, newScript];
    }

    saveScripts(newScripts);
    setCurrentScript(newScript);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this script?')) {
      const newScripts = scripts.filter(s => s.id !== id);
      saveScripts(newScripts);
      if (currentScript?.id === id) {
        handleCreateNew();
      }
    }
  };

  const handleBack = () => {
    setShowList(true);
    setCurrentScript(null);
  };

  if (showList) {
    return (
      <div className="mobile-screen">
        <div className="header">
          <h1>Script Editor</h1>
          <button onClick={handleCreateNew} className="btn-primary">
            + New Script
          </button>
        </div>

        <div className="script-list">
          {scripts.length === 0 ? (
            <div className="empty-state">
              <p>No scripts yet. Create one!</p>
            </div>
          ) : (
            scripts.map(script => (
              <div key={script.id} className="script-item">
                <div className="script-title">{script.title}</div>
                <div className="script-meta">
                  {new Date(script.updatedAt).toLocaleString()}
                </div>
                <div className="script-actions">
                  <button onClick={() => handleLoadScript(script)} className="btn-icon">
                    <Play size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(script.id)} 
                    className="btn-icon btn-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-screen">
      <div className="toolbar">
        <button onClick={handleBack} className="btn-icon">
          <ArrowLeft size={24} />
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Script title..."
          className="script-title-input"
        />
        <button onClick={handleSave} className="btn-primary btn-small">
          <Save size={16} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your script here..."
        className="script-editor-textarea"
        spellCheck={false}
      />

      <div className="script-footer">
        <span>{content.length} characters</span>
        <button 
          onClick={() => setShowList(true)} 
          className="btn-secondary"
        >
          List
        </button>
      </div>
    </div>
  );
}
