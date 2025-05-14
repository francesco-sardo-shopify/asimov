import type { Route } from "./+types/books.$bookId.chats";
import { href, redirect } from "react-router";
import { getChatsByBookId } from "~/utils/db";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {  
  const { bookId } = params;

  const chats = await getChatsByBookId(bookId);
  if (chats.length > 0) {
    return redirect(href("/chats/:chatId", { chatId: chats[0].id }));
  }

  return redirect(href("/books/:bookId/chats/new", { bookId }));  
}