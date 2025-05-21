import type { Route } from "./+types/books.$bookId";
import { useRef, useEffect, useState, useCallback } from "react";
import { href, redirect } from "react-router";
import * as EPUBJS from "epubjs";
import { 
  deleteBook, 
  getBook, 
  updateBook, 
  addHighlight, 
  getHighlightsByBook, // Added
  deleteHighlight,      // Added
  updateHighlight // Added
} from "../utils/db";
import type { Highlight } from "../utils/db"; // Import the Highlight interface
import { v4 as uuidv4 } from 'uuid';
import { TopBar } from "../components/TopBar";
import { NoteEditor } from '../components/NoteEditor'; // Added
import { HighlightsPanel } from '../components/HighlightsPanel'; // Added

// Basic structure for the popup
interface HighlightPopupProps {
  position: { top: number; left: number } | null;
  onSelectColor: (color: string) => void; // For new highlights
  onRemoveHighlight?: () => void; // For existing highlights
  onChangeColor?: (color: string) => void; // For existing highlights
  onAddNote?: () => void; // For existing highlights
  isExistingHighlight: boolean; // New prop
}

const HighlightPopup: React.FC<HighlightPopupProps> = ({ 
  position, 
  onSelectColor,
  onRemoveHighlight,
  onChangeColor, // Implement later
  onAddNote,    // Implement later
  isExistingHighlight 
}) => {
  if (!position) return null;
  const colors = ['yellow', 'limegreen', 'deepskyblue', 'hotpink']; // Example colors for new highlights

  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)', // Center the popup
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '8px',
        zIndex: 100, // Ensure it's above the book content
        display: 'flex',
        gap: '8px',
      }}
      // Prevent clicks inside the popup from deselecting text in the iframe
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {!isExistingHighlight && colors.map(color => (
        <button
          key={color}
          style={{
            width: '24px',
            height: '24px',
            backgroundColor: color,
            border: '1px solid #777',
            borderRadius: '50%',
            cursor: 'pointer',
            margin: '2px',
          }}
          onClick={() => onSelectColor(color)}
          aria-label={`Highlight ${color}`}
        />
      ))}
      {isExistingHighlight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {/* Placeholder for color change swatches if needed later */}
          {/* {colors.map(color => (
            <button key={color} style={{ width: '20px', height: '20px', backgroundColor: color, borderRadius: '50%' }} onClick={() => onChangeColor && onChangeColor(color)} />
          ))} */}
          <button onClick={onAddNote} style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>
            Add/Edit Note
          </button>
          <button onClick={onRemoveHighlight} style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', color: 'red' }}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
};

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Reading - Asimov` },
    { name: "description", content: "Read your book with Asimov" },
  ];
}

export async function clientAction({
  request,
  params,
}: Route.ClientActionArgs) {
  const method = request.method;
  const { bookId } = params;

  if (method === "DELETE") {
    await deleteBook(bookId);
    return redirect(href("/"));
  }
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { bookId } = params;
  const book = await getBook(bookId);
  const arrayBuffer = await book!.file.arrayBuffer();
  return { book, arrayBuffer };
}

export default function BookViewer({ loaderData }: Route.ComponentProps) {
  const { book, arrayBuffer } = loaderData;
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);
  const [tocVisible, setTocVisible] = useState(false);
  const [toc, setToc] = useState<any[]>([]);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const lastLocationRef = useRef<string | null>(null);

  // State for highlighting
  const [selectionCfiRange, setSelectionCfiRange] = useState<string | null>(null);
  const [selectionText, setSelectionText] = useState<string | null>(null);
  const [showHighlightPopup, setShowHighlightPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  
  // State for storing and managing loaded highlights
  const [currentBookHighlights, setCurrentBookHighlights] = useState<Highlight[]>([]);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [activeHighlightCfiRange, setActiveHighlightCfiRange] = useState<string | null>(null);

  // State for Note Editor
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [currentNoteText, setCurrentNoteText] = useState('');

  // State for Highlights Panel
  const [showHighlightsPanel, setShowHighlightsPanel] = useState(false);

  // Key event listener for navigation - defined outside of useEffect
  const handleKeyUp = (e: KeyboardEvent) => {
    e.preventDefault();
    if (!renditionRef.current) return;
    
    if (e.key === "ArrowRight") {
      renditionRef.current.next();
    } else if (e.key === "ArrowLeft") {
      renditionRef.current.prev();
    }
  };

  // Memoized function to update viewport height
  const updateViewportHeight = useCallback(() => {
    setViewportHeight(window.innerHeight);
  }, []);

  // Effect to handle viewport resize and changes in the address bar visibility
  useEffect(() => {
    // Debounce the resize handler
    let resizeTimer: number;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(updateViewportHeight, 150);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', updateViewportHeight);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', updateViewportHeight);
      clearTimeout(resizeTimer);
    };
  }, [updateViewportHeight]);

  // Main effect to initialize the book, EPUB.js setup, event listeners, and highlight loading
  useEffect(() => {
    // Ensure the viewer element is available
    if (!viewerRef.current) return;

    // Clean up previous instances
    if (bookRef.current) {
      bookRef.current.destroy();
    }

    // Create an EPUB.js book instance
    bookRef.current = EPUBJS.default(arrayBuffer);
    bookRef.current.locations.load(book.locations.toString()); // Load pre-calculated locations
    
    // Render the book to the viewerRef div
    const rendition = bookRef.current.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      spread: "none" // Use 'auto' for spread based on screen width or 'none' for single column
    });
    renditionRef.current = rendition;

    // --- Book Navigation and Table of Contents ---
    const startReading = async () => {
      await bookRef.current.ready; // Wait for the book to be fully processed
      
      // Display at the last known location or saved location from DB
      if (lastLocationRef.current) {
        rendition.display(lastLocationRef.current);
      } else if (book.location?.start) { // Ensure book.location and start CFI exist
        rendition.display(book.location.start);
        lastLocationRef.current = book.location.start;
      } else {
        rendition.display(); // Display from the beginning
      }

      // Load table of contents
      try {
        // First try to load the TOC from the EPUB's NCX
        const ncxToc = await bookRef.current.loaded.navigation;
        if (ncxToc && ncxToc.toc && ncxToc.toc.length > 0) {
          setToc(ncxToc.toc);
        } else {
          // Fallback to using spine items if NCX TOC is empty
          const spineItems = bookRef.current.spine.items;
          const fallbackToc = spineItems.map((item: any, index: number) => ({
            href: item.href,
            label: `Section ${index + 1}`,
            id: `spine-${index}`
          }));
          setToc(fallbackToc);
        }
      } catch (error) {
        console.error("Error loading table of contents:", error);
        // Create a fallback TOC from spine
        const spineItems = bookRef.current.spine.items;
        const fallbackToc = spineItems.map((item: any, index: number) => ({
          href: item.href,
          label: `Section ${index + 1}`,
          id: `spine-${index}`
        }));
        setToc(fallbackToc);
      }
    };

    startReading();

    // Save current reading location when user navigates
    const saveLocation = async (location: any) => {      
      const { start, end, percentage } = location;
      if (start) { // Ensure start CFI is valid
        lastLocationRef.current = start; // Update ref for immediate UI consistency on resize/etc.
        // Save to database (debouncing/throttling could be added here for performance)
        try {
          await updateBook({
            ...book, // Spread existing book data from loader
            location: { start, end, percentage },
          });
        } catch (dbError) {
          console.error("Failed to save book location:", dbError);
        }
      }
    };

    rendition.on("locationChanged", saveLocation);

    // Attach global keyboard listener for navigation (ArrowLeft, ArrowRight)
    document.addEventListener("keyup", handleKeyUp, true);

    // --- Text Selection and Highlighting Event Handling ---
    // Handles new text selection by the user
    const handleSelection = (cfiRange: string, contents: any) => {
      const rawSelectedText = contents.window.getSelection()?.toString();
      const selectedText = rawSelectedText ? rawSelectedText.trim() : "";

      if (selectedText !== '') {
        setSelectionCfiRange(cfiRange);
        setSelectionText(selectedText);
        

        const selectionRect = contents.window.getSelection()?.getRangeAt(0).getBoundingClientRect();
        const viewerRect = viewerRef.current?.getBoundingClientRect();
        
        if (selectionRect && viewerRect) {
          // Adjust for viewer's scroll position if viewerRef itself is scrollable
          // For this example, assuming viewerRect.top is relative to viewport, like selectionRect.top
          const scrollTop = viewerRef.current?.scrollTop || 0;
          const scrollLeft = viewerRef.current?.scrollLeft || 0;

          setPopupPosition({
            top: selectionRect.top + viewerRect.top - scrollTop - 40, // Adjust offset as needed (e.g. 40px above selection)
            left: selectionRect.left + viewerRect.left - scrollLeft + selectionRect.width / 2,
          });
        }
        setShowHighlightPopup(true); // Show popup after position is calculated
      } else {
        setShowHighlightPopup(false);
      }
    };

    const handleDeselection = () => {
      // Delay hiding the popup to allow click events on it
      setTimeout(() => {
        if (!document.getSelection() || document.getSelection()?.isCollapsed) {
            setShowHighlightPopup(false);
            setSelectionCfiRange(null);
            setSelectionText(null);
        }
      }, 100); // Small delay
    };

    rendition.on('selected', handleSelection);
    rendition.on('deselected', handleDeselection);

    // Load and display existing highlights from the database
    const loadAndDisplayHighlights = async () => {
      if (!book?.id || !renditionRef.current) return; // Guard against missing book ID or rendition
      try {
        const highlightsFromDB = await getHighlightsByBook(book.id);
        setCurrentBookHighlights(highlightsFromDB); // Update state with fetched highlights
        
        // Add each highlight as an annotation on the EPUB.js rendition
        highlightsFromDB.forEach(hl => {
          if (renditionRef.current && hl.cfiRange) { // Ensure rendition and CFI range are valid
            renditionRef.current.annotations.add(
              'highlight', // Type of annotation
              hl.cfiRange,   // CFI range of the highlight
              { id: hl.id }, // Data to associate with the annotation (e.g., highlight ID)
              (e: Event, annotation?: any) => { // Click event handler for the annotation
                e.stopPropagation(); 
                e.preventDefault();
                
                // Retrieve the highlight ID from the annotation's data
                const clickedHighlightId = annotation?.data?.id; 
                const clickedHighlight = highlightsFromDB.find(h => h.id === clickedHighlightId);

                if (clickedHighlight) {
                   setActiveHighlightId(clickedHighlight.id); // Set as active highlight
                   setActiveHighlightCfiRange(clickedHighlight.cfiRange); 
                   setSelectionCfiRange(null); // Clear any new text selection state
                   setSelectionText(null);
                   setShowHighlightPopup(true); // Show the highlight actions popup

                   // Calculate position for the popup
                   const viewerRect = viewerRef.current?.getBoundingClientRect();
                   if (viewerRect && e instanceof MouseEvent) {
                       // Attempt to get position from MouseEvent first
                       let clickX = e.clientX;
                       let clickY = e.clientY;
                       // If the event target is an SVG element (part of the highlight), use its bounding box
                       const targetElement = e.target as SVGElement;
                       if (targetElement && typeof targetElement.getBoundingClientRect === 'function') {
                           const highlightRect = targetElement.getBoundingClientRect();
                           clickX = highlightRect.left + highlightRect.width / 2;
                           clickY = highlightRect.top; 
                       }
                       setPopupPosition({
                           top: clickY - viewerRect.top - 50, // Offset popup above the click
                           left: clickX - viewerRect.left,    // Center horizontally
                       });
                   } else if (viewerRect && e.target instanceof Element) {
                       // Fallback for other event types or if MouseEvent coords are not ideal
                       const targetRect = (e.target as Element).getBoundingClientRect();
                        setPopupPosition({
                           top: targetRect.top - viewerRect.top - 50,
                           left: targetRect.left + targetRect.width / 2 - viewerRect.left,
                       });
                   }
                }
              },
              'custom-highlight', // CSS class for styling the annotation
              { fill: hl.color, 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' } // Styles for the highlight
            );
          }
        });
      } catch (dbError) {
        console.error("Failed to load and display highlights:", dbError);
      }
    };

    // --- Initialization and Cleanup ---
    // Wait for rendition and book to be ready before loading highlights
    if (renditionRef.current && bookRef.current) {
      bookRef.current.ready.then(() => {
        renditionRef.current.ready.then(() => {
            loadAndDisplayHighlights();
        });
      });
    }
    
    const previousHighlights = currentBookHighlights; // Capture current highlights for cleanup

    // Cleanup function for the useEffect hook
    return () => {
      document.removeEventListener("keyup", handleKeyUp, true); // Remove global keyboard listener
      if (renditionRef.current) {
        // Remove event listeners from the rendition
        renditionRef.current.off("locationChanged", saveLocation);
        renditionRef.current.off('selected', handleSelection);
        renditionRef.current.off('deselected', handleDeselection);
        
        // Remove all annotations for the highlights that were displayed
        previousHighlights.forEach(hl => {
          try {
            if (hl.cfiRange) { 
              renditionRef.current?.annotations.remove(hl.cfiRange, 'highlight');
            }
          } catch (annotError) {
            // Log warnings for annotation removal errors, as they are not critical for app stability
            console.warn(`Error removing annotation for CFI ${hl.cfiRange}:`, annotError);
          }
        });
      }
      // Destroy the EPUB.js book instance to free up resources
      if (bookRef.current) {
        bookRef.current.destroy();
      }
    };
  }, [arrayBuffer, book.id, book.locations, book.location]); // Dependencies for the main effect

  // --- Highlight Creation and Management Functions ---
  // Handles saving a new highlight when a color is selected from the popup
  const handleHighlightSelection = async (color: string) => {
    if (!selectionCfiRange || !selectionText || !bookRef.current || !renditionRef.current) return;

    const newHighlightData: Highlight = {
      id: uuidv4(),
      bookId: book.id, 
      cfiRange: selectionCfiRange,
      text: selectionText,
      color: color,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await addHighlight(newHighlightData);
      setCurrentBookHighlights(prev => [...prev, newHighlightData]); // Add to local state

      renditionRef.current.annotations.add(
        'highlight',
        selectionCfiRange,
        { id: newHighlightData.id }, 
        (e: Event, annotation: any) => { // Matching signature from loadAndDisplayHighlights
          e.stopPropagation();
          e.preventDefault();
          const clickedHighlightId = annotation.data.id;
          const clickedHighlight = currentBookHighlights.find(h => h.id === clickedHighlightId) || newHighlightData; // Check current highlights or the one just added

          if (clickedHighlight) {
             setActiveHighlightId(clickedHighlight.id);
             setActiveHighlightCfiRange(clickedHighlight.cfiRange);
             setSelectionCfiRange(null); 
             setSelectionText(null);
             setShowHighlightPopup(true);

             const viewerRect = viewerRef.current?.getBoundingClientRect();
             if (viewerRect && e instanceof MouseEvent) {
                 let clickX = e.clientX;
                 let clickY = e.clientY;
                 const targetElement = e.target as SVGElement;
                 if (targetElement && typeof targetElement.getBoundingClientRect === 'function') {
                     const highlightRect = targetElement.getBoundingClientRect();
                     clickX = highlightRect.left + highlightRect.width / 2;
                     clickY = highlightRect.top; 
                 }
                 setPopupPosition({
                     top: clickY - viewerRect.top - 50, 
                     left: clickX - viewerRect.left,
                 });
             } else if (viewerRect && e.target instanceof Element) {
                 const targetRect = (e.target as Element).getBoundingClientRect();
                  setPopupPosition({
                     top: targetRect.top - viewerRect.top - 50,
                     left: targetRect.left + targetRect.width / 2 - viewerRect.left,
                 });
             }
          }
        },
        'custom-highlight', 
        { fill: color, 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
      );

      setShowHighlightPopup(false);
      setSelectionCfiRange(null);
      setSelectionText(null);
    } catch (error) {
      console.error("Failed to save highlight:", error);
    }
  };

  const handleRemoveHighlight = async () => {
    if (!activeHighlightId || !activeHighlightCfiRange || !renditionRef.current) return;

    try {
      renditionRef.current.annotations.remove(activeHighlightCfiRange, 'highlight');
      await deleteHighlight(activeHighlightId);
      setCurrentBookHighlights(prev => prev.filter(hl => hl.id !== activeHighlightId));
      setShowHighlightPopup(false);
      setActiveHighlightId(null);
      setActiveHighlightCfiRange(null);
    } catch (error) {
      console.error("Failed to remove highlight:", error);
    }
  };

  // Placeholder for note editor functionality
  const handleOpenNoteEditor = () => {
    if (!activeHighlightId) return;
    const highlight = currentBookHighlights.find(hl => hl.id === activeHighlightId);
    setCurrentNoteText(highlight?.note || ''); // Set initial text from highlight
    setShowNoteEditor(true);
    setShowHighlightPopup(false); // Close the small highlight actions popup
  };

  const handleSaveNote = async (noteText: string) => {
    if (!activeHighlightId) return;

    const highlightToUpdate = currentBookHighlights.find(hl => hl.id === activeHighlightId);
    if (!highlightToUpdate) {
      console.error("Highlight not found for saving note");
      setShowNoteEditor(false);
      return;
    }

    const updatedHl = { ...highlightToUpdate, note: noteText, updatedAt: new Date() };

    try {
      await updateHighlight(updatedHl);
      setCurrentBookHighlights(prev => 
        prev.map(hl => hl.id === activeHighlightId ? updatedHl : hl)
      );
      setShowNoteEditor(false);
      setActiveHighlightId(null); // Clear active highlight after saving
    } catch (dbError) {
      console.error("Failed to save note:", dbError);
    }
  };

  // Removed duplicated handleSaveNote function

  // --- Highlights Panel Functions ---
  const toggleHighlightsPanel = useCallback(() => {
    setShowHighlightsPanel(prev => !prev);
  }, []);

  const handleGoToHighlight = (cfiRange: string) => {
    if (renditionRef.current) {
      renditionRef.current.display(cfiRange);
      setShowHighlightsPanel(false); // Optionally close panel
    }
  };

  const handleRemoveHighlightById = async (highlightId: string) => {
    const highlightToRemove = currentBookHighlights.find(hl => hl.id === highlightId);
    if (!highlightToRemove || !renditionRef.current) return;

    try {
        renditionRef.current.annotations.remove(highlightToRemove.cfiRange, 'highlight');
        await deleteHighlight(highlightId);
        setCurrentBookHighlights(prev => prev.filter(hl => hl.id !== highlightId));
        if (activeHighlightId === highlightId) {
            setShowHighlightPopup(false);
            setActiveHighlightId(null);
            setActiveHighlightCfiRange(null);
        }
    } catch (error) {
        console.error("Failed to remove highlight by ID:", error);
    }
 };

  const handleEditNoteForHighlight = (highlightId: string) => {
    setActiveHighlightId(highlightId);
    const highlight = currentBookHighlights.find(hl => hl.id === highlightId);
    if (highlight) {
        setCurrentNoteText(highlight.note || '');
        setShowNoteEditor(true);
        setShowHighlightPopup(false); 
        // setShowHighlightsPanel(false); // Optionally hide panel
    } else {
        console.error("Highlight not found for editing note:", highlightId);
    }
  };

  const handleNavigation = (direction: 'prev' | 'next') => {
    if (!renditionRef.current) {
      console.error("Rendition reference is not available");
      return;
    }
    
    if (direction === 'next') {
      renditionRef.current.next();
    } else {
      renditionRef.current.prev();
    }
  };

  const navigateToTocItem = (href: string) => {
    if (renditionRef.current) {
      try {
        renditionRef.current.display(href);
        lastLocationRef.current = href;
        setTocVisible(false);
      } catch (error) {
        console.error("Error navigating to section:", error);
      }
    }
  };

  return (
    <div className="flex flex-col h-dvh relative">
      {/* Use the shared TopBar component */}
      <TopBar 
        currentPage="reader" 
        bookId={book.id}
        onToggleHighlightsPanel={toggleHighlightsPanel} // Pass toggle function
      >
        {/* Table of contents button */}
        <button
          onClick={() => setTocVisible(!tocVisible)}
          className="ml-auto p-2 text-white hover:text-blue-100 transition-colors"
          aria-label="Toggle table of contents"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-6 w-6" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 6h16M4 12h16M4 18h7" 
            />
          </svg>
        </button>
      </TopBar>

      {/* Table of Contents Sidebar */}
      {tocVisible && (
        <div className="fixed inset-0 z-50 flex safe-top">
          <div 
            className="absolute inset-0 bg-black/30" 
            onClick={() => setTocVisible(false)}
          ></div>
          <div className="relative w-80 max-w-[80%] h-full bg-white shadow-lg overflow-auto z-10 ml-auto">
            <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg">Table of Contents</h3>
              <button 
                onClick={() => setTocVisible(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
              </button>
            </div>
            <ul className="p-4">
              {toc.length > 0 ? (
                toc.map((item, index) => (
                  <li key={index} className="py-2 border-b last:border-b-0">
                    <button
                      onClick={() => navigateToTocItem(item.href)}
                      className="text-left w-full hover:text-blue-600"
                    >
                      {item.label || item.id || `Section ${index + 1}`}
                    </button>
                    {item.subitems && item.subitems.length > 0 && (
                      <ul className="pl-4 mt-2">
                        {item.subitems.map((subitem: any, subIndex: number) => (
                          <li key={`${index}-${subIndex}`} className="py-1">
                            <button
                              onClick={() => navigateToTocItem(subitem.href)}
                              className="text-left w-full text-sm hover:text-blue-600"
                            >
                              {subitem.label || subitem.id || `Subsection ${subIndex + 1}`}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))
              ) : (
                <li className="py-2 text-gray-500 italic">
                  No table of contents available
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Book Viewer with tap areas */}
      <div
        ref={viewerRef}
        className="flex-grow overflow-hidden relative pt-14"
        style={{ 
          height: viewportHeight ? `${viewportHeight}px` : '100dvh',
          minHeight: 'calc(100dvh - 56px)',
        }}
        key={viewportHeight} // Force re-render when viewport height changes
      >
        {/* EPUB.js will render the book content here */}
        {/* Render Highlight Popup */}
        {showHighlightPopup && popupPosition && ( // selectionCfiRange is not needed if activeHighlightId is present
          <HighlightPopup
            position={popupPosition}
            onSelectColor={handleHighlightSelection}
            isExistingHighlight={!!activeHighlightId}
            onRemoveHighlight={activeHighlightId ? handleRemoveHighlight : undefined}
            onAddNote={activeHighlightId ? handleOpenNoteEditor : undefined}
            // onChangeColor will be added later
          />
        )}
        {/* Render Note Editor */}
        {showNoteEditor && activeHighlightId && (
          <NoteEditor
            initialText={currentNoteText}
            onSave={handleSaveNote}
            onClose={() => {
              setShowNoteEditor(false);
              setActiveHighlightId(null); // Clear active highlight if note editing is cancelled
            }}
            // Centered by default as per NoteEditor.tsx logic when position is not passed
          />
        )}
        <HighlightsPanel
          isVisible={showHighlightsPanel}
          highlights={currentBookHighlights}
          bookTitle={book?.title}
          onClose={() => setShowHighlightsPanel(false)}
          onGoToHighlight={handleGoToHighlight}
          onEditNote={handleEditNoteForHighlight}
          onDeleteHighlight={handleRemoveHighlightById}
        />
      </div>
      
      {/* Navigation controls - positioned above the book content */}
      <div 
        className="absolute inset-x-0 bottom-0 flex z-10 pointer-events-none"
        style={{ 
          top: 'calc(56px + env(safe-area-inset-top))', // Ensure this respects TopBar height
          height: viewportHeight ? 
            `calc(${viewportHeight - 56}px - env(safe-area-inset-top))` : // Adjusted for TopBar
            `calc(100dvh - 56px - env(safe-area-inset-top))`
        }}
      >
        <button 
          className="w-1/3 h-full bg-transparent cursor-pointer hover:bg-black/5 active:bg-black/10 transition-colors focus:outline-none pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            handleNavigation('prev');
          }}
          aria-label="Previous page"
        ></button>
        <div className="w-1/3 h-full"></div>
        <button 
          className="w-1/3 h-full bg-transparent cursor-pointer hover:bg-black/5 active:bg-black/10 transition-colors focus:outline-none pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            handleNavigation('next');
          }}
          aria-label="Next page"
        ></button>
      </div>
    </div>
  );
}
