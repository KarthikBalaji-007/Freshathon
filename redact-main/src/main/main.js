// main.js
require('dotenv').config();
const { HfInference } = require('@huggingface/inference');
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const fs = require("fs");
const path = require("node:path");
const pdf2md = require("@opendocsg/pdf2md");
const { createMapping, decodeTemplate } = require("../utils/textUtils"); // Assuming this file exists and is correct
const {
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  sendMessageToRenderer,
  setLoading,
  sendNotification,
} = require("../utils/windowUtils"); // Assuming this file exists and is correct
const {
  app,
  ipcMain,
  BrowserWindow,
  globalShortcut,
  clipboard,
} = require("electron");
const mammoth = require("mammoth");
const { execSync } = require("child_process");
const { PDFDocument, rgb } = require("pdf-lib"); // For PDF creation/modification if needed later

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const configPath = path.join(__dirname, "../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const enableClipboardMonitoring = config.enableClipboardMonitoring;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 250,
    height: 250,
    x: 1000,
    y: 480,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true, // Recommended for security
      nodeIntegration: false, // Recommended for security
    },
    frame: false,
    icon: path.join(__dirname, "../../public/icons/icon.ico"), // Make sure this path is correct
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "../../public/index.html")); // Make sure this path is correct

  if (enableClipboardMonitoring) {
    monitorClipboard();
  }
}

function createNewWindow(text1, text2) {
  const newWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    icon: path.join(__dirname, "../../public/icons/icon.ico"),
  });
  newWindow.loadFile(path.join(__dirname, "../../public/newWindow.html"));
  newWindow.webContents.on("did-finish-load", () => {
    newWindow.webContents.send("send-text", text1, text2);
  });
  // newWindow.webContents.openDevTools(); // Uncomment for debugging this window
}

function convertDocToDocx(inputPath) {
  // Ensure the path to soffice.exe is correct for your system or soffice is in PATH
  const command = `"C:\\Program Files\\LibreOffice\\program\\soffice.exe" --headless --convert-to docx --outdir "${path.dirname(inputPath)}" "${inputPath}"`;
  try {
    console.log("Main: Executing LibreOffice command:", command);
    execSync(command);
    const convertedPath = inputPath.replace(/\.doc$/i, ".docx");
    if (fs.existsSync(convertedPath)) {
      console.log("Main: .doc successfully converted to .docx:", convertedPath);
      return convertedPath;
    } else {
      throw new Error(`.docx file not found after conversion: ${convertedPath}`);
    }
  } catch (error) {
    console.error("Main: Error converting .doc to .docx:", error);
    throw error; // Re-throw to be caught by redactFile
  }
}

// --- Redaction and PII Check Logic using Hugging Face ---
async function redact(textToRedact) {
    if (!textToRedact || typeof textToRedact !== 'string' || textToRedact.trim() === "") {
        console.warn("Main/redact_HF: Received empty or invalid text for redaction.");
        return textToRedact; // Return original if empty or invalid
    }
    try {
        console.log("Main/redact_HF: Calling HF API for NER. Text(50):", textToRedact.substring(0,50));
        const hfEntities = await hf.tokenClassification({ // hf.tokenClassification is preferred for NER
            model: 'dslim/bert-base-NER',
            inputs: textToRedact, // hf.tokenClassification often takes string directly
        });
        console.log("Main/redact_HF: HF API NER response:", JSON.stringify(hfEntities, null, 2));

        if (!hfEntities || !Array.isArray(hfEntities)) {
            console.error("Main/redact_HF: NER response from HF API is not a valid array:", hfEntities);
            return textToRedact; // Fallback
        }

        let redactedOutput = textToRedact;
        const sortedEntities = hfEntities.sort((a, b) => b.start - a.start);

        for (const entity of sortedEntities) {
            if (typeof entity.start === 'number' && typeof entity.end === 'number' && entity.entity_group) {
                const placeholder = `[${entity.entity_group.toUpperCase()}]`;
                if (entity.start < redactedOutput.length && entity.end <= redactedOutput.length && entity.start < entity.end) {
                    redactedOutput =
                        redactedOutput.substring(0, entity.start) +
                        placeholder +
                        redactedOutput.substring(entity.end);
                } else {
                    console.warn("Main/redact_HF: Entity indices out of bounds:", entity, "Text length:", redactedOutput.length);
                }
            } else {
                console.warn("Main/redact_HF: Invalid entity object from HF API:", entity);
            }
        }
        console.log("Main/redact_HF: Text after redaction (first 50):", redactedOutput.substring(0,50));
        return redactedOutput;
    } catch (error) {
        console.error("Main/redact_HF: Error during Hugging Face NER call:", error.message, error.stack);
        return textToRedact; // Fallback to original text on error
    }
}

