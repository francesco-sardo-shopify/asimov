import React, { useState, useMemo } from 'react'; // Add useMemo
import type { Highlight } from '../utils/db'; // Adjust path as needed

interface HighlightsPanelProps {
  isVisible: boolean;
  highlights: Highlight[];
  bookTitle?: string; // Optional: To display the current book's title
  onClose: () => void;
  onGoToHighlight: (cfiRange: string) => void;
  onEditNote: (highlightId: string) => void;
  onDeleteHighlight: (highlightId: string) => void;
  // Add onSearch later
}

export const HighlightsPanel: React.FC<HighlightsPanelProps> = ({
  isVisible,
  highlights,
  bookTitle,
  onClose,
  onGoToHighlight,
  onEditNote,
  onDeleteHighlight,
}) => {
  const [searchTerm, setSearchTerm] = useState(''); // State for the search term

  const filteredHighlights = useMemo(() => {
    if (!searchTerm.trim()) {
      return highlights; // No search term, return all highlights
    }
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return highlights.filter(hl => {
      const textMatch = hl.text.toLowerCase().includes(lowercasedSearchTerm);
      const noteMatch = hl.note?.toLowerCase().includes(lowercasedSearchTerm) || false;
      return textMatch || noteMatch;
    });
  }, [highlights, searchTerm]);

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '350px', // Or responsive width
        maxWidth: '90%',
        height: '100%',
        backgroundColor: 'white',
        boxShadow: '-2px 0 5px rgba(0,0,0,0.1)',
        zIndex: 105, // Ensure it's above most content but potentially below modals like NoteEditor
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)', // Account for notches
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.2em' }}>
          {bookTitle ? `Highlights: ${bookTitle}` : "Highlights"}
        </h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer' }}>
          &times;
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #eee' }}>
        <input
          type="search" // Use type="search" for better semantics and potential native clear button
          placeholder="Search highlights & notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box', // Ensures padding doesn't add to width
          }}
        />
      </div>

      <ul style={{ listStyle: 'none', padding: '16px', margin: 0, overflowY: 'auto', flexGrow: 1 }}>
        {filteredHighlights.length === 0 && (
          <p style={{ padding: '0 16px' }}> {/* Adjusted padding for consistency */}
            {searchTerm ? 'No highlights match your search.' : 'No highlights yet for this book.'}
          </p>
        )}
        {filteredHighlights.map((hl) => ( // Use filteredHighlights here
          <li key={hl.id} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <span 
                style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: hl.color, 
                  marginRight: '8px',
                  flexShrink: 0,
                }}
                title={`Color: ${hl.color}`}
              ></span>
              <p style={{ fontStyle: 'italic', color: '#555', margin: 0, flexGrow: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                "{hl.text.substring(0, 100)}{hl.text.length > 100 ? '...' : ''}"
              </p>
            </div>
            {hl.note && (
              <p style={{ fontSize: '0.9em', color: '#333', margin: '0 0 8px 20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <strong>Note:</strong> {hl.note}
              </p>
            )}
            <div style={{ marginLeft: '20px', display: 'flex', gap: '10px', fontSize: '0.9em' }}>
              <button onClick={() => onGoToHighlight(hl.cfiRange)} style={{ color: '#007bff', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                Go to Highlight
              </button>
              <button onClick={() => onEditNote(hl.id)} style={{ color: '#007bff', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                Edit Note
              </button>
              <button onClick={() => onDeleteHighlight(hl.id)} style={{ color: 'red', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
