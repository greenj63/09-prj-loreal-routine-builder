// DOM Elements
let userInput = document.getElementById("userInput");
let chatWindow = document.getElementById("chatWindow");

// Chatbot fetch URL
const workerURL = "https://loreal-chatbot.jgreene6801.workers.dev/";

// System message
const directions = {
  role: "system",
  content:
    "You are a Smart Product Advisor for L'Oreal. You will only answer questions related to L'Oreal products and routines. Users will be commonly asking you to generate routines with a given list of products or ask for help deciding on products. If users have asked you to generate a routine, check that you have just received a system message with their list of products. If not, remind them to click the Generate Routine button. Assist users to the best of your ability. If users attempt to discuss topics unrelated to your responsibilities, focus the conversation on selecting a routine. Make consise responses.",
};

// Message history
const messages = JSON.parse(localStorage.getItem("chatHistory")) || [
  directions,
];

// Set HTML elements
export function setElements(
  userInputElement = document.getElementById("userInput"),
  chatWindowElement = document.getElementById("chatWindow"),
) {
  userInput = userInputElement;
  chatWindowElement = chatWindow;
}

// Scroll chat window to the bottom
export function scrollChatToBottom(smooth = true) {
  if (!chatWindow) chatWindow = document.getElementById("chatWindow");
  if (!chatWindow) return;
  try {
    chatWindow.scrollTo({
      top: chatWindow.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  } catch (e) {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

// Set initial message
export function startConversation(msg = "👋 Hello! How can I help you today?") {
  addThinkingMessage();
  setTimeout(() => {
    removeThinkingMessage();
    addAssistantMessage(msg);
  }, 600);
}

// Load all messages back into the chatbox from history
export function regenerateMessages(
  startMsg = "👋 Hello! How can I help you today?",
) {
  // Only directions are present, so start a conversation
  if (messages.length == 1) {
    startConversation(startMsg);
    return;
  }

  for (const msg of messages) {
    const { role, content } = msg;
    if (role == "user") addUserMessage(content);
    else if (role == "assistant") addAssistantMessage(content);
  }
}

// Gives the chatbot new system instructions
export async function sendSystemMessage(msg) {
  // Add the message to the messages
  messages.push({ role: "system", content: msg });
}

// Takes a message from the user and fetches an answer from the L'Oreal Chatbot
// Saves this interaction to the chat history and returns only the response.
export async function generateResponse(msg) {
  // Add the user message to the messages array
  messages.push({ role: "user", content: msg });

  // Fetch a response from the chatbot
  try {
    const response = await fetch(workerURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
      }),
    });

    // Check if the response was ok
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Parse JSON response
    const result = await response.json();

    // Get the chatbot reply
    const reply = result.choices[0].message.content;

    // Add reply to chat history
    messages.push({ role: "assistant", content: reply });

    // Save chat history
    localStorage.setItem("chatHistory", JSON.stringify(messages));

    // Return the reply
    return reply;
  } catch (err) {
    // log the error
    console.error(err);
  }
  return "Error generating reply. Please try again later";
}

export function sendMessage(userMsg = userInput.value) {
  // Clear input
  userInput.value = "";

  // place the user message in a bubble within the chatbox
  addUserMessage(userMsg);

  // wait for a short amount of time before reply for realism
  setTimeout(async () => {
    // get the chatbot reply
    addThinkingMessage();
    const reply = await generateResponse(userMsg);

    // Add an assistant chat bubble with the reply
    removeThinkingMessage();
    addAssistantMessage(reply);
  }, 700);
}

// Generates a user message bubble with the content stored in msg
export function addUserMessage(msg) {
  // generate a user messages section
  const userMessages = document.createElement("div");
  userMessages.classList.add("messages", "user");

  // generate a message bubble
  const bubble = document.createElement("p");
  bubble.classList.add("bubble");
  bubble.innerHTML = stylizeToHTML(msg);

  // put elements inside the chatbox
  userMessages.appendChild(bubble);
  // start in the "enter" state then trigger the show state for animation
  userMessages.classList.add("enter");
  chatWindow.appendChild(userMessages);

  // trigger the transition on the next frame
  requestAnimationFrame(() => {
    userMessages.classList.add("show");
    userMessages.classList.remove("enter");
  });
  // ensure the latest message is visible
  scrollChatToBottom();
}

// Generates an assistant message bubble with the content stored in msg
export async function addAssistantMessage(msg) {
  // generate an assistant messages section
  const assistantMessages = document.createElement("div");
  assistantMessages.classList.add("messages", "ai");

  // generate an assistant reply bubble
  const bubble = document.createElement("p");
  bubble.classList.add("bubble");
  bubble.innerHTML = stylizeToHTML(msg);

  // put elements inside the chatbox
  assistantMessages.appendChild(bubble);

  // start in the "enter" state then trigger the show state for animation
  assistantMessages.classList.add("enter");
  chatWindow.appendChild(assistantMessages);

  // trigger the transition on the next frame
  requestAnimationFrame(() => {
    assistantMessages.classList.add("show");
    assistantMessages.classList.remove("enter");
  });
  // ensure the latest message is visible
  scrollChatToBottom();
}

// Removes the AI thinking message bubble
export function removeThinkingMessage() {
  // select the first thinking message and remove it
  const el = document.querySelector(".thinking-msg");
  if (!el) return;
  // stop interval if present
  const intervalId = el._thinkingIntervalId;
  if (intervalId) clearInterval(intervalId);
  el.remove();
}

// Adds a thinking message bubble for the AI
export function addThinkingMessage() {
  // create the thinking element with per-letter spans
  const text = ". . .";
  const wrapper = document.createElement("div");
  wrapper.classList.add("messages", "ai", "thinking-msg");

  const bubble = document.createElement("p");
  bubble.classList.add("bubble");

  const thinking = document.createElement("span");
  thinking.classList.add("thinking");

  // create a span per letter
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement("span");
    span.classList.add("letter");
    span.textContent = text[i];
    thinking.appendChild(span);
  }

  bubble.appendChild(thinking);
  wrapper.appendChild(bubble);

  // start in the "enter" state then trigger the show state for animation
  wrapper.classList.add("enter");
  chatWindow.appendChild(wrapper);

  requestAnimationFrame(() => {
    wrapper.classList.add("show");
    wrapper.classList.remove("enter");
  });

  // keep thinking bubble visible
  scrollChatToBottom(false);

  // animate letters in sequence
  const letters = thinking.querySelectorAll(".letter");
  let idx = 0;
  // ensure at least one letter
  if (letters.length === 0) return;

  const intervalId = setInterval(() => {
    // remove active from previous
    letters.forEach((l) => l.classList.remove("active"));
    // set active on current
    letters[idx].classList.add("active");
    idx = (idx + 1) % letters.length;
  }, 260);

  // store interval id so remove can clear it
  wrapper._thinkingIntervalId = intervalId;
}

// Converts text to HTML code with appropriate styling.
// ** -> bold
// *  -> italic
// __ -> underlined
function stylizeToHTML(txt) {
  if (!txt || typeof txt !== "string") return txt;

  // Replace markdown links [text](url) first to avoid interfering with other styling
  txt = txt.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, (m, p1, p2) => {
    const safeUrl = p2.replace(/"/g, "%22");
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${p1}</a>`;
  });

  // Replace bold (**text**) next
  // Use non-greedy match so multiple pairs are handled
  txt = txt.replace(/\*\*(.+?)\*\*/g, (m, p1) => {
    return `<span class="stylized-bold">${p1}</span>`;
  });

  // Then replace italic (*text*)
  txt = txt.replace(/\*(.+?)\*/g, (m, p1) => {
    return `<span class="stylized-italic">${p1}</span>`;
  });

  // Finally replace underline (__text__)
  txt = txt.replace(/__(.+?)__/g, (m, p1) => {
    return `<span class="stylized-underline">${p1}</span>`;
  });

  return txt;
}
