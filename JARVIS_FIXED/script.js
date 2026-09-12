// J.A.R.V.I.S - FIXED VERSION
// Keeps the original UI/design. This file contains ALL JavaScript only.

"use strict";

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const voiceStatus = document.getElementById("voice-status");

// =====================================================
// 1. GEMINI API KEY POPUP
// =====================================================
// The key is requested with a browser popup.
// If an old key exists, it is tested first. If it fails,
// J.A.R.V.I.S asks for a new key automatically.

let API_KEY = localStorage.getItem("jarvis_key") || "";

async function getApiKey() {
  if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");
    if (API_KEY) {
      API_KEY = API_KEY.trim();
      localStorage.setItem("jarvis_key", API_KEY);
    }
  }

  return API_KEY;
}

// =====================================================
// 2. CURRENT GEMINI MODEL
// =====================================================
const MODEL = "gemini-3.8-flash";

// =====================================================
// 3. CHAT MESSAGE
// =====================================================
function add(text, who = "ai") {
  if (!chat) return;

  const d = document.createElement("div");
  d.className = `msg ${who}`.trim();
  d.textContent = text;

  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;

  return d;
}

// =====================================================
// 4. GEMINI CALL
// =====================================================
async function callGemini(prompt) {
  let key = await getApiKey();

  if (!key) {
    throw new Error("Gemini API Key was not entered.");
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "You are J.A.R.V.I.S. Answer naturally, clearly and helpfully. " +
                "The user may speak Telugu, Hindi or English. Reply in the language " +
                "the user uses when possible. User says: " + prompt
            }
          ]
        }
      ]
    })
  });

  let data = await response.json();

  // If saved key is invalid, ask for a fresh key once.
  if (!response.ok) {
    const message =
      data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;

    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403
    ) {
      const newKey = prompt(
        "Gemini API Key is invalid or not accepted. Enter a new Gemini API Key:"
      );

      if (newKey && newKey.trim()) {
        API_KEY = newKey.trim();
        localStorage.setItem("jarvis_key", API_KEY);

        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      "You are J.A.R.V.I.S. Answer naturally, clearly and helpfully. " +
                      "The user may speak Telugu, Hindi or English. Reply in the language " +
                      "the user uses when possible. User says: " + prompt
                  }
                ]
              }
            ]
          })
        });

        data = await response.json();
      }
    }

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `HTTP ${response.status}: ${response.statusText}`
      );
    }
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

// =====================================================
// 5. ASK GEMINI
// =====================================================
async function askGemini(prompt) {
  const thinking = add("J.A.R.V.I.S: Thinking...", "ai");

  try {
    const reply = await callGemini(prompt);

    if (thinking) {
      thinking.remove();
    }

    add("J.A.R.V.I.S: " + reply, "ai");
    speak(reply);
  } catch (error) {
    if (thinking) {
      thinking.remove();
    }

    add(
      "J.A.R.V.I.S ERROR: " +
        (error?.message || "Gemini request failed."),
      "ai"
    );

    console.error("Gemini error:", error);
  }
}

// =====================================================
// 6. SEND BUTTON
// =====================================================
function sendMessage() {
  const text = input?.value.trim();

  if (!text) {
    return;
  }

  add("YOU: " + text, "user");
  input.value = "";

  askGemini(text);
}

if (sendBtn) {
  sendBtn.addEventListener("click", sendMessage);
}

if (input) {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}

// =====================================================
// 7. MICROPHONE / SPEECH RECOGNITION
// =====================================================
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let listening = false;

function setMicButton(text) {
  if (micBtn) {
    micBtn.textContent = text;
  }
}

function setVoiceStatus(online) {
  if (!voiceStatus) return;

  if (online) {
    voiceStatus.textContent = "● ONLINE";
    voiceStatus.className = "on";
  } else {
    voiceStatus.textContent = "● LOCKED";
    voiceStatus.className = "off";
  }
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  // English is reliable in Chrome/Edge.
  // The browser can also detect spoken Telugu/Hindi reasonably
  // when the browser language supports it.
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    setMicButton("LISTENING...");
    setVoiceStatus(true);
    add("J.A.R.V.I.S: Listening...", "ai");
  };

  recognition.onresult = event => {
    const text =
      event?.results?.[0]?.[0]?.transcript?.trim() || "";

    if (!text) {
      add("J.A.R.V.I.S: I could not understand the voice.", "ai");
      return;
    }

    add("YOU: " + text, "user");
    askGemini(text);
  };

  recognition.onerror = event => {
    console.error("Speech recognition error:", event.error);

    const messages = {
      "not-allowed":
        "Microphone permission was denied. Allow microphone access in Chrome.",
      "service-not-allowed":
        "Browser speech service is not available.",
      "no-speech":
        "No speech detected. Press the mic button and speak.",
      "audio-capture":
        "No microphone was found. Check your microphone.",
      "network":
        "Speech recognition network error. Check your internet connection.",
      "aborted":
        "Microphone listening was stopped."
    };

    add(
      "J.A.R.V.I.S: " +
        (messages[event.error] || "Microphone error: " + event.error),
      "ai"
    );
  };

  recognition.onend = () => {
    listening = false;
    setMicButton("🎙️");
  };

  if (micBtn) {
    micBtn.addEventListener("click", async () => {
      if (listening) {
        recognition.stop();
        return;
      }

      try {
        // Force the browser microphone permission request.
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
          });

          // SpeechRecognition uses the browser audio service.
          // Stop this temporary stream so the microphone is not held twice.
          stream.getTracks().forEach(track => track.stop());
        }

        recognition.start();
      } catch (error) {
        console.error("Microphone start error:", error);

        add(
          "J.A.R.V.I.S: Microphone permission/access failed. " +
            "Allow microphone permission and try again.",
          "ai"
        );

        setMicButton("🎙️");
      }
    });
  }

  setVoiceStatus(true);
} else {
  setVoiceStatus(false);

  if (micBtn) {
    micBtn.addEventListener("click", () => {
      add(
        "J.A.R.V.I.S: Speech Recognition is not supported in this browser. Use Google Chrome or Microsoft Edge.",
        "ai"
      );
    });
  }
}

// =====================================================
// 8. TEXT TO SPEECH
// =====================================================
let voices = [];

function loadVoices() {
  if ("speechSynthesis" in window) {
    voices = speechSynthesis.getVoices();
  }
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.rate = 1.0;
  utterance.pitch = 0.85;
  utterance.volume = 1.0;

  const preferredVoice =
    voices.find(v => /^en-IN$/i.test(v.lang)) ||
    voices.find(v => /^en-US$/i.test(v.lang)) ||
    voices.find(v => /^en/i.test(v.lang));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  speechSynthesis.speak(utterance);
}

loadVoices();

if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = loadVoices;
}

// =====================================================
// 9. STARTUP
// =====================================================
add(
  "J.A.R.V.I.S: Systems online. Enter your Gemini API Key when the popup appears.",
  "ai"
);

// Ask immediately so the popup appears on page startup if no saved key exists.
getApiKey().catch(error => {
  console.error("API key setup error:", error);
});