async function checkPII(textForPIICheck) {
  if (!textForPIICheck || typeof textForPIICheck !== 'string' || textForPIICheck.trim() === "") {
      console.warn("Main/checkPII: Received empty or invalid text for PII check.");
      return "NO"; // Return "NO" for empty/invalid input
  }
  try {
      console.log("Main/checkPII: Calling HF API for PII check (NER). Text(50):", textForPIICheck.substring(0,50));
      const hfEntities = await hf.tokenClassification({ // Using tokenClassification
          model: 'dslim/bert-base-NER', // Same model as redaction for consistency
          inputs: textForPIICheck,     // Pass string directly
      });
      console.log("Main/checkPII: HF API NER response for PII check:", JSON.stringify(hfEntities, null, 2));

      if (hfEntities && Array.isArray(hfEntities) && hfEntities.length > 0) {
          // Consider specific entity groups if needed, e.g. if only PER, LOC, ORG count as PII for this check
          // const piiEntityGroups = ['PER', 'LOC', 'ORG'];
          // const foundPii = hfEntities.some(entity => piiEntityGroups.includes(entity.entity_group.toUpperCase()));
          // return foundPii ? "YES" : "NO";
          return "YES"; // Simplest: if any NER entity is found, consider it PII for notification
      }
      return "NO"; // No entities found or not an array
  } catch (error) {
      console.error("Main/checkPII: Error during Hugging Face PII check:", error.message, error.stack);
      return "NO"; // Default to NO on error
  }
}


// --- Clipboard Monitoring and Redaction ---
let lastClipboard = "";
function monitorClipboard() {
  setInterval(() => {
    checkClipboard();
  }, 1000); // Consider increasing interval if performance is an issue
}

function checkClipboard() {
  try {
    const text = clipboard.readText();
    if (text && text !== lastClipboard) {
      lastClipboard = text;
      if (text.length > 10000) { // Increased limit slightly, adjust as needed
        sendMessageToRenderer("Clipboard text is too long. PII Detection disabled for this content.");
        return;
      }
      console.log("Main/checkClipboard: Checking clipboard content (first 50):", text.substring(0,50));
      checkPII(text).then((result) => { // result is "YES" or "NO"
        console.log("Main/checkClipboard: PII check result:", result);
        if (result === "YES") {
          sendMessageToRenderer("Personal information detected in clipboard!");
          sendNotification(mainWindow, app, "PII Detected", "Sensitive information found in clipboard.");
        } else {
          sendMessageToRenderer("No personal information detected in clipboard.");
        }
      }).catch(error => {
        console.error("Main/checkClipboard: Error in checkPII promise:", error);
        sendMessageToRenderer("Error checking clipboard for PII.");
      });
    }
  } catch (error) {
    console.error("Main/checkClipboard: Error reading clipboard:", error);
    // sendMessageToRenderer("Error accessing clipboard."); // Could be too noisy
  }
}

let mapping = {}; // This should be fine if clipboard redaction/restore is a single session concept

function redactClipboard() {
  try {
    const text = clipboard.readText();
    if (text) {
      console.log("Main/redactClipboard: Redacting clipboard (first 50):", text.substring(0,50));
      redact(text).then((resultText) => {
        mapping = createMapping(resultText, text);
        clipboard.writeText(resultText);
        createNewWindow(resultText, text); // Show original and redacted
        sendMessageToRenderer("Clipboard redacted successfully.");
      }).catch(error => {
        console.error("Main/redactClipboard: Error in redact promise:", error);
        sendMessageToRenderer("Error redacting clipboard.");
      });
    } else {
      sendMessageToRenderer("No text found in clipboard to redact.");
    }
  } catch (error) {
    console.error("Main/redactClipboard: Error accessing clipboard for redaction:", error);
    sendMessageToRenderer("Error accessing clipboard for redaction.");
  }
}

function restoreClipboard() {
  try {
    const text = clipboard.readText(); // This is the redacted text
    if (text) {
      const restored = decodeTemplate(text, mapping); // Use mapping to restore
      clipboard.writeText(restored);
      createNewWindow(text, restored); // Show redacted and restored
      sendMessageToRenderer("Clipboard restored successfully.");
    } else {
      sendMessageToRenderer("No text found in clipboard to restore.");
    }
  } catch (error) {
    console.error("Main/restoreClipboard: Error accessing clipboard for restoration:", error);
    sendMessageToRenderer("Error accessing clipboard for restoration.");
  }
}

// --- File Redaction ---
async function redactFile(filePath) {
    console.log("Main/redactFile: Started. Path:", filePath); // LOG 8
    try {
        setLoading(true);
        console.log("Main/redactFile: setLoading(true)."); // LOG 9

        let currentFilePath = filePath;
        let extname = path.extname(currentFilePath).toLowerCase();
        console.log("Main/redactFile: Initial path:", currentFilePath, "Ext:", extname); // LOG_PATH_EXT

        if (![".pdf", ".txt", ".doc", ".docx"].includes(extname)) {
            console.warn("Main/redactFile: Unsupported type:", extname, "Path:", currentFilePath);
            sendMessageToRenderer("Unsupported file type. Please select a PDF, TXT, DOC, or DOCX file.");
            return;
        }

        let textToProcess = "";
        console.log("Main/redactFile: Extracting text for ext:", extname); // LOG_BEFORE_EXTRACTION

        if (extname === ".pdf") {
            const pdfBuffer = fs.readFileSync(currentFilePath);
            textToProcess = await pdf2md(pdfBuffer);
            console.log("Main/redactFile: PDF text(100):", textToProcess ? textToProcess.substring(0, 100) : "null"); // LOG 13
        } else if (extname === ".doc") {
            console.log("Main/redactFile: Converting .doc:", currentFilePath); // LOG 11
            currentFilePath = convertDocToDocx(currentFilePath); // Modifies currentFilePath
            extname = ".docx"; // Update extname
            console.log("Main/redactFile: .doc converted to .docx:", currentFilePath); // LOG 12
            // Fall through to .docx handling
            const { value } = await mammoth.extractRawText({ path: currentFilePath });
            textToProcess = value;
            console.log("Main/redactFile: DOCX (from .doc) text(100):", textToProcess ? textToProcess.substring(0, 100) : "null");
        } else if (extname === ".docx") {
            const { value } = await mammoth.extractRawText({ path: currentFilePath });
            textToProcess = value;
            console.log("Main/redactFile: DOCX text(100):", textToProcess ? textToProcess.substring(0, 100) : "null"); // LOG 14
        } else if (extname === ".txt") {
            textToProcess = fs.readFileSync(currentFilePath, "utf-8");
            console.log("Main/redactFile: TXT text(100):", textToProcess ? textToProcess.substring(0, 100) : "null"); // LOG 15
        }

        if (!textToProcess || textToProcess.trim() === "") {
            console.warn("Main/redactFile: Extracted text is empty:", currentFilePath);
            sendMessageToRenderer("Warning: File is empty or text extraction failed.");
            return;
        }

        console.log("Main/redactFile: Calling redact API. Text(50):", textToProcess.substring(0,50)); // LOG 16
        const redactedResultText = await redact(textToProcess);
        console.log("Main/redactFile: Redact API result(50):", redactedResultText ? redactedResultText.substring(0,50) : "null"); // LOG 17

        if (!redactedResultText) {
            console.error("Main/redactFile: Redaction returned no result.");
            sendMessageToRenderer("Error: Redaction process failed.");
            return;
        }

        mapping = createMapping(redactedResultText, textToProcess);
        createNewWindow(redactedResultText, textToProcess);

        // Output file naming: originalname-REDACTED.originalext
        const originalFileExt = path.extname(filePath).toLowerCase(); // Use original filePath for consistent naming base
        const outputBaseName = filePath.substring(0, filePath.length - originalFileExt.length);
        // Use the final extname (e.g. .docx if original was .doc) for the output suffix
        const outputFilePath = `${outputBaseName}-REDACTED${extname}`;

        console.log("Main/redactFile: Writing redacted file to:", outputFilePath); // LOG 18
        fs.writeFileSync(outputFilePath, redactedResultText, 'utf-8');
        sendMessageToRenderer(`Redacted file saved to: ${outputFilePath}`);
        console.log("Main/redactFile: Redacted file saved."); // LOG 19

    } catch (err) {
        console.error("Main/redactFile: Error:", err.message, err.stack); // LOG 20
        sendMessageToRenderer(`Error processing file: ${err.message}`);
    } finally {
        setLoading(false);
        console.log("Main/redactFile: setLoading(false). Finished."); // LOG 21
    }
}

// --- IPC Handlers ---
ipcMain.on("minimize-window", () => minimizeWindow());
ipcMain.on("maximize-window", () => maximizeWindow());
ipcMain.on("close-window", () => closeWindow());
ipcMain.on("open-new-window", (event, text1, text2) => createNewWindow(text1, text2));
ipcMain.on("redact-clipboard", () => redactClipboard());
ipcMain.on("restore-clipboard", () => restoreClipboard());

ipcMain.on("redact-file", async (event, receivedPath) => { // Renamed to receivedPath for clarity
    console.log("Main: IPC 'redact-file' received with path:", receivedPath); // LOG 7
    if (typeof receivedPath !== 'string' || !receivedPath) {
        console.error("Main: Invalid path received in IPC:", receivedPath);
        sendMessageToRenderer("Error: Invalid file path received.");
        return;
    }
    try {
        await redactFile(receivedPath);
    } catch (error) {
        console.error("Main: Error in IPC 'redact-file' handler calling redactFile:", error.message, error.stack);
        sendMessageToRenderer(`Error in file redaction: ${error.message}`);
    }
});

ipcMain.handle("decode-word", (event, word) => { // Changed to handle for invoke
    return mapping[word] || word;
});
ipcMain.handle("decode-template", (event, text) => { // Changed to handle for invoke
    return decodeTemplate(text, mapping);
});


// --- App Lifecycle ---
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});