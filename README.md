# ✂️ R.E.D.A.C.T  
**Restricting Exposed Data by Anonymization for Confidential Transmission**

🔐 An Electron-based app to **redact sensitive PII** from text documents and clipboard content, and **restore** it using a mapping mechanism.

---

## 🚀 Features

- 🧠 Redacts PII from clipboard and text files using a local LLM
- ✍️ Inline editing of redacted content
- 📋 Clipboard redaction/restoration with one click
- 📂 Drag-and-drop file support
- 🔔 Popup alerts and feedback
- 📄 Generates `-REDACTED` clones of PDF and TXT files

---

## 🖼️ Preview

![R.E.D.A.C.T Preview](public/images/preview.png)

---

## 🛠️ Installation

1. **Clone the Repository**  
   ```bash
   git clone https://github.com/KarthikBalaji-007/Freshathon.git
   cd redact
   ```

2. **Install Dependencies**  
   ```bash
   npm install
   ```

3. **Install LM Studio v0.3.5**  
   👉 [Download Here](https://releases.lmstudio.ai/linux/x86/0.3.5/beta/9h/LM_Studio-0.3.5.AppImage)  
   ⚠️ *Only v0.3.5 supports QNN models*

4. **Download Llama 3.2 3B Model**
   - With beta access: Llama 3.2 3B QNN
   - Without beta: Use LM Studio UI to download Llama 3.2 3B Instruct

5. **Configure the Model**
   - Open LM Studio and copy the `indexedModelIdentifier`
   - Paste it into `modelPath` in `src/config.json`

6. **Run the App**  
   (Make sure LM Studio is running with Local LLM Service enabled)  
   ```bash
   npm start
   

---

## 🧑‍💻 Usage

### 📋 Redact Clipboard Content
Click `Redact Clipboard` → PII is replaced with tags → Displayed in new window

### ♻️ Restore Clipboard Content
Click `Restore Clipboard` → Original content restored → Displayed in new window

### 📄 Redact a Document
Drag-and-drop TXT or PDF → Redacted content shown → Saved with `-REDACTED` suffix

### ✏️ Edit Redacted Text
Click redacted words to restore/edit them manually

---

## ⚠️ Note on Accuracy

This app uses a **lightweight local model** and may not perfectly detect all PII.  
Always **double-check redacted files** before sharing.

---

## 📁 Examples

Check the `examples/` folder for sample input/output:

- `example_data.txt` – Sample input text
- `example_data.txt-REDACTED.txt` – Redacted version
- `example_data.pdf` – Sample PDF
- `example_data.pdf-REDACTED.txt` – Redacted output as TXT

---

## 📜 License

[MIT License](LICENSE)

---

🌟 Feel free to fork, star, and contribute to make R.E.D.A.C.T even better!
```
