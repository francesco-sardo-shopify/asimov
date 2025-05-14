import { addBook } from './db';
import { parseEpub } from './epub';

/**
 * Preloads a book from the assets folder if it doesn't already exist in the database
 * @param epubPath The path to the EPUB file in the assets folder
 * @returns A promise that resolves when the book is preloaded
 */
export async function preloadBook(epubPath: string): Promise<void> {
  const preloadDone = localStorage.getItem('preloadDone') === 'true';
  if (preloadDone) {
    return;
  }
  try {        
    // Fetch the book file from assets
    const response = await fetch(epubPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch EPUB file: ${response.statusText}`);
    }
    
    // Convert to File object with appropriate name from the path
    const blob = await response.blob();
    const fileName = epubPath.split('/').pop() || 'book.epub';
    const file = new File([blob], fileName, { type: 'application/epub+zip' });
    
    // Parse the EPUB and add it to the database
    const book = await parseEpub(file);
    await addBook(book);
    console.log('Successfully preloaded book:', book.title);
  } catch (error) {
    console.error('Error preloading book:', error);
  }
  localStorage.setItem('preloadDone', 'true');
} 