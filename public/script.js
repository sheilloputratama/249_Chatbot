const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const quickPrompts = document.getElementById("quick-prompts");

const messages = [];

function getCurrentTime() {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatText(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function addMessage(text, sender) {
  const message = document.createElement("div");
  message.classList.add("message", sender);

  const meta = document.createElement("div");
  meta.classList.add("message-meta");
  const senderLabel = sender === "bot" ? "Atelier AI" : "Anda";
  meta.textContent = `${senderLabel} • ${getCurrentTime()}`;

  const content = document.createElement("div");
  content.classList.add("message-content");
  if (text) {
    content.innerHTML = formatText(text);
  }

  message.appendChild(meta);
  message.appendChild(content);

  if (sender === "bot") {
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.classList.add("copy-btn");
    copyBtn.textContent = "Salin respons";
    copyBtn.style.display = text ? "inline-block" : "none";

    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(content.textContent);
      copyBtn.textContent = "Tersalin";
      setTimeout(() => {
        copyBtn.textContent = "Salin respons";
      }, 1800);
    });

    message.appendChild(copyBtn);
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;
    return { content, copyBtn };
  }

  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
  return { content };
}

async function sendMessage(messageText) {
  const message = messageText.trim();
  if (!message) return;

  if (quickPrompts) {
    quickPrompts.style.display = "none";
  }

  addMessage(message, "user");
  messages.push({
    role: "user",
    content: message,
  });

  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;

  const { content: botContent, copyBtn } = addMessage("", "bot");
  let botResponse = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages, // Menggunakan 'messages' (dengan 's') sesuai backend
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Terjadi kesalahan");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

        const data = trimmedLine.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const token = JSON.parse(data);
          botResponse += token;
          botContent.innerHTML = formatText(botResponse);
          chatBox.scrollTop = chatBox.scrollHeight;
        } catch (error) {
          console.error("Gagal membaca token:", error);
        }
      }
    }

    if (botResponse && copyBtn) {
      copyBtn.style.display = "inline-block";
    }

    messages.push({
      role: "assistant",
      content: botResponse,
    });
  } catch (error) {
    console.error(error);
    botContent.textContent = "Mohon maaf, terjadi kendala: " + error.message;
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(userInput.value);
});

document.querySelectorAll(".prompt-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    sendMessage(chip.textContent);
  });
});

clearBtn.addEventListener("click", () => {
  messages.length = 0;
  chatBox.innerHTML = `
    <div class="message bot">
        <div class="message-meta">Atelier AI &bull; ${getCurrentTime()}</div>
        <div class="message-content">Sesi baru telah dimulai. Silakan sampaikan apa yang Anda butuhkan.</div>
    </div>
  `;
});