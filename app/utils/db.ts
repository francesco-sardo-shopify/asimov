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

const DB_NAME = 'library';
const DB_VERSION = 1;

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
