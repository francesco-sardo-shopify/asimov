import React, { useState, useEffect } from 'react';

interface NoteEditorProps {
  initialText: string;
  onSave: (noteText: string) => void;
  onClose: () => void;
  position?: { top: number; left: number }; // Optional, for positioning near highlight
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ initialText, onSave, onClose, position }) => {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  const handleSave = () => {
    onSave(text);
  };

  return (
    <div 
      style={{
        position: position ? 'absolute' : 'fixed', // Position near highlight or centered
        top: position ? `${position.top}px` : '50%',
        left: position ? `${position.left}px` : '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
        background: 'white',
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        zIndex: 110, // Above highlight popup
        minWidth: '300px',
        maxWidth: '90vw', // Ensure it doesn't overflow viewport
      }}
      onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling up
    >
      <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Add/Edit Note</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        style={{ 
          width: '100%', 
          marginBottom: '15px', 
          border: '1px solid #ddd', 
          borderRadius: '4px',
          padding: '8px',
          boxSizing: 'border-box', // Ensure padding doesn't make it wider
        }}
        autoFocus
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button 
          onClick={onClose} 
          style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button 
          onClick={handleSave} 
          style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', background: '#007bff', color: 'white', cursor: 'pointer' }}
        >
          Save Note
        </button>
      </div>
    </div>
  );
};
