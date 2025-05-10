// preload.js
const { ipcRenderer, contextBridge, webUtils } = require("electron"); // Ensure webUtils is here

contextBridge.exposeInMainWorld("electronAPI", {
  closeWindow: () => {
    ipcRenderer.send("close-window");
  },
  minimizeWindow: () => {
    ipcRenderer.send("minimize-window");
  },
  maximizeWindow: () => {
    ipcRenderer.send("maximize-window");
  },
  redactClipboard: () => {
    ipcRenderer.send("redact-clipboard");
  },
  restoreClipboard: () => {
    ipcRenderer.send("restore-clipboard");
  },
  decodeTemplate: (text) => {
    // Ensure you have a handler for "decode-template" in main.js if you use this
    return ipcRenderer.invoke("decode-template", text);
  },
  onLoadingStateChange: (callback) => {
    ipcRenderer.on("set-loading", (event, isLoading) => callback(isLoading));
  },
  onDisplayMessage: (callback) => {
    // Ensure sendMessageToRenderer in main.js uses 'display-message' event
    // or that you have a specific handler for direct messages to this.
    ipcRenderer.on("display-message", (event, message) => callback(message));
  },
  onSendText: (callback) => {
    ipcRenderer.on("send-text", (event, text1, text2) =>
      callback(text1, text2)
    );
  },
  // Corrected redactFile function for Option B
  redactFile: (file) => { // 'file' here is the File object from renderer
    console.log("Preload: redactFile called with File object (Option B):", file); // LOG_PRELOAD_FILE_B
    if (file && typeof file.name === 'string') { // Check it's a File-like object
        try {
            const filePath = webUtils.getPathForFile(file); // Get path using webUtils
            console.log("Preload: Extracted filePath using webUtils:", filePath); // LOG 6 (Updated for Option B)
            if (filePath && typeof filePath === 'string') {
                ipcRenderer.send("redact-file", filePath); // Send the string path
            } else {
                console.error("Preload: webUtils.getPathForFile did not return a valid path string. Path was:", filePath, "File object:", file);
                // Optionally, send an error message back to the renderer here
                // ipcRenderer.send("display-message", "Error: Could not get file path.");
            }
        } catch (error) {
            console.error("Preload: Error using webUtils.getPathForFile:", error, "File object:", file);
            // Optionally, send an error message back to the renderer here
            // ipcRenderer.send("display-message", "Error: Problem processing file path.");
        }
    } else {
        console.error("Preload: redactFile (Option B) received invalid file object:", file);
        // ipcRenderer.send("display-message", "Error: Invalid file object received.");
    }
  }, // <<< THE STRAY COMMA WAS HERE AND HAS BEEN REMOVED
  decodeWord: (text) => {
    // Ensure you have a handler for "decode-word" in main.js if you use this
    return ipcRenderer.invoke("decode-word", text);
  },
});