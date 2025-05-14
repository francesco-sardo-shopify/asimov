# Asimov - AI-powered eBook Companion

[Asimov](https://francesco-sardo-shopify.github.io/asimov/) is a minimal, in-browser EPUB reader with an integrated LLM assistant that enhances your reading experience.

## Key Features

- **📚 Full In-Browser EPUB Reader**: Read your books directly in your browser with a minimal, distraction-free interface.

- **🔒 Private & Client-Only**: All processing happens locally in your browser. Your books and reading habits never leave your device.

- **📤 Easy Upload**: Select your EPUB files to start reading immediately. Download some for free at [Project Gutenberg](https://www.gutenberg.org/ebooks/search/?sort_order=downloads).

- **🤖 LLM Reading Companion**: An AI assistant that knows exactly what you're reading and can help enhance your understanding.

- **📝 Interactive Assistance**: Ask your AI companion to:
  - Summarize chapters or the entire book
  - Clarify difficult concepts or passages
  - Expand on ideas presented in the text
  - Provide additional context or background
  - Quiz you on your understanding of key concepts

- **🔑 Bring Your Own Key**: Connect to your preferred LLM provider using your own API key for maximum privacy and control. Works especially well with Gemini Flash models.

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

```bash
npm run build
```

You can deploy Asimov to any static website hosting platform.

## Privacy

Asimov respects your privacy:
- No login or signup needed
- Your EPUB files remain on your device
- No data is sent to any server unless you explicitly connect an LLM API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)

