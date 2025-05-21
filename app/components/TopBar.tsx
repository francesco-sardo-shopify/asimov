import { Link } from "react-router";
import type { ReactNode } from "react";

type TopBarProps = {
  currentPage: "library" | "reader" | "chat" | "settings";
  bookId?: string; // For reader and chat pages
  children?: ReactNode;
  onToggleHighlightsPanel?: () => void; // New prop
};

export function TopBar({ currentPage, bookId, children, onToggleHighlightsPanel }: TopBarProps) {
  const isLibraryPage = currentPage === "library";

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-10 bg-blue-600 shadow-md safe-top">
      <div className="container mx-auto px-4 h-14 flex justify-between items-center">
        {/* Left side with logo and back button if needed */}
        <div className="flex items-center">
          {/* Back button to the left of logo */}
          {!isLibraryPage && (
            <Link
              to="/"
              className="mr-2 text-white hover:text-blue-100"
              aria-label="Back to library"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6"
              >
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </Link>
          )}
          
          {/* Logo and app name in consistent position */}
          <div className="flex items-center space-x-2">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 text-blue-200 flex items-center justify-center">
                <img 
                  src={`${import.meta.env.BASE_URL}favicon.ico`} 
                  alt="Logo" 
                  className="w-6 h-6"
                />
              </div>
              <h1 className="text-white text-xl font-bold">Asimov</h1>
            </Link>
          </div>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center space-x-4">
          {/* Reader/Chat toggle when on book pages */}
          {(currentPage === "reader" || currentPage === "chat") && bookId && (
            <Link
              to={
                // TODO: Redirect to new chat if no chat exists
                currentPage === "reader"
                  ? `/books/${bookId}/chats`
                  : `/books/${bookId}`
              }
              className="text-white hover:text-blue-100 transition-colors"
              aria-label={currentPage === "reader" ? "Chat about this book" : "Read this book"}
            >
              {currentPage === "reader" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6"
                >
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6"
                >
                  <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z" />
                </svg>
              )}
            </Link>
          )}

          {/* Children elements (for additional buttons/controls) */}
          {/* Highlights Panel Toggle Button - Placed before other children like TOC button */}
          {currentPage === "reader" && onToggleHighlightsPanel && (
            <button
              onClick={onToggleHighlightsPanel}
              className="p-2 text-white hover:text-blue-100 transition-colors" // Added padding for easier clicking
              aria-label="Toggle highlights panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v1h2a1 1 0 011 1v3a1 1 0 01-1 1h-2v1a2 2 0 01-2 2H7a2 2 0 01-2-2v-1H3a1 1 0 01-1-1V6a1 1 0 011-1h2V5zM14 11h6M14 15h4" />
              </svg>
            </button>
          )}
          
          {children}

          {/* Settings gear icon - only shown on library page */}
          {currentPage === "library" && (
            <Link
              to="/settings"
              className="text-white hover:text-blue-100 transition-colors"
              aria-label="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6"
              >
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
