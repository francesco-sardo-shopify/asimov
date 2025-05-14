import type { Route } from "./+types/books.$bookId";
import { useRef, useEffect, useState, useCallback } from "react";
import { href, redirect } from "react-router";
import * as EPUBJS from "epubjs";
import { deleteBook, getBook, updateBook } from "../utils/db";
import { TopBar } from "../components/TopBar";

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

  // Main effect to initialize the book
  useEffect(() => {
    if (!viewerRef.current) return;

    // Clean up previous instances
    if (bookRef.current) {
      bookRef.current.destroy();
    }

    // Create an EPUB.js book instance
    bookRef.current = EPUBJS.default(arrayBuffer);
    bookRef.current.locations.load(book.locations.toString());
    
    // Render the book
    const rendition = bookRef.current.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      spread: "none"
    });
    renditionRef.current = rendition;

    // Load the saved location if available
    const startReading = async () => {
      await bookRef.current.ready;
      
      // Display at the last known location or saved location
      if (lastLocationRef.current) {
        rendition.display(lastLocationRef.current);
      } else if (book.location) {
        rendition.display(book.location.start);
        lastLocationRef.current = book.location.start;
      } else {
        rendition.display();
      }

      // Load table of contents properly
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

    // Save location when user navigates
    const saveLocation = async (location: any) => {      
      const { start, end, percentage } = location;
      // Save to ref for viewport changes
      if (start) {
        lastLocationRef.current = start;
      }
      // Save to database
      await updateBook({
        ...book,
        location: { start, end, percentage },
      });
    };

    rendition.on("locationChanged", saveLocation);

    // Attach keyboard listener
    document.addEventListener("keyup", handleKeyUp, true);

    return () => {
      document.removeEventListener("keyup", handleKeyUp, true);
      if (renditionRef.current) {
        renditionRef.current.off("locationChanged", saveLocation);
      }
      if (bookRef.current) {
        bookRef.current.destroy();
      }
    };
  }, [arrayBuffer, book]);

  // Add a separate effect to ensure keyboard navigation is always available
  useEffect(() => {
    document.addEventListener("keyup", handleKeyUp, true);
    
    return () => {
      document.removeEventListener("keyup", handleKeyUp, true);
    };
  }, []);

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
      <TopBar currentPage="reader" bookId={book.id}>
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
      </div>
      
      {/* Navigation controls - positioned above the book content */}
      <div 
        className="absolute inset-x-0 bottom-0 flex z-10 pointer-events-none"
        style={{ 
          top: 'calc(56px + env(safe-area-inset-top))',
          height: viewportHeight ? 
            `calc(${viewportHeight}px - 56px - env(safe-area-inset-top))` : 
            'calc(100dvh - 56px - env(safe-area-inset-top))'
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
