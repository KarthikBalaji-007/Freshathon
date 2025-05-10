const dropArea = document.getElementById("drop-area");
const dropAreaIcon = document.getElementById("drop-area-icon");
const loadingIndicator = document.getElementById("loading-indicator");
const clipboard = document.getElementById("clipboard");
const restore = document.getElementById("restore");

document.getElementById("minimize-btn").addEventListener("click", () => {
  window.electronAPI.minimizeWindow();
});

document.getElementById("maximize-btn").addEventListener("click", () => {
  window.electronAPI.maximizeWindow();
});

document.getElementById("close-btn").addEventListener("click", () => {
  window.electronAPI.closeWindow();
});

// Prevent default behavior for drag-and-drop events
["dragenter", "dragover", "dragleave", "drop"].forEach((event) => {
  dropArea.addEventListener(event, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});

// Highlight the drop area on drag over
["dragenter", "dragover"].forEach((event) => {
  dropArea.addEventListener(event, () => {
    dropArea.classList.add("highlight");
  });
});

// Remove highlight when drag leaves or drop occurs
["dragleave", "drop"].forEach((event) => {
  dropArea.addEventListener(event, () => {
    dropArea.classList.remove("highlight");
  });
});

// Modify the drag-and-drop similarly
dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropArea.classList.remove("highlight");
  const files = e.dataTransfer.files;
  console.log("Renderer: Files dropped (sending whole object from drop):", files); // LOG 1 (modified)
  if (files.length) {
      const file = files[0];
      console.log("Renderer: File to redact (from drop, sending object):", file); // LOG 2 (modified)
      // LOG 3 will be effectively what LOG 2 shows
      window.electronAPI.redactFile(file); // Send the whole File object
  }
});

// Handle file picker
dropArea.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.onchange = (e) => {
      const file = e.target.files[0];
      console.log("Renderer: File selected via picker (sending whole object):", file); // LOG 4 (modified)
      if (file) { // Just check if a file was selected
          // LOG 5 will be effectively what LOG 4 shows
          window.electronAPI.redactFile(file); // Send the whole File object
      } else {
          console.error("Renderer: No file selected from picker.");
          alert("Error: No file selected.");
      }
  };
  input.click();
});

clipboard.addEventListener("click", () => {
  window.electronAPI.redactClipboard();
});

restore.addEventListener("click", () => {
  window.electronAPI.restoreClipboard();
});

// Listen for loading state changes
window.electronAPI.onLoadingStateChange((isLoading) => {
  if (isLoading) {
    loadingIndicator.style.display = "flex";
  } else {
    loadingIndicator.style.display = "none";
  }
});

// Listen for messages from the main process
window.electronAPI.onDisplayMessage((message) => {
  displayPopup(message);
});

// Function to display a popup message
function displayPopup(message) {
  const popup = document.createElement("div");
  popup.className = "popup-message";
  popup.textContent = message;
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.classList.add("show");
  }, 10);

  setTimeout(() => {
    popup.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(popup);
    }, 300);
  }, 3000);
}

// Function to open a new window with text content
function openNewWindowWithText(text1, text2) {
  window.electronAPI.openNewWindow(text1, text2);
}
