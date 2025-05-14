import type { Route } from "./+types/chats.$chatId";
import { useRef, useEffect, useState } from "react";
import { redirect, href, Link, Form } from "react-router";
import { getBook, getSettings, getChat, updateChat } from "~/utils/db";
import type { Chat, ChatMessage } from "~/utils/db";
import { generateChatTitle } from "~/utils/ai";
import * as EPUBJS from "epubjs";
import { TopBar } from "~/components/TopBar";
import OpenAI from "openai";
import ReactMarkdown from "react-markdown";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Chat - Asimov` },
    { name: "description", content: "Chat about your book with Asimov" },
  ];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { chatId } = params;

  const settings = await getSettings();
  if (!settings) {
    return redirect(href("/settings"));
  }

  const chat = await getChat(chatId);

  if (!chat) {
    throw new Response("Chat not found", { status: 404 });
  }

  const book = await getBook(chat.bookId);
  if (!book) {
    throw new Response("Book not found", { status: 404 });
  }

  // Get the current page content if location is available
  const arrayBuffer = await book.file.arrayBuffer();
  const epub = EPUBJS.default(arrayBuffer);
  await epub.ready;

  let content = "";
  if (book.location) {
    const cfiBase = book.location.start.replace(/!.*/, "");
    const cfiStart = book.location.start.replace(/.*!/, "").replace(/\)$/, "");
    const cfiEnd = book.location.end.replace(/.*!/, "").replace(/\)$/, "");
    const cfiRange = `${cfiBase}!,${cfiStart},${cfiEnd})`;

    try {
      const range = await epub.getRange(cfiRange);
      content = range.toString();
    } catch (error) {
      console.error("Error getting page content:", error);
      content = "Current page content not available";
    }
  }

  return { book, settings, content, chat };
}

export default function ChatPage({ loaderData }: Route.ComponentProps) {
  const { book, settings, content, chat: initialChat } = loaderData;
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat.messages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChatsMenu, setShowChatsMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveMessages = async (newMessages: ChatMessage[]) => {
    try {
      const updatedChat = {
        ...initialChat,
        messages: newMessages,
        updatedAt: new Date(),
      };

      // If there are at least 2 messages and we don't have a real title yet,
      // generate one using the AI
      if (
        newMessages.length >= 2 &&
        (initialChat.title === "New conversation" || !initialChat.title)
      ) {
        try {
          const title = await generateChatTitle(newMessages, settings);
          updatedChat.title = title;
        } catch (error) {
          console.error("Failed to generate title:", error);
        }
      }

      await updateChat(updatedChat);
    } catch (error) {
      console.error("Failed to save chat:", error);
    }
  };

  const sendMessage = async (input: string) => {
    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const openai = new OpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.baseUrl,
        dangerouslyAllowBrowser: true, // Required for client-side usage
      });

      let systemPrompt = `Role: You are a professional literary guide and book companion who specializes in helping readers understand and engage with "${book.title}".

Context: The user is currently reading this passage:
<passage>
"${content}"
</passage>

The complete book content is available for your reference:
<book>
${book.markdown}
</book>

Format:
- Keep responses concise and conversational
- No hard sells, just provide valuable insights
- Include specific textual references when relevant
- Format your response in markdown

Goal: Help the reader understand concepts, analyze themes, answer questions about the content, and deepen their appreciation of the book without spoiling future content.`;

      const response = await openai.chat.completions.create({
        model: settings.modelName,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...newMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        ],
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0]?.message?.content;

      if (assistantMessage) {
        const responseMessage: ChatMessage = {
          role: "assistant",
          content: assistantMessage,
          timestamp: new Date(),
        };

        const updatedMessages = [...newMessages, responseMessage];
        setMessages(updatedMessages);

        // Save to the database
        await saveMessages(updatedMessages);
      } else {
        throw new Error("No response from the API");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to get a response. Please check your API settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen pt-14">
      {/* Use the TopBar with additional buttons */}
      <TopBar currentPage="chat" bookId={book.id}>
        {/* Chat History button */}
        <button
          onClick={() => setShowChatsMenu(!showChatsMenu)}
          className="p-2 text-white hover:text-blue-100 transition-colors"
          aria-label="View chat history"
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
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </button>
      </TopBar>

      {/* Chat History Sidebar */}
      {showChatsMenu && (
        <ChatHistorySidebar
          bookId={book.id}
          currentChatId={initialChat.id}
          onClose={() => setShowChatsMenu(false)}
        />
      )}

      {/* Chat Content */}
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h3 className="font-medium text-blue-800 mb-2">
                  Chat about "{book.title}"
                </h3>
                <p className="text-blue-700">
                  Ask questions about themes, characters, or any aspect of the
                  book you're reading.
                </p>
              </div>
            )}

            {messages
              .filter((msg) => msg.role !== "system")
              .map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-100 ml-auto max-w-[80%]"
                      : "bg-white border border-gray-200 mr-auto max-w-[80%]"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-blue prose-headings:text-blue-800 prose-a:text-blue-600 prose-strong:text-blue-700">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              ))}

            {loading && (
              <div className="bg-white border border-gray-200 p-3 rounded-lg mr-auto max-w-[80%]">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-300 p-3 rounded-lg text-red-700 mr-auto max-w-[80%]">
                <p>{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-gray-200 p-4 bg-white sticky bottom-0 shadow-md">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex space-x-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your book..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={loading || !input.trim()}
              >
                Send
              </button>
            </form>

            {messages.length === 0 && (
              <div className="mt-4 flex flex-col gap-3">
                {SUGGESTED_INPUTS.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      sendMessage(suggestion);
                    }}
                    className="w-full text-left p-3 text-gray-700 hover:bg-gray-100 rounded-md border border-gray-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for the chat history sidebar
function ChatHistorySidebar({
  bookId,
  currentChatId,
  onClose,
}: {
  bookId: string;
  currentChatId: string;
  onClose: () => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const { getChatsByBookId } = await import("~/utils/db");
        const bookChats = await getChatsByBookId(bookId);
        setChats(bookChats);
      } catch (error) {
        console.error("Error loading chats:", error);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [bookId]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
      <div className="relative w-80 max-w-[80%] h-full bg-white shadow-lg overflow-auto z-10 ml-auto">
        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold text-lg">Chat History</h3>
          <button
            onClick={onClose}
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

        {loading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="flex justify-center mb-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            Loading chats...
          </div>
        ) : chats.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No chat history found
          </div>
        ) : (
          <ul className="divide-y">
            <div className="sticky bottom-0 bg-white p-4 border-t">
              <Link
                reloadDocument={true}
                to={href("/books/:bookId/chats/new", { bookId })}
                className="block w-full bg-blue-500 text-white text-center py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
              >
                Start New Chat
              </Link>
            </div>
            {chats.map((chat) => (
              <li
                key={chat.id}
                className={`${chat.id === currentChatId ? "bg-blue-50" : ""}`}
              >
                <Link
                  to={href("/chats/:chatId", { chatId: chat.id })}
                  reloadDocument={true}
                  className="block p-4 hover:bg-blue-50 transition-colors"
                >
                  <div className="font-medium truncate">{chat.title}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(chat.updatedAt).toLocaleDateString()} ·
                    {chat.messages.length} messages
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const SUGGESTED_INPUTS = [
  "Summarize what I've read so far in the book",
  "Tell me what happens in the rest of this chapter without major spoilers",
  "Explain what's happening on this page in simple terms",
  "Ask me a series of questions (one at a time) about the book so far to check my understanding",
];
