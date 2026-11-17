const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messagesElement = document.querySelector("#messages");

const conversation = [];

function addMessage(role, text = "") {
    const message = document.createElement("div");
    message.className = `message message--${role}`;

    const bubble = document.createElement("div");
    bubble.className = "message__bubble";
    bubble.textContent = text;

    message.append(bubble);
    messagesElement.append(message);
    messagesElement.scrollTop = messagesElement.scrollHeight;
    return bubble;
}

function setBusy(isBusy) {
    sendButton.disabled = isBusy;
    input.disabled = isBusy;
    sendButton.querySelector("span").textContent = isBusy ? "Menunggu..." : "Kirim";
}

async function sendMessage(text) {
    conversation.push({ role: "user", content: text });
    addMessage("user", text);
    const reply = addMessage("assistant");
    setBusy(true);

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: conversation })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(error?.error || `Permintaan gagal (${response.status})`);
        }

        if (!response.body) {
            throw new Error("Browser tidak mendukung streaming respons.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";

        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            if (done && buffer) {
                lines.push(buffer);
                buffer = "";
            }

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine.startsWith("data:")) {
                    continue;
                }

                const data = trimmedLine.slice(5).trim();
                if (data === "[DONE]") {
                    break;
                }

                try {
                    answer += JSON.parse(data);
                    reply.textContent = answer;
                    messagesElement.scrollTop = messagesElement.scrollHeight;
                } catch {
                    throw new Error("Format respons dari server tidak valid.");
                }
            }

            if (done) {
                break;
            }
        }

        if (!answer) {
            reply.textContent = "Maaf, saya belum menerima jawaban. Silakan coba lagi.";
        } else {
            conversation.push({ role: "assistant", content: answer });
        }
    } catch (error) {
        reply.textContent = error.message || "Terjadi kesalahan saat menghubungi server.";
        reply.classList.add("message__bubble--error");
    } finally {
        setBusy(false);
        input.focus();
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || sendButton.disabled) {
        return;
    }

    input.value = "";
    input.style.height = "auto";
    sendMessage(text);
});

input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});