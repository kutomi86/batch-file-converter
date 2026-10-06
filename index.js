const fs = require('fs');
const path = require('path');
const readline = require('readline');
const libre = require('libreoffice-convert');

// Import configuration from config.js
const { INPUT_FOLDER, OUTPUT_FOLDER, SELECT_TIMEOUT_SECONDS } = require('./config');

// Helper: Custom Promise wrapper for libreoffice-convert (fixes DEP0174 warning)
function convertToPdfBuffer(docxBuffer) {
  return new Promise((resolve, reject) => {
    libre.convert(docxBuffer, '.pdf', undefined, (err, done) => {
      if (err) return reject(err);
      resolve(done);
    });
  });
}

// Helper: Format milliseconds into clean human-readable strings
function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = (ms / 1000).toFixed(2);
  if (ms < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

// Helper: Interactive terminal mode selector with countdown timeout
function promptUserMode(timeoutSeconds) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(`\n⚙️ [MODE SELECTION] Choose how to handle existing files in the output directory:`);
    console.log(`   [1] Auto-rename : Append "(1)", "(2)", etc. if file exists`);
    console.log(`   [2] Overwrite   : Delete and replace existing file`);
    console.log(`   [3] Skip        : Skip conversion if destination file already exists`);
    console.log(`\n⏳ Prompt timing out in ${timeoutSeconds} seconds (Defaults to Mode 1)...`);

    let timer = setTimeout(() => {
      console.log(`\n⏱️ [TIMEOUT] No response received within ${timeoutSeconds}s. Automatically selecting Mode 1.`);
      rl.close();
      resolve(1);
    }, timeoutSeconds * 1000);

    rl.question(`👉 Enter selection (1, 2, or 3): `, (answer) => {
      clearTimeout(timer);
      rl.close();
      const choice = parseInt(answer.trim(), 10);
      if ([1, 2, 3].includes(choice)) {
        resolve(choice);
      } else {
        console.log(`⚠️️ [WARN] Invalid choice "${answer.trim()}". Defaulting to Mode 1.`);
        resolve(1);
      }
    });
  });
}

// Helper: Generate non-conflicting filename for Mode 1
function getUniqueFilePath(dir, filename) {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  let candidatePath = path.join(dir, filename);
  let counter = 1;

  while (fs.existsSync(candidatePath)) {
    candidatePath = path.join(dir, `${baseName} (${counter})${ext}`);
    counter++;
  }

  return candidatePath;
}

// Main Batch Conversion Function
async function batchConvertDocxToPdf() {
  const totalStartTime = Date.now();
  console.log('==================================================');
  console.log('🚀 [START] Initializing DOCX to PDF Batch Converter');
  console.log('==================================================');

  // Normalize and resolve absolute paths cross-platform
  const resolvedInputPath = path.resolve(path.normalize(INPUT_FOLDER));
  const resolvedOutputPath = path.resolve(path.normalize(OUTPUT_FOLDER));

  console.log(`📂 [CONFIG] Input Directory  : "${resolvedInputPath}"`);
  console.log(`📂 [CONFIG] Output Directory : "${resolvedOutputPath}"`);

  // Verify input folder existence
  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`❌ [ERROR] Input directory missing at "${resolvedInputPath}". Exiting.`);
    return;
  }

  // Create output folder if missing
  if (!fs.existsSync(resolvedOutputPath)) {
    console.log(`🛠️ [SETUP] Creating missing output directory...`);
    fs.mkdirSync(resolvedOutputPath, { recursive: true });
  }

  // Check LibreOffice readiness
  console.log(`🔍 [CHECK] Verifying LibreOffice engine availability...`);
  try {
    if (typeof libre.convert !== 'function') {
      throw new Error('LibreOffice conversion function unavailable.');
    }
    console.log(`✅ [CHECK] Engine ready.`);
  } catch (err) {
    console.error(`❌ [ERROR] LibreOffice engine failed readiness check: ${err.message}`);
    return;
  }

  // Interactively select collision handling mode
  const mode = await promptUserMode(SELECT_TIMEOUT_SECONDS);
  const modeNames = {
    1: 'Mode 1 (Auto-Rename with Increment)',
    2: 'Mode 2 (Overwrite Existing Files)',
    3: 'Mode 3 (Skip If File Exists)'
  };
  console.log(`\n🎯 [SELECTED] Active behavior: ${modeNames[mode]}\n`);

  // Scan input directory
  console.log(`🔎 [SCAN] Searching for target files in input folder...`);
  const files = fs.readdirSync(resolvedInputPath);
  const docxFiles = files.filter(file => /\.(docx|doc)$/i.test(file));

  if (docxFiles.length === 0) {
    console.log(`⚠️ [WARN] No .docx or .doc files found to convert.`);
    return;
  }

  console.log(`📄 [FOUND] Located ${docxFiles.length} file(s) to process.\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Process files sequentially
  for (let i = 0; i < docxFiles.length; i++) {
    const fileStartTime = Date.now();
    const sourceFilename = docxFiles[i];
    const sourceFilePath = path.join(resolvedInputPath, sourceFilename);
    
    // Default PDF target filename
    const targetPdfName = sourceFilename.replace(/\.(docx|doc)$/i, '.pdf');
    let finalTargetPath = path.join(resolvedOutputPath, targetPdfName);

    console.log(`🔄 [LOOP ${i + 1}/${docxFiles.length}] File: "${sourceFilename}"`);

    // Collision Check logic
    const fileExists = fs.existsSync(finalTargetPath);

    if (fileExists) {
      if (mode === 3) {
        console.log(`   └─ ⏭️ [SKIPPED] Target file "${targetPdfName}" already exists in output folder.\n`);
        skipCount++;
        continue;
      } else if (mode === 2) {
        console.log(`   └─ 🗑️ [OVERWRITE] Target file "${targetPdfName}" exists. Replacing file...`);
        try {
          fs.unlinkSync(finalTargetPath);
        } catch (e) {
          // Ignore error if file is already unlinked or directly overwritten
        }
      } else if (mode === 1) {
        finalTargetPath = getUniqueFilePath(resolvedOutputPath, targetPdfName);
        console.log(`   └─ 🏷️ [RENAME] Target exists. New output path: "${path.basename(finalTargetPath)}"`);
      }
    }

    try {
      console.log(`   └─ 📖 Reading document buffer...`);
      const docxBuffer = fs.readFileSync(sourceFilePath);

      console.log(`   └─ ⚙️ Converting via LibreOffice engine...`);
      const pdfBuffer = await convertToPdfBuffer(docxBuffer);

      console.log(`   └─ 💾 Writing output to disk...`);
      fs.writeFileSync(finalTargetPath, pdfBuffer);

      const fileDuration = formatMs(Date.now() - fileStartTime);
      console.log(`✅ [SUCCESS] Converted: "${sourceFilename}" ➔ "${path.basename(finalTargetPath)}" (Took ${fileDuration})\n`);
      successCount++;
    } catch (error) {
      const fileDuration = formatMs(Date.now() - fileStartTime);
      console.error(`❌ [ERROR] Failed to convert "${sourceFilename}": ${error.message} (Failed after ${fileDuration})\n`);
      failCount++;
    }
  }

  const totalDuration = formatMs(Date.now() - totalStartTime);
  console.log(`==================================================`);
  console.log(`🎉 [COMPLETE] All operations finished!`);
  console.log(`📊 [STATS] Total: ${docxFiles.length} | Converted: ${successCount} | Skipped: ${skipCount} | Failed: ${failCount}`);
  console.log(`⏱️ [ELAPSED TIME] ${totalDuration}`);
  console.log(`==================================================`);
}

batchConvertDocxToPdf();