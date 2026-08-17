import React, { useState } from 'react';
import { Bot, Send, User, Sparkles, Database, CheckCircle2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  toolName?: string;
  timestamp: string;
}

export const AiAssistantView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      text: 'مرحباً بك! أنا **مساعد ميزان الذكي 🤖**.\n\nيمكنك سؤالي باللهجة الجزائرية أو العربية الفصحى مباشرة حول المنتجات، المبيعات، الأرباح الحقيقية، الديون، والمخزون.\n\nأمثلة تجريبية:\n• *"واش عندي من زيت؟"*\n• *"شحال بعت اليوم؟"*\n• *"شحال ربحت اليوم؟"*\n• *"محمد شحال عليه؟"*\n• *"كاين حليب ناقص؟"*',
      timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;

    const userText = inputQuery.trim();
    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userText, userId: 'usr-admin' })
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: 'ai-' + Date.now(),
          sender: 'ai',
          text: data.textResponse,
          toolName: data.toolName,
          timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    setInputQuery(promptText);
  };

  return (
    <div className="h-[calc(100vh-33px)] flex flex-col justify-between bg-slate-950 text-slate-100 p-6 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
            🤖
          </div>
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>مساعد ميزان المحلي (Mizan Local AI Assistant)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                Offline Tools Layer
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              يفهم الدارجة الجزائرية والعربية الفصحى ويستدعي أدوات SQLite المباشرة دون اختراع أي معلومات
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono hidden md:block">
          Engine: ILocalAIService (Offline First)
        </div>
      </div>

      {/* Quick Prompts Chips */}
      <div className="flex gap-2 overflow-x-auto py-2 text-xs shrink-0">
        {[
          'واش عندي من زيت؟',
          'شحال بعت اليوم؟',
          'شحال ربحت اليوم؟',
          'محمد شحال عليه؟',
          'كاين حليب ناقص؟'
        ].map((chip) => (
          <button
            key={chip}
            onClick={() => handleQuickPrompt(chip)}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 transition-colors whitespace-nowrap"
          >
            💡 {chip}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto my-3 space-y-4 pr-1">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                  isUser ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-400 border border-slate-700'
                }`}
              >
                {isUser ? 'أنت' : '🤖'}
              </div>

              <div
                className={`max-w-2xl p-4 rounded-2xl text-sm leading-relaxed space-y-2 ${
                  isUser
                    ? 'bg-emerald-600 text-white font-bold shadow-md'
                    : 'bg-slate-900 text-slate-200 border border-slate-800 shadow-md'
                }`}
              >
                {msg.toolName && (
                  <div className="text-[10px] font-mono text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 inline-flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>تم تنفيذ الأداة: {msg.toolName}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <span className="text-[10px] opacity-60 block text-left font-mono">{msg.timestamp}</span>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3 text-slate-400 text-xs italic bg-slate-900 p-3 rounded-2xl border border-slate-800 max-w-sm">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>جاري استدعاء أدوات SQLite وقراءة قاعدة البيانات...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="flex gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-lg shrink-0">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="اسأل المساعد بالدارجة الجزائرية أو الفصحى (مثال: واش عندي من زيت؟)..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-sm shadow-lg shadow-emerald-950/60 transition-all flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span>إرسال</span>
        </button>
      </form>
    </div>
  );
};
