import type { Route } from "./+types/_index";
import { href, Link, useSubmit, useNavigation } from "react-router";
import { getAllBooks } from "../utils/db";
import { useRef } from "react";
import { TopBar } from "../components/TopBar";
import { preloadBook } from "../utils/preload";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Asimov - Reader" },
    { name: "description", content: "Supercharge your reading experience" },
  ];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {    
  await preloadBook(`${import.meta.env.BASE_URL}example.epub`);  
  const books = await getAllBooks();
  return { books };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { books } = loaderData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();
  const navigation = useNavigation();
  
  // Check if there's an active upload
  const isUploading = navigation.state === 'submitting';

  const handleDeleteClick = (e: React.MouseEvent, bookId: string) => {
    e.preventDefault(); // Prevent navigation to book detail
    e.stopPropagation(); // Stop event propagation

    if (confirm("Are you sure you want to delete this book?")) {
      // If this is the only book and we're deleting it, mark that the default was deleted
      // to prevent auto-reloading it
      if (books.length === 1) {
        localStorage.setItem('defaultBookDeleted', 'true');
      }
      
      submit(null, {
        method: "DELETE",
        action: href("/books/:bookId", { bookId }),
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const formData = new FormData();
      const file = e.target.files[0];
      formData.append("epubFile", file);

      submit(formData, {
        method: "POST",
        action: href("/books/new"),
        encType: "multipart/form-data",
      });
    }
  };

  // Handle restoring the default book
  const handleRestoreDefaultBook = async () => {
    // Clear the flag that prevents loading the default book
    localStorage.removeItem('defaultBookDeleted');
    
    // Preload the default book 
    await preloadBook(`${import.meta.env.BASE_URL}pg84-images-3.epub`);
    
    // Refresh the page to show the newly added book
    window.location.reload();
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Use the shared TopBar component */}
      <TopBar currentPage="library" />

      {/* Hidden file input for uploading */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".epub"
        className="hidden"
        name="epubFile"
      />

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6 mt-14">
        <h2 className="text-2xl font-bold mb-6">Your Library</h2>

        {/* Book Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {/* Add New Book Card (always first) */}
          <div
            className={`flex flex-col overflow-hidden rounded-lg border-2 border-dashed ${isUploading ? 'border-blue-300 bg-blue-50 opacity-75 cursor-not-allowed' : 'border-gray-300 hover:bg-gray-50 cursor-pointer'} transition-colors duration-200`}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <div className="relative pb-[150%] w-full bg-gray-50 flex items-center justify-center">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isUploading ? (
                  <svg 
                    className="w-16 h-16 text-blue-500 animate-spin" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg
                    className="w-16 h-16 text-blue-500 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                )}
                <span className="text-blue-500 font-medium text-xl">
                  {isUploading ? 'Uploading...' : 'Add a new book'}
                </span>
              </div>
            </div>
            <div className="p-4 bg-white flex-grow">
              <span className="text-sm text-gray-500">
                {isUploading 
                  ? `Processing EPUB file...`
                  : 'Click to upload an EPUB file'
                }
              </span>
            </div>
          </div>

          {/* Book Cards */}
          {books.map((book) => (
            <Link
              key={book.id}
              to={href("/books/:bookId", { bookId: book.id })}
              className="flex flex-col overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 relative"
            >
              <div className="relative pb-[150%] bg-gray-200">
                <img
                  src={URL.createObjectURL(book.cover)}
                  alt={`Cover for ${book.title}`}
                  className="absolute top-0 left-0 w-full h-full object-cover"
                />
              </div>
              <div className="p-4 bg-white flex-grow">
                <h3 className="font-semibold text-gray-800 line-clamp-2">
                  {book.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {book.authors.join(", ")}
                </p>
                {book.location && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${book.location.percentage * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.round(book.location.percentage * 100)}% completed
                    </p>
                  </div>
                )}
              </div>
              {/* Delete Button */}
              <button
                onClick={(e) => handleDeleteClick(e, book.id)}
                className="absolute bottom-2 right-2 p-1.5 bg-white rounded-full shadow hover:bg-red-50 transition-colors"
                aria-label={`Delete ${book.title}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 text-red-500"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
