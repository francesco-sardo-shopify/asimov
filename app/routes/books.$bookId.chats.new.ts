import type { Route } from "./+types/books.$bookId.chats";
import { href, redirect } from "react-router";
import { nanoid } from "nanoid";
import { addChat } from "~/utils/db";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {  
  const { bookId } = params;

  const chat = {
    id: nanoid(),
    bookId,
    title: "New conversation",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await addChat(chat);  
  return redirect(href("/chats/:chatId", { chatId: chat.id }));
}