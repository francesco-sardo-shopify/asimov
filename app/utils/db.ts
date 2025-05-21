import { openDB } from 'idb';
import type { DBSchema } from 'idb';

// Define the schema for our database
interface BookDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: {
      'by-updated-at': Date;
    };
  };
  settings: {
    key: string;
    value: Settings;
  };
  chats: {
    key: string;
    value: Chat;
    indexes: {
      'by-book-id': string;
      'by-updated-at': Date;
    };
  };
  highlights: {
    key: string; // id of the highlight
    value: Highlight;
    indexes: {
      'by-bookId-createdAt': ['bookId', 'createdAt']; // Compound index
      'by-updatedAt': Date; // Index for general sorting/filtering if needed
    };
  };
}

// Book schema with all required fields
export interface Book {
  id: string;
  title: string;
  authors: string[];
  markdown: string;
  locations: string;
  file: Blob;
  cover: Blob;
  createdAt: Date;
  updatedAt: Date;  
  location?: {
    start: string;
    end: string;
    percentage: number;
  };   
}

// API settings for LLM integration
export interface Settings {
  id: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  updatedAt: Date;
}

// Chat message schema
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

// Chat schema
export interface Chat {
  id: string;
  bookId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Highlight schema
export interface Highlight {
  id: string; // Unique ID (e.g., UUID)
  bookId: string; // Foreign key to Book
  cfiRange: string; // EPUB.js Canonical Fragment Identifier
  text: string; // The actual highlighted text content
  color: string; // Name or hex code of the highlight color
  note?: string; // Optional user-added note
  createdAt: Date;
  updatedAt: Date;
}

const DB_NAME = 'library';
const DB_VERSION = 2; // Incremented DB_VERSION

// Initialize the database
export async function initDB() {
  return openDB<BookDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Create the books object store if it doesn't exist
      if (!db.objectStoreNames.contains('books')) {
        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('by-updated-at', 'updatedAt');
      }

      // Create the settings object store if it doesn't exist
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      // Create the chats object store if it doesn't exist or upgrade from v1
      if (!db.objectStoreNames.contains('chats')) {
        const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
        chatStore.createIndex('by-book-id', 'bookId');
        chatStore.createIndex('by-updated-at', 'updatedAt');
      }

      // Create the highlights object store if it doesn't exist
      if (!db.objectStoreNames.contains('highlights')) {
        const highlightStore = db.createObjectStore('highlights', { keyPath: 'id' });
        highlightStore.createIndex('by-bookId-createdAt', ['bookId', 'createdAt']); 
        highlightStore.createIndex('by-updatedAt', 'updatedAt');
      }
    },
  });
}

// Add a new book to the database
export async function addBook(book: Book): Promise<string> {
  const db = await initDB();
  return db.put('books', book);
}

// Get all books from the database, sorted by updatedAt (most recent first)
export async function getAllBooks(): Promise<Book[]> {
  const db = await initDB();
  const index = db.transaction('books').objectStore('books').index('by-updated-at');
  
  const books: Book[] = [];
  let cursor = await index.openCursor(null, 'prev');
  
  while (cursor) {
    books.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  return books;
}

// Get a single book by ID
export async function getBook(id: string): Promise<Book> {
  const db = await initDB();
  const book = await db.get('books', id);
  if (!book) {
    throw new Error('Book not found');
  }
  return book;
}

// Update an existing book
export async function updateBook(book: Book): Promise<string> {
  const db = await initDB();
  book.updatedAt = new Date(); // Always update the updatedAt timestamp
  return db.put('books', book);
}

// Delete a book
export async function deleteBook(id: string): Promise<void> {
  const db = await initDB();
  return db.delete('books', id);
}

// Get LLM API settings
export async function getSettings(): Promise<Settings | undefined> {
  const db = await initDB();
  return db.get('settings', 'llm-settings');
}

// Save LLM API settings
export async function saveSettings(settings: Omit<Settings, 'id' | 'updatedAt'>): Promise<string> {
  const db = await initDB();
  const updatedSettings: Settings = {
    ...settings,
    id: 'llm-settings',
    updatedAt: new Date()
  };
  return db.put('settings', updatedSettings);
}

// Chat-related DB operations
export async function addChat(chat: Chat): Promise<string> {
  const db = await initDB();
  return db.put('chats', chat);
}

export async function getChat(id: string): Promise<Chat | undefined> {
  const db = await initDB();
  return db.get('chats', id);
}

export async function updateChat(chat: Chat): Promise<string> {
  const db = await initDB();
  chat.updatedAt = new Date(); // Always update the updatedAt timestamp
  return db.put('chats', chat);
}

export async function deleteChat(id: string): Promise<void> {
  const db = await initDB();
  return db.delete('chats', id);
}

export async function getChatsByBookId(bookId: string): Promise<Chat[]> {
  const db = await initDB();
  const index = db.transaction('chats').objectStore('chats').index('by-book-id');
  
  const chats: Chat[] = [];
  let cursor = await index.openCursor(bookId);
  
  while (cursor) {
    chats.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  // Sort by updated date (most recent first)
  return chats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getLatestChatByBookId(bookId: string): Promise<Chat | undefined> {
  const chats = await getChatsByBookId(bookId);
  return chats.length > 0 ? chats[0] : undefined;
}

// Highlight-related DB operations

// Add a new highlight to the database
export async function addHighlight(highlight: Highlight): Promise<string> {
  const db = await initDB();
  highlight.createdAt = new Date();
  highlight.updatedAt = new Date();
  return db.put('highlights', highlight);
}

// Get all highlights for a specific book, sorted by createdAt
export async function getHighlightsByBook(bookId: string): Promise<Highlight[]> {
  const db = await initDB();
  const tx = db.transaction('highlights', 'readonly');
  const index = tx.objectStore('highlights').index('by-bookId-createdAt');
  // Use IDBKeyRange.bound to get all highlights for the bookId, sorted by createdAt (ascending)
  // The index already sorts by bookId, then createdAt.
  // So, providing a range for bookId will give us all its highlights, sorted by createdAt.
  const highlights = await index.getAll(IDBKeyRange.bound([bookId, new Date(0)], [bookId, new Date(Date.now() + 1000*60*60*24*365)])); // Max date: ~1 year in future
  await tx.done;
  return highlights;
}

// Update an existing highlight
export async function updateHighlight(highlight: Highlight): Promise<string> {
  const db = await initDB();
  highlight.updatedAt = new Date(); // Always update the updatedAt timestamp
  return db.put('highlights', highlight);
}

// Delete a highlight
export async function deleteHighlight(highlightId: string): Promise<void> {
  const db = await initDB();
  return db.delete('highlights', highlightId);
}

// Get all highlights from the database, sorted by updatedAt (most recent first)
export async function getAllHighlights(): Promise<Highlight[]> {
  const db = await initDB();
  const tx = db.transaction('highlights', 'readonly');
  const index = tx.objectStore('highlights').index('by-updatedAt');
  
  const highlights: Highlight[] = [];
  let cursor = await index.openCursor(null, 'prev'); // 'prev' for descending order (most recent first)
  
  while (cursor) {
    highlights.push(cursor.value);
    cursor = await cursor.continue();
  }
  await tx.done;
  return highlights;
}
