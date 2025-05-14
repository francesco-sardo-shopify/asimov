import type { Route } from "./+types/books.new";
import { href, redirect } from "react-router";
import { parseEpub } from "~/utils/epub";
import { addBook } from "~/utils/db";

export async function clientAction({ request }: Route.ClientActionArgs) {  
    const formData = await request.formData();
    const file = formData.get("epubFile") as File;
  
    try {
      const book = await parseEpub(file);
      await addBook(book);      
      console.log("Book added", book);
    } catch (error) {
      console.log("Error processing EPUB file:", error);
    }
    return redirect(href("/"));
}