'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { X, Send, Mic, Volume2, VolumeX, ChevronDown, SquarePen } from 'lucide-react'
import { APP_NAME, MASCOT_FACE } from '@/config/family'

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 · Fast' },
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6 · Balanced' },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6 · Powerful' },
]

const TOOL_LABELS: Record<string, string> = {
  get_meal_plan:          'Checking meal plan',
  search_dishes:          'Searching dishes',
  add_meal_to_plan:       'Adding to meal plan',
  remove_meal_from_plan:  'Updating meal plan',
  create_dish:            'Submitting dish',
  get_todos:              'Checking to-dos',
  create_todo:            'Adding to-do',
  update_todo:            'Updating to-do',
  delete_todo:            'Deleting to-do',
  get_schedule:           'Checking schedule',
  create_event:           'Adding event',
  update_event:           'Updating event',
  delete_event:           'Deleting event',
  get_links:              'Loading links',
  create_link:            'Adding link',
  search_web:             'Searching the web',
  fetch_dish_info:        'Fetching recipe',
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolActivities?: string[]
}

export default function ClawdiaChat() {
  const [isOpen, setIsOpen]           = useState(false)
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState('')
  const [model, setModel]             = useState('claude-sonnet-4-6')
  const [isLoading, setIsLoading]     = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [toolActivity, setToolActivity]   = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [ttsEnabled, setTtsEnabled]   = useState(false)
  const [hasSpeech, setHasSpeech]     = useState(false)

  const scrollRef      = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setHasSpeech(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streamingText, toolActivity])

  function resizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMessage: Message = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
    setIsLoading(true)
    setStreamingText('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          model,
        }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''
      const toolActivities: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          try {
            const event = JSON.parse(part.slice(6))
            if (event.type === 'text') {
              accumulatedText += event.text
              setStreamingText(accumulatedText)
            } else if (event.type === 'tool_start') {
              const label = TOOL_LABELS[event.name] ?? event.name
              setToolActivity(label)
              toolActivities.push(label)
            } else if (event.type === 'tool_done') {
              setToolActivity(null)
            } else if (event.type === 'done') {
              if (accumulatedText) {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: accumulatedText,
                  toolActivities: toolActivities.length ? [...new Set(toolActivities)] : undefined,
                }])
                if (ttsEnabled) speak(accumulatedText)
              }
              setStreamingText('')
            } else if (event.type === 'error') {
              setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${event.message}` }])
              setStreamingText('')
            }
          } catch { /* ignore parse errors on malformed chunks */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
      setStreamingText('')
    } finally {
      setIsLoading(false)
      setToolActivity(null)
    }
  }

  function startListening() {
    const w = window as Window & { SpeechRecognition?: new () => {
      lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void
      onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
      onerror:  (() => void) | null
      onend:    (() => void) | null
    }; webkitSpeechRecognition?: unknown }
    const SR = w.SpeechRecognition ?? (w.webkitSpeechRecognition as typeof w.SpeechRecognition)
    if (!SR) return

    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = false  // final results only — interim is unreliable on Android/iOS

    let finalTranscript = ''
    let silenceTimer: ReturnType<typeof setTimeout> | null = null

    function resetSilenceTimer() {
      if (silenceTimer) clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => recognition.stop(), 1500)
    }

    recognition.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        finalTranscript += e.results[i][0].transcript + ' '
      }
      setInput(finalTranscript.trim())
      resetSilenceTimer()
    }

    recognition.onerror = () => {
      if (silenceTimer) clearTimeout(silenceTimer)
      setIsListening(false)
    }

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer)
      setIsListening(false)
      const text = finalTranscript.trim()
      if (text) { setInput(''); sendMessage(text) }
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    // onend will handle setIsListening(false) and sending
  }

  function speak(text: string) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }

  return (
    <>
      <style>{`
        @keyframes soundbar {
          0%, 100% { transform: scaleY(0.2); }
          50%       { transform: scaleY(1);   }
        }
      `}</style>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full shadow-xl transition-transform active:scale-95"
        style={{
          width: 128, height: 128,
          border: '3px solid #fff',
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--ember)',
        }}
        title={`${APP_NAME} Chat`}
      >
        <Image src={MASCOT_FACE} alt={`${APP_NAME} Chat`} width={128} height={128} className="object-contain" />
      </button>

      {/* Chat panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setIsOpen(false)} />

          <div
            className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl shadow-2xl"
            style={{ height: '88vh', background: 'var(--parchment-2)', borderTop: '1px solid var(--border-strong)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 shrink-0 rounded-t-2xl"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-3)' }}>
              <Image src={MASCOT_FACE} alt={APP_NAME} width={30} height={30} className="shrink-0" />
              <span className="font-display font-medium text-base" style={{ color: 'var(--ink)' }}>{APP_NAME} Chat</span>

              <div className="ml-auto flex items-center gap-1">
                {/* New chat */}
                {messages.length > 0 && (
                  <button
                    onClick={() => { setMessages([]); setStreamingText(''); setToolActivity(null) }}
                    className="flex items-center justify-center rounded-xl transition-colors"
                    style={{ minWidth: 44, minHeight: 44, color: 'var(--ink-4)' }}
                    title="New chat"
                  >
                    <SquarePen size={18} strokeWidth={1.75} />
                  </button>
                )}

                {/* TTS toggle */}
                <button
                  onClick={() => setTtsEnabled(v => !v)}
                  className="flex items-center justify-center rounded-xl transition-colors"
                  style={{ minWidth: 44, minHeight: 44, color: ttsEnabled ? 'var(--ember)' : 'var(--ink-4)' }}
                  title={ttsEnabled ? 'Voice responses on' : 'Voice responses off'}
                >
                  {ttsEnabled
                    ? <Volume2 size={18} strokeWidth={1.75} />
                    : <VolumeX size={18} strokeWidth={1.75} />}
                </button>

                {/* Model selector */}
                <div className="relative">
                  <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="appearance-none pl-3 pr-7 rounded-xl text-sm outline-none cursor-pointer"
                    style={{ minHeight: 44, background: 'var(--parchment-5)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
                  >
                    {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <ChevronDown size={12} strokeWidth={2} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-4)' }} />
                </div>

                {/* Close */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center rounded-xl"
                  style={{ minWidth: 44, minHeight: 44, color: 'var(--ink-3)' }}
                >
                  <X size={20} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Big mic button — easy to reach at top of panel */}
            {hasSpeech && (
              <div className="px-4 py-3 shrink-0 flex justify-center" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="relative w-full flex items-center justify-center" style={{ height: 80 }}>
                  {isListening && (
                    <>
                      <span className="absolute inset-0 rounded-2xl animate-ping"
                        style={{ background: 'rgba(234,88,12,0.18)' }} />
                      <span className="absolute inset-0 rounded-2xl animate-ping"
                        style={{ background: 'rgba(234,88,12,0.10)', animationDelay: '0.35s' }} />
                    </>
                  )}
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className="relative w-full h-full rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                    style={{
                      background: isListening ? 'var(--ember)' : 'var(--parchment-4)',
                      color: isListening ? '#fff' : 'var(--ink-3)',
                      border: `2px solid ${isListening ? 'var(--ember)' : 'var(--border)'}`,
                    }}
                  >
                    {isListening ? (
                      <>
                        <div className="flex items-center gap-[4px]">
                          {[0.5, 1, 0.7, 1, 0.5].map((_, i) => (
                            <span key={i} style={{
                              display: 'inline-block', width: 4, height: 28, borderRadius: 9999,
                              background: '#fff', transformOrigin: 'center',
                              animationName: 'soundbar', animationDuration: `${0.45 + i * 0.08}s`,
                              animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
                              animationDelay: `${i * 0.09}s`,
                            }} />
                          ))}
                        </div>
                        <span className="text-base font-medium">Listening… tap to stop</span>
                      </>
                    ) : (
                      <>
                        <Mic size={28} strokeWidth={1.75} />
                        <span className="text-base font-medium">Tap to speak</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">

              {/* Empty state */}
              {messages.length === 0 && !isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center pb-12">
                  <Image src={MASCOT_FACE} alt={APP_NAME} width={60} height={60} className="opacity-50" />
                  <p className="text-base font-medium" style={{ color: 'var(--ink-2)' }}>Hi! I&apos;m {APP_NAME}.</p>
                  <p className="text-sm max-w-xs" style={{ color: 'var(--ink-4)' }}>
                    I can check your meal plan, add to-dos, look up the schedule, and more. Just ask!
                  </p>
                </div>
              )}

              {/* Message history */}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[82%] px-4 py-3 rounded-2xl text-base leading-relaxed whitespace-pre-wrap"
                    style={msg.role === 'user'
                      ? { background: 'var(--ember)', color: '#fff', borderBottomRightRadius: 6 }
                      : { background: 'var(--parchment-3)', color: 'var(--ink)', border: '1px solid var(--border)', borderBottomLeftRadius: 6 }
                    }
                  >
                    {msg.content}
                    {msg.toolActivities && msg.toolActivities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                        {msg.toolActivities.map((a, j) => (
                          <span key={j} className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--parchment-5)', color: 'var(--ink-4)', border: '1px solid var(--border)' }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Tool activity indicator */}
              {toolActivity && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-2xl text-sm flex items-center gap-2"
                    style={{ background: 'var(--parchment-3)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
                    <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: 'var(--ember)' }} />
                    {toolActivity}…
                  </div>
                </div>
              )}

              {/* Streaming bubble */}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[82%] px-4 py-3 rounded-2xl text-base leading-relaxed whitespace-pre-wrap"
                    style={{ background: 'var(--parchment-3)', color: 'var(--ink)', border: '1px solid var(--border)', borderBottomLeftRadius: 6 }}>
                    {streamingText}
                    <span className="inline-block w-0.5 h-[1em] ml-0.5 align-middle animate-pulse" style={{ background: 'var(--ember)' }} />
                  </div>
                </div>
              )}

              {/* Loading dots — shown before any text arrives */}
              {isLoading && !streamingText && !toolActivity && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl flex gap-1.5 items-center"
                    style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-2 h-2 rounded-full animate-bounce"
                        style={{ background: 'var(--ink-4)', animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 flex gap-2 items-end shrink-0"
              style={{ borderTop: '1px solid var(--border)', background: 'var(--parchment-3)' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); resizeTextarea() }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                placeholder={isListening ? 'Listening…' : 'Ask anything…'}
                rows={1}
                className="flex-1 px-4 py-3 rounded-2xl text-base outline-none resize-none"
                style={{
                  background: 'var(--parchment-5)',
                  color: 'var(--ink)',
                  border: '1px solid var(--border-strong)',
                  minHeight: 48,
                  maxHeight: 120,
                }}
              />

              {/* Mic button */}
              {hasSpeech && (
                <div className="relative shrink-0 flex items-center justify-center" style={{ width: 64, height: 64 }}>
                  {/* Ripple rings when listening */}
                  {isListening && (
                    <>
                      <span className="absolute inset-0 rounded-full animate-ping"
                        style={{ background: 'rgba(234,88,12,0.25)' }} />
                      <span className="absolute inset-0 rounded-full animate-ping"
                        style={{ background: 'rgba(234,88,12,0.15)', animationDelay: '0.35s' }} />
                    </>
                  )}
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className="relative flex items-center justify-center rounded-full transition-all active:scale-95"
                    style={{
                      width: 64, height: 64,
                      background: isListening ? 'var(--ember)' : 'var(--parchment-5)',
                      color: isListening ? '#fff' : 'var(--ink-3)',
                      border: `2px solid ${isListening ? 'var(--ember)' : 'var(--border)'}`,
                    }}
                    title={isListening ? 'Tap to stop' : 'Tap to speak'}
                  >
                    {isListening ? (
                      /* Equalizer bars */
                      <div className="flex items-center gap-[3px]">
                        {[0.5, 1, 0.7, 1, 0.5].map((_, i) => (
                          <span key={i} style={{
                            display: 'inline-block',
                            width: 3,
                            height: 20,
                            borderRadius: 9999,
                            background: '#fff',
                            transformOrigin: 'center',
                            animationName: 'soundbar',
                            animationDuration: `${0.45 + i * 0.08}s`,
                            animationTimingFunction: 'ease-in-out',
                            animationIterationCount: 'infinite',
                            animationDelay: `${i * 0.09}s`,
                          }} />
                        ))}
                      </div>
                    ) : (
                      <Mic size={24} strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              )}

              {/* Send button */}
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="flex items-center justify-center rounded-2xl shrink-0 transition-colors"
                style={{
                  minWidth: 48, minHeight: 48,
                  background: input.trim() && !isLoading ? 'var(--ember)' : 'var(--parchment-5)',
                  color:      input.trim() && !isLoading ? '#fff'           : 'var(--ink-4)',
                }}
              >
                <Send size={18} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
