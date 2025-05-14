import * as EPUBJS from 'epubjs';
import type { Book } from './db';
import { nanoid } from 'nanoid';
import TurndownService from 'turndown';
import JSZip from 'jszip';

/**
 * Parse an EPUB file and extract its metadata
 * @param file The EPUB file to parse
 * @returns A promise that resolves to a Book object
 */
export async function parseEpub(file: File): Promise<Book> {
  // Create an ArrayBuffer from the file
  const arrayBuffer = await file.arrayBuffer();
  
  // Create an EPUB.js book instance
  const book = EPUBJS.default(arrayBuffer);
  
  // Wait for the book to be ready
  await book.ready;
  
  // Extract metadata
  const metadata = await book.loaded.metadata;

  const coverUrl = await book.coverUrl()
  const cover = await fetch(coverUrl!).then(res => res.blob());
  
  // Get the title
  let title = metadata.title || 'Unknown Title';
  if (Array.isArray(title)) {
    title = title[0] || 'Unknown Title';
  }
  
  // Get the authors (could be a string or an array)
  let authors: string[] = [];
  if (metadata.creator) {
    if (Array.isArray(metadata.creator)) {
      authors = metadata.creator;
    } else {
      authors = [metadata.creator];
    }
  }

  
  const markdown = await convertEpubToMarkdown(arrayBuffer);
  const locations = JSON.stringify(await book.locations.generate(1500));

  // Create a new book object
  const now = new Date();
  const newBook: Book = {
    id: nanoid(),
    title,
    authors,
    cover,
    markdown,
    locations,
    file: new Blob([arrayBuffer], { type: 'application/epub+zip' }),    
    createdAt: now,
    updatedAt: now,
  };
  
  return newBook;
}

async function convertEpubToMarkdown(fileBuffer: ArrayBuffer): Promise<string> {
  // Load the EPUB file with JSZip
  const zip = new JSZip();
  const contents = await zip.loadAsync(fileBuffer);

  // First, find and parse the container.xml file to locate the OPF file
  const containerXml = await contents
    .file('META-INF/container.xml')
    ?.async('string');
  if (!containerXml) {
    throw new Error('Invalid EPUB: container.xml not found');
  }

  // Parse the container XML to find the OPF file path
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const rootfilePath = containerDoc
    .getElementsByTagName('rootfile')[0]
    ?.getAttribute('full-path');

  if (!rootfilePath) {
    throw new Error('Invalid EPUB: rootfile path not found');
  }

  // Get the directory of the OPF file
  const opfDir = rootfilePath.split('/').slice(0, -1).join('/');
  const opfDirWithTrailingSlash = opfDir ? `${opfDir}/` : '';

  // Read and parse the OPF file
  const opfContent = await contents.file(rootfilePath)?.async('string');
  if (!opfContent) {
    throw new Error(`Invalid EPUB: OPF file not found at ${rootfilePath}`);
  }

  const opfDoc = parser.parseFromString(opfContent, 'application/xml');

  // Extract metadata
  const title =
    opfDoc.getElementsByTagName('dc:title')[0]?.textContent || 'Untitled';
  const creator =
    opfDoc.getElementsByTagName('dc:creator')[0]?.textContent ||
    'Unknown Author';

  // Get the spine items (reading order)
  const spine = opfDoc.getElementsByTagName('spine')[0];
  const itemrefs = spine.getElementsByTagName('itemref');

  // Get the manifest items (all content files)
  const manifest = opfDoc.getElementsByTagName('manifest')[0];
  const items = manifest.getElementsByTagName('item');

  // Create a map of id to href from the manifest
  const idToHref: Record<string, string> = {};
  const idToMediaType: Record<string, string> = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type');

    if (id && href) {
      idToHref[id] = href;
      if (mediaType) {
        idToMediaType[id] = mediaType;
      }
    }
  }

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  })
    .addRule('images', {
      filter: 'img',
      replacement: () => '',
    })
    .addRule('links', {
      filter: 'a',
      replacement: (content) => content,
    });

  // Start building the markdown content
  let markdownContent = `# ${title}\n\n`;
  markdownContent += `By: ${creator}\n\n`;
  markdownContent += `---\n\n`;

  // Process each spine item in reading order
  for (let i = 0; i < itemrefs.length; i++) {
    const itemref = itemrefs[i];
    const idref = itemref.getAttribute('idref');

    if (idref && idToHref[idref]) {
      const href = idToHref[idref];
      const mediaType = idToMediaType[idref] || '';

      // Only process HTML/XHTML content
      if (
        mediaType.includes('html') ||
        href.endsWith('.html') ||
        href.endsWith('.xhtml')
      ) {
        const filePath = `${opfDirWithTrailingSlash}${href}`;
        const contentFile = await contents.file(filePath)?.async('string');

        if (contentFile) {
          // Parse the HTML content
          const contentDoc = parser.parseFromString(contentFile, 'text/html');

          // Extract the body content
          const body = contentDoc.getElementsByTagName('body')[0];

          if (body) {
            // Convert HTML to string
            const serializer = new XMLSerializer();
            const bodyHtml = serializer.serializeToString(body);

            // Convert HTML to Markdown
            const markdown = turndownService.turndown(bodyHtml);

            // Add to the markdown content
            markdownContent += `${markdown}\n\n`;
          }
        }
      }
    }
  }

  return markdownContent;
}