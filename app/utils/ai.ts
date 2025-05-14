import OpenAI from "openai";
import type { Settings, ChatMessage } from "./db";

/**
 * Generates a short title for a chat conversation
 * @param messages The chat messages to summarize
 * @param settings LLM API settings
 * @returns A generated title or a fallback if it fails
 */
export async function generateChatTitle(
  messages: ChatMessage[],
  settings: Settings
): Promise<string> {
  try {
    const openai = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl,
      dangerouslyAllowBrowser: true, // Required for client-side usage
    });

    // Filter out system messages and take first few messages as context
    const relevantMessages = messages
      .filter(msg => msg.role !== "system")
      .slice(0, Math.min(messages.length, 5));
    
    if (relevantMessages.length === 0) {
      return "New conversation";
    }

    const response = await openai.chat.completions.create({
      model: settings.modelName,
      messages: [
        {
          role: "system",
          content: "Your task is to generate a very short, concise title (maximum 6 words) that summarizes the main topic of this conversation. Focus on the key subject matter only. Do now use markdown, only plain text."
        },
        ...relevantMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: "user",
          content: "Based on this conversation, generate a very short title (no more than 6 words)."
        }
      ],
      max_tokens: 25,
      temperature: 0.7,
    });

    const title = response.choices[0]?.message?.content?.trim();
    return title || "New conversation";
  } catch (error) {
    console.error("Error generating chat title:", error);
    
    // Fallback: Use the first user message as title (truncated)
    const firstUserMessage = messages.find(msg => msg.role === "user")?.content;
    if (firstUserMessage) {
      return firstUserMessage.slice(0, 30) + (firstUserMessage.length > 30 ? "..." : "");
    }
    
    return "New conversation";
  }
} 