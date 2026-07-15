"use client";

import { useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const quickPrompts = [
  "What are today's rice and maize prices?",
  "Should I buy rice now or wait?",
  "Give me savings advice",
  "Track my latest delivery",
];

const initialMessages = [
  {
    role: "assistant",
    content:
      "Ask me about grain prices, savings advice, market predictions, or delivery updates.",
  },
];

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AIFinancialAssistant({ admin = false }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const latestIntent = useMemo(() => {
    const latest = [...messages].reverse().find((message) => message.intent);
    return latest?.intent || "ready";
  }, [messages]);

  const sendMessage = async (value = input) => {
    const text = String(value || "").trim();

    if (!text || loading) return;

    setInput("");
    setLoading(true);

    const userMessage = {
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const res = await API.post("/ai-assistant/chat", { message: text });
      const assistantMessage = {
        role: "assistant",
        content: res.data.answer,
        intent: res.data.intent,
        suggestions: res.data.suggestions || [],
        source: res.data.source,
        created_at: res.data.created_at || new Date().toISOString(),
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Assistant could not respond");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "I could not reach the assistant service. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  return (
    <div className={admin ? "space-y-6" : "min-h-screen bg-slate-50 p-4 md:p-6"}>
      <div className={admin ? "space-y-6" : "max-w-6xl mx-auto space-y-6"}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              AI Financial Assistant
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Grain finance chat
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Ask for prices, buying guidance, savings targets, and delivery status from live Elohim data.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Assistant mode</p>
            <p className="text-lg font-bold text-slate-950 capitalize">{latestIntent}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          <aside className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm h-fit">
            <h2 className="text-sm font-bold text-slate-950">Quick prompts</h2>
            <div className="mt-4 space-y-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className="w-full text-left border border-slate-200 hover:border-green-600 hover:bg-green-50 disabled:opacity-60 text-slate-700 px-3 py-3 rounded-lg text-sm font-semibold"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </aside>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm min-h-[620px] flex flex-col">
            <div className="flex-1 p-4 md:p-5 overflow-y-auto space-y-4">
              {messages.map((message, index) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-lg px-4 py-3 ${
                        isUser
                          ? "bg-green-700 text-white"
                          : "bg-slate-100 text-slate-900 border border-slate-200"
                      }`}
                    >
                      <div className="whitespace-pre-line text-sm leading-6">{message.content}</div>
                      <div
                        className={`mt-2 text-[11px] ${
                          isUser ? "text-green-100" : "text-slate-500"
                        }`}
                      >
                        {message.created_at ? formatTime(message.created_at) : "Ready"}
                        {message.source ? ` - ${message.source}` : ""}
                      </div>

                      {!isUser && Array.isArray(message.suggestions) && message.suggestions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => sendMessage(suggestion)}
                              disabled={loading}
                              className="border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 px-2.5 py-1.5 rounded text-xs font-semibold"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="border-t border-slate-200 p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about grain prices, savings, predictions, or delivery..."
                  className="flex-1 border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-600"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-green-700 hover:bg-green-800 disabled:bg-slate-300 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Send
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
