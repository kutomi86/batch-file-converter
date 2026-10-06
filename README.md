# Batch File Converter

This is a simple project initially meant to be used for personal usage to convert files in batches. In the future, more features and improvements may be added depending on needs.

## Features

- **DOC/DOCX to PDF**: Specifically designed to convert Microsoft Word documents to PDF in batches.
- **Collision Handling**: Interactive terminal prompt allows you to choose how to handle existing files (Auto-Rename, Overwrite, or Skip).
- **Fast and Simple**: Built with Node.js and relies on the `libreoffice-convert` library to do the heavy lifting.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.
- [LibreOffice](https://www.libreoffice.org/) must be installed on your system (required for the conversion engine to work).

### Installation
1. Clone the repository or download the files.
2. Open your terminal in the project folder and run:
   ```bash
   npm install
   ```

### Usage
1. Make sure your input and output folders are configured in `config.js` (if applicable) or create the expected folders.
2. Run the script:
   ```bash
   node index.js
   ```
3. Follow the on-screen terminal prompt to choose your file overwrite behavior (the prompt will timeout and default to Auto-Rename if no selection is made).

## License

This project is licensed under the ISC License - see the [package.json](package.json) file for details.
