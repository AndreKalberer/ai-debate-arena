import { useState, useEffect } from 'react'

// Must be HTTPS in production — set VITE_API_BASE_URL in your .env
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050'
import type { ModelKey, Message, DiscussionMessage, DebateResultV2, DiscussionResult, Mode, SavedDebate, MessageReactions } from './types'
import { saveDebate, getTheme, setTheme as saveTheme, getSavedDebates } from './utils'
import HistorySidebar from './components/HistorySidebar'
import StatsModal from './components/StatsModal'
import TopicsBrowser from './components/TopicsBrowser'
import MessageWithReactions from './components/MessageWithReactions'
import InfoTooltip from './components/InfoTooltip'
import SignInPanel from './components/SignInPanel'
import { useAuth } from './auth/AuthContext'

export default function App() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme())
  const { user, loading: authLoading, available: authAvailable, signInWithGoogle, signOut } = useAuth()
  const [mode, setMode] = useState<Mode>('debate')
  const [topic, setTopic] = useState('')
  const [currentTopic, setCurrentTopic] = useState('') // Store the active topic for display
  const [singleModel, setSingleModel] = useState<ModelKey>('openai') // Single model for simple mode
  const [affModel, setAffModel] = useState<ModelKey>('openai')
  const [negModel, setNegModel] = useState<ModelKey>('anthropic')
  const [advancedMode, setAdvancedMode] = useState(false) // Simple mode by default
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DebateResultV2 | null>(null)
  const [discussionResult, setDiscussionResult] = useState<DiscussionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressStatus, setProgressStatus] = useState<string>('')
  const [streamingMessages, setStreamingMessages] = useState<Message[]>([])
  const [streamingDiscussionMessages, setStreamingDiscussionMessages] = useState<DiscussionMessage[]>([])
  
  // New feature states
  const [rounds, setRounds] = useState(2)
  const [temperature, setTemperature] = useState(0.7)
  const [showHistory, setShowHistory] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showTopics, setShowTopics] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [messageReactions, setMessageReactions] = useState<Record<number, MessageReactions>>({})
  // Rebuttal mode - coming soon
  // const [rebuttalMode, setRebuttalMode] = useState(false)
  // const [rebuttalTarget, setRebuttalTarget] = useState<'affirmative' | 'negative' | null>(null)
  // const [rebuttalQuestion, setRebuttalQuestion] = useState('')
  
  // Apply theme on mount and changes
  useEffect(() => {
    saveTheme(theme)
  }, [theme])
  
  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light')
  }
  
  const handleReaction = (msgIndex: number, reaction: keyof MessageReactions) => {
    setMessageReactions(prev => ({
      ...prev,
      [msgIndex]: {
        fire: prev[msgIndex]?.fire || 0,
        thinking: prev[msgIndex]?.thinking || 0,
        clap: prev[msgIndex]?.clap || 0,
        [reaction]: (prev[msgIndex]?.[reaction] || 0) + 1
      }
    }))
  }
  
  const handleLoadDebate = (savedDebate: SavedDebate) => {
    setShowHistory(false)
    if (savedDebate.mode === 'debate' && savedDebate.debateResult) {
      setMode('debate')
      setResult(savedDebate.debateResult)
      setCurrentTopic(savedDebate.debateResult.topic)
      setStreamingMessages([])
    } else if (savedDebate.mode === 'discussion' && savedDebate.discussionResult) {
      setMode('discussion')
      setDiscussionResult(savedDebate.discussionResult)
      setCurrentTopic(savedDebate.discussionResult.topic)
      setStreamingDiscussionMessages([])
    }
  }

  // Debug log whenever advancedMode changes (disabled to prevent spam)
  // useEffect(() => {
  //   console.log('🎭 DEBATE APP STATE:', { mode, advancedMode, singleModel, affModel, negModel, user: user?.uid })
  // }, [mode, advancedMode, singleModel, affModel, negModel, user])

  const stopDebate = () => {
    console.log('🛑 Stopping debate/discussion')
    setLoading(false)
    setProgressStatus('Stopped by user')
  }

  const runDebate = async () => {
    console.log('🎭 runDebate called', { topic, mode, loading, advancedMode })
    if (!topic.trim()) {
      alert('Please enter a debate topic')
      return
    }

    const userTopic = topic
    setCurrentTopic(userTopic) // Store for display
    setTopic('') // Clear input immediately
    setLoading(true)
    setError(null)
    setResult(null)
    setDiscussionResult(null)
    setProgressStatus('Connecting to server...')
    setStreamingMessages([])
    setStreamingDiscussionMessages([])

    if (mode === 'discussion') {
      runDiscussionMode(userTopic)
      return
    }

    // In simple mode, use the same model for both sides
    // In advanced mode, use different models
    let finalAffModel = affModel
    let finalNegModel = negModel
    if (!advancedMode) {
      finalAffModel = singleModel
      finalNegModel = singleModel
      console.log('Simple mode: Using', singleModel, 'for both sides')
    } else {
      console.log('Advanced mode: Affirmative:', finalAffModel, 'vs Negative:', finalNegModel)
    }

    try {
      // First make POST request to initiate the debate
      console.log('Sending debate request', { finalAffModel, finalNegModel })
const response = await fetch(`${API_BASE}/run-debate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: userTopic,
          affirmativeModel: finalAffModel,
          negativeModel: finalNegModel,
          rounds: rounds,
          temperature: temperature,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start debate')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response stream')
      }

      let buffer = ''
      let currentEvent = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.substring(6).trim()
          } else if (line.startsWith('data:')) {
            if (currentEvent) {
              try {
                const data = JSON.parse(line.substring(5).trim())
                
                if (currentEvent === 'progress') {
                  setProgressStatus(data.status)
              } else if (currentEvent === 'message') {
                  // Typewriter effect: reveal words one by one
                  const incoming = data as Message
                  // Push placeholder message with empty text
                  setStreamingMessages(prev => [...prev, { ...incoming, text: '' }])
                  const words = (incoming.text || '').split(/\s+/)
                  let i = 0
                  const interval = setInterval(() => {
                    i++
                    setStreamingMessages(prev => {
                      const next = [...prev]
                      const lastIndex = next.length - 1
                      if (lastIndex >= 0) {
                        next[lastIndex] = {
                          ...next[lastIndex],
                          text: words.slice(0, i).join(' '),
                        }
                      }
                      return next
                    })
                    if (i >= words.length) clearInterval(interval)
                  }, 18)
                } else if (currentEvent === 'complete') {
                  const completeResult = { ...data, rounds, temperature }
                  setResult(completeResult)
                  setProgressStatus('Debate complete!')
                  setLoading(false)
                  // Auto-save debate
                  saveDebate('debate', completeResult)
                } else if (currentEvent === 'error') {
                  throw new Error(data.message)
                }
                currentEvent = ''
              } catch (parseErr) {
                console.error('Failed to parse SSE data:', parseErr)
              }
            }
          }
        }
      }
    } catch (err: any) {
      let errorMsg = err.message || 'Something went wrong'
      
      // Check for common API errors
      if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('rate limit')) {
        errorMsg = '⚠️ API rate limit exceeded. Please try again in a few moments.'
      } else if (err.message?.includes('402') || err.message?.includes('insufficient_quota') || err.message?.includes('billing')) {
        errorMsg = '💳 API credits exhausted. Please check your OpenAI/Anthropic/Google billing.'
      } else if (err.message?.includes('401') || err.message?.includes('unauthorized') || err.message?.includes('invalid api key')) {
        errorMsg = '🔑 API authentication failed. Please check your API keys.'
      } else if (err.message?.includes('503') || err.message?.includes('overloaded')) {
        errorMsg = '⏳ AI service is temporarily overloaded. Please try again.'
      }
      
      setError(errorMsg)
      setLoading(false)
    }
  }

  const runDiscussionMode = async (userTopic: string) => {
    try {
const response = await fetch(`${API_BASE}/run-discussion-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: userTopic }),
      })

      if (!response.ok) {
        throw new Error('Failed to start discussion')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response stream')
      }

      let buffer = ''
      let currentEvent = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.substring(6).trim()
          } else if (line.startsWith('data:')) {
            if (currentEvent) {
              try {
                const data = JSON.parse(line.substring(5).trim())
                
                if (currentEvent === 'progress') {
                  setProgressStatus(data.status)
                } else if (currentEvent === 'message') {
                  const incoming = data as DiscussionMessage
                  setStreamingDiscussionMessages(prev => [...prev, { ...incoming, text: '' }])
                  const words = (incoming.text || '').split(/\s+/)
                  let i = 0
                  const interval = setInterval(() => {
                    i++
                    setStreamingDiscussionMessages(prev => {
                      const next = [...prev]
                      const lastIndex = next.length - 1
                      if (lastIndex >= 0) {
                        next[lastIndex] = {
                          ...next[lastIndex],
                          text: words.slice(0, i).join(' '),
                        }
                      }
                      return next
                    })
                    if (i >= words.length) clearInterval(interval)
                  }, 18)
                } else if (currentEvent === 'complete') {
                  setDiscussionResult(data)
                  setProgressStatus('Discussion complete!')
                  setLoading(false)
                  // Auto-save discussion
                  saveDebate('discussion', data)
                } else if (currentEvent === 'error') {
                  throw new Error(data.message)
                }
                currentEvent = ''
              } catch (parseErr) {
                console.error('Failed to parse SSE data:', parseErr)
              }
            }
          }
        }
      }
    } catch (err: any) {
      let errorMsg = err.message || 'Something went wrong'
      
      // Check for common API errors
      if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('rate limit')) {
        errorMsg = '⚠️ API rate limit exceeded. Please try again in a few moments.'
      } else if (err.message?.includes('402') || err.message?.includes('insufficient_quota') || err.message?.includes('billing')) {
        errorMsg = '💳 API credits exhausted. Please check your OpenAI/Anthropic/Google billing.'
      } else if (err.message?.includes('401') || err.message?.includes('unauthorized') || err.message?.includes('invalid api key')) {
        errorMsg = '🔑 API authentication failed. Please check your API keys.'
      } else if (err.message?.includes('503') || err.message?.includes('overloaded')) {
        errorMsg = '⏳ AI service is temporarily overloaded. Please try again.'
      }
      
      setError(errorMsg)
      setLoading(false)
    }
  }

  return (
    <div className={`h-screen flex overflow-hidden ${
      theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-[#f7f3f0] text-gray-900'
    }`}>
      {/* Left Sidebar */}
      <div className={`flex-shrink-0 flex flex-col border-r transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      } ${
        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
      }`}>
        {/* Sidebar Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        }`}>
          {!sidebarCollapsed && <h1 className="text-lg font-semibold">🎭 AI Arena</h1>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1.5 rounded-md transition ${
              theme === 'dark'
                ? 'hover:bg-gray-800 text-gray-400'
                : 'hover:bg-gray-100 text-gray-600'
            } ${sidebarCollapsed ? 'mx-auto' : ''}`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? (
                <path d="M9 18l6-6-6-6" />
              ) : (
                <path d="M15 18l-6-6 6-6" />
              )}
            </svg>
          </button>
        </div>
        
        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            onClick={() => setShowTopics(true)}
            className={`w-full px-3 py-2.5 rounded-md text-sm transition flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'gap-3'
            } ${
              theme === 'dark'
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
            title={sidebarCollapsed ? 'Browse Topics' : ''}
          >
            <span className="text-lg">💡</span>
            {!sidebarCollapsed && <span>Browse Topics</span>}
          </button>
          
          <button
            onClick={() => setShowStats(true)}
            className={`w-full px-3 py-2.5 rounded-md text-sm transition flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'gap-3'
            } ${
              theme === 'dark'
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
            title={sidebarCollapsed ? 'Statistics' : ''}
          >
            <span className="text-lg">📊</span>
            {!sidebarCollapsed && <span>Statistics</span>}
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-full px-3 py-2.5 rounded-md text-sm transition flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'gap-3'
            } ${
              showSettings
                ? theme === 'dark'
                  ? 'bg-gray-800 text-gray-200'
                  : 'bg-gray-100 text-gray-900'
                : theme === 'dark'
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
            title={sidebarCollapsed ? 'Settings' : ''}
          >
            <span className="text-lg">⚙️</span>
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
          
          {!sidebarCollapsed && (
            <>
              <div className={`my-3 border-t ${
                theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
              }`}></div>
              
              <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Recent
              </div>
              
              {/* History list inline */}
              {getSavedDebates().slice(0, 10).map(debate => {
                const topic = debate.mode === 'debate' 
                  ? debate.debateResult?.topic 
                  : debate.discussionResult?.topic
                return (
                  <button
                    key={debate.id}
                    onClick={() => handleLoadDebate(debate)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                      theme === 'dark'
                        ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{debate.mode === 'debate' ? '🎭' : '💬'}</span>
                      <span className="truncate text-xs">{topic}</span>
                    </div>
                  </button>
                )
              })}
              
              {getSavedDebates().length > 10 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition ${
                    theme === 'dark'
                      ? 'text-gray-500 hover:text-gray-300'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  View all →
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Sidebar Footer */}
        <div className={`p-2 border-t ${
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        }`}>
          {/* Auth + Theme */}
          <div className="flex flex-col gap-2">
            <button
              onClick={toggleTheme}
              className={`w-full px-3 py-2.5 rounded-md text-sm transition flex items-center ${
                sidebarCollapsed ? 'justify-center' : 'gap-3'
              } ${
                theme === 'dark'
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
              title={sidebarCollapsed ? (theme === 'dark' ? 'Dark Mode' : 'Light Mode') : ''}
            >
              <span className="text-lg">{theme === 'dark' ? '🌙' : '☀️'}</span>
              {!sidebarCollapsed && <span>{theme === 'dark' ? 'Dark' : 'Light'} Mode</span>}
            </button>

            {/* Sign in/out */}
            {authAvailable && (
              user ? (
                <button
                  onClick={signOut}
                  className={`w-full px-3 py-2.5 rounded-md text-sm transition flex items-center ${
                    sidebarCollapsed ? 'justify-center' : 'gap-3'
                  } ${
                    theme === 'dark'
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                  title={sidebarCollapsed ? 'Sign out' : ''}
                >
                  <span className="text-lg">🚪</span>
                  {!sidebarCollapsed && <span>Sign out</span>}
                </button>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className={`w-full px-3 py-2.5 rounded-md text-sm transition flex items-center ${
                    sidebarCollapsed ? 'justify-center' : 'gap-3'
                  } ${
                    theme === 'dark'
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                  title={sidebarCollapsed ? 'Sign in' : ''}
                >
                  <span className="text-lg">🔐</span>
                  {!sidebarCollapsed && <span>Sign in</span>}
                </button>
              )
            )}
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
      
      {/* Settings Panel */}
      {showSettings && mode === 'debate' && (
        <div className={`border-b px-6 py-4 ${
          theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-6 items-center">
              <div className="flex-1">
                <label className={`flex items-center text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Rounds: {rounds}
                  <InfoTooltip 
                    content="Number of back-and-forth exchanges in the debate. Each side will make this many arguments. More rounds = longer, deeper debates. (1-5)"
                    theme={theme}
                  />
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  disabled={loading}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <label className={`flex items-center text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Temperature: {temperature}
                  <InfoTooltip 
                    content="Controls AI creativity. Low (0.0-0.4) = focused and logical. Medium (0.5-0.7) = balanced. High (0.8-1.0) = creative and varied arguments."
                    theme={theme}
                  />
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  disabled={loading}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pb-40">
        <div className="min-h-full flex flex-col">
          {/* Optional auth gate */}
          {import.meta.env.VITE_REQUIRE_AUTH === 'true' && !authLoading && !user ? (
            <SignInPanel theme={theme} />
          ) : (
          <>
          {/* Welcome state - centered vertically */}
          {!loading && !result && !discussionResult && streamingMessages.length === 0 && streamingDiscussionMessages.length === 0 && (
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="text-center">
                <div className="text-7xl mb-6">{mode === 'debate' ? '🎭' : '💬'}</div>
                <h1 className={`text-5xl font-serif mb-3 ${
                  theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {mode === 'debate' ? 'AI Debate Arena' : 'AI Discussion Panel'}
                </h1>
                <p className={`text-lg ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {mode === 'debate' ? 'Watch AI models debate any topic' : 'Watch 3 AI models discuss and reach consensus'}
                </p>
              </div>
            </div>
          )}

          {/* Sticky Header - Topic and Progress */}
          {(streamingMessages.length > 0 || streamingDiscussionMessages.length > 0 || result || discussionResult || loading) && currentTopic && (
            <div className={`sticky top-0 z-10 backdrop-blur border-b shadow-sm ${
              theme === 'dark' 
                ? 'bg-gray-900/95 border-gray-800' 
                : 'bg-white/95 border-gray-200'
            }`}>
              <div className="max-w-3xl mx-auto px-6 py-3">
                <div className="flex items-center justify-between gap-4">
                  {/* Topic */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-blue-600 font-semibold text-sm flex-shrink-0">📋</span>
                    <span className="text-gray-700 text-sm truncate">{currentTopic}</span>
                  </div>
                  {/* Current Status */}
                  {loading && progressStatus && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="animate-spin h-3 w-3 border-2 border-orange-600 border-t-transparent rounded-full"></div>
                      <span className="text-xs text-gray-600">{progressStatus}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content when debate/discussion is running or complete */}
          {(streamingMessages.length > 0 || streamingDiscussionMessages.length > 0 || result || discussionResult || loading) && (
            <div className="max-w-3xl mx-auto w-full px-6 pt-6">
              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              {/* Old topic header and progress removed - now in sticky header */}

              {/* Chat messages - streaming or final */}
              {mode === 'debate' && (
                <div className="space-y-8 mb-8">
                  {(result?.messages || streamingMessages).map((msg, idx) => (
                    <MessageWithReactions
                      key={idx}
                      message={msg}
                      index={idx}
                      reactions={messageReactions[idx]}
                      onReact={handleReaction}
                      theme={theme}
                    />
                  ))}
                </div>
              )}

              {/* Discussion messages */}
              {mode === 'discussion' && (
                <div className="space-y-8 mb-8">
                  {(discussionResult?.messages || streamingDiscussionMessages).map((msg, idx) => {
                    const modelColors = {
                      openai: 'bg-blue-500',
                      anthropic: 'bg-orange-500',
                      gemini: 'bg-green-500'
                    }
                    const modelNames = {
                      openai: 'ChatGPT-5',
                      anthropic: 'Claude 4.5',
                      gemini: 'Gemini 2.5'
                    }
                    return (
                      <div key={idx} className="animate-fadeIn">
                        <div className="flex gap-4">
                          {/* Avatar */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${modelColors[msg.model]}`}>
                            {msg.model === 'openai' ? 'G' : msg.model === 'anthropic' ? 'C' : 'G'}
                          </div>
                          
                          {/* Message content */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-gray-900">
                                {modelNames[msg.model]}
                              </span>
                              <span className="text-xs text-gray-500">
                                Message #{msg.messageNumber}
                              </span>
                            </div>
                            <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Consensus message */}
              {discussionResult?.consensus && (
                <div className="mb-8 p-6 bg-green-50 border-2 border-green-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🤝</span>
                    <h3 className="text-lg font-semibold text-green-900">Consensus Reached!</h3>
                  </div>
                  <p className="text-gray-800 leading-relaxed">{discussionResult.consensus}</p>
                </div>
              )}
              
              {/* Judge verdicts - Debate mode */}
              {result && result.verdicts && (
                <div className="mt-12 pt-8 border-t border-gray-300">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">Judge Verdicts</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    {result.verdicts.map((v) => (
                      <div key={v.judge} className="bg-white rounded-xl p-4 border border-gray-300 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-gray-900 capitalize">
                            {v.judge}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            v.winner === 'affirmative'
                              ? 'bg-green-100 text-green-700'
                              : v.winner === 'negative'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {v.winner === 'affirmative' ? '✓ AFF' : v.winner === 'negative' ? '✗ NEG' : 'TIE'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{v.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Judge verdicts - Discussion mode */}
              {discussionResult?.verdicts && discussionResult.requiredJudging && (
                <div className="mt-12 pt-8 border-t border-gray-300">
                  <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <p className="text-yellow-800 font-medium">No consensus reached after 15 messages. Judges voting on best perspective:</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {discussionResult.verdicts.map((v) => {
                      const getWinnerLabel = (winner: string) => {
                        if (winner === 'openai') return '🔵 GPT-5'
                        if (winner === 'anthropic') return '🟠 Claude'
                        if (winner === 'gemini') return '🟢 Gemini'
                        return 'TIE'
                      }
                      return (
                        <div key={v.judge} className="bg-white rounded-xl p-4 border border-gray-300 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-gray-900 capitalize">
                              {v.judge === 'openai' ? 'GPT Judge' : v.judge === 'anthropic' ? 'Claude Judge' : 'Gemini Judge'}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                              {getWinnerLabel(v.winner as string)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">{v.reasoning}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          </>
        )}
        </div>
      </div>

      {/* Input Area - Fixed at bottom, aligned to content width */}
      <div 
        className="fixed bottom-0 right-0 pb-6 pointer-events-none transition-all duration-300"
        style={{ left: sidebarCollapsed ? '64px' : '256px' }}
      >
        <div className="max-w-3xl mx-auto px-6 pointer-events-auto">
          <div className={`rounded-2xl shadow-lg ${
            theme === 'dark' 
              ? 'bg-gray-900 border border-gray-800' 
              : 'bg-white border border-gray-200'
          }`}>
            {/* Mode selector */}
            <div className={`flex gap-1 p-2 ${
              theme === 'dark' ? 'border-b border-gray-800' : 'border-b border-gray-100'
            }`}>
              <button
                onClick={() => setMode('debate')}
                disabled={loading}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  mode === 'debate'
                    ? theme === 'dark'
                      ? 'bg-gray-800 text-gray-100'
                      : 'bg-gray-100 text-gray-900'
                    : theme === 'dark'
                    ? 'text-gray-500 hover:text-gray-300'
                    : 'text-gray-500 hover:text-gray-700'
                } disabled:opacity-50`}
              >
                🎭 Debate
              </button>
              <button
                onClick={() => setMode('discussion')}
                disabled={loading}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  mode === 'discussion'
                    ? theme === 'dark'
                      ? 'bg-gray-800 text-gray-100'
                      : 'bg-gray-100 text-gray-900'
                    : theme === 'dark'
                    ? 'text-gray-500 hover:text-gray-300'
                    : 'text-gray-500 hover:text-gray-700'
                } disabled:opacity-50`}
              >
                💬 Discussion
              </button>
            </div>
            <div className="flex items-center gap-2 p-4">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  console.log('Key pressed:', e.key, 'Shift:', e.shiftKey, 'Loading:', loading)
                  if (e.key === 'Enter' && !e.shiftKey && !loading) {
                    e.preventDefault()
                    console.log('Enter pressed, calling runDebate')
                    runDebate()
                  }
                }}
                placeholder={mode === 'debate' ? 'Enter a debate topic...' : 'Enter a discussion topic...'}
                className={`flex-1 px-2 py-2 resize-none focus:outline-none bg-transparent ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                }`}
                rows={1}
                disabled={loading}
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Simple mode - single model picker */}
                {mode === 'debate' && !advancedMode && (
                  <div className="flex items-center gap-2">
                    <select
                      value={singleModel}
                      onChange={(e) => setSingleModel(e.target.value as ModelKey)}
                      className="text-xs px-2 py-1 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 text-gray-600 bg-white"
                      disabled={loading}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Claude</option>
                      <option value="gemini">Gemini</option>
                    </select>
                    <button
                      onClick={() => {
                        console.log('Switching to advanced mode')
                        setAdvancedMode(true)
                      }}
                      disabled={loading}
                      className="text-xs px-3 py-1.5 border border-gray-300 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-200 transition disabled:opacity-50 font-medium"
                      title="Pick different models for each side"
                    >
                      vs
                    </button>
                  </div>
                )}
                {/* Advanced mode - two model pickers */}
                {mode === 'debate' && advancedMode && (
                  <div className="flex items-center gap-2">
                    <select
                      value={affModel}
                      onChange={(e) => setAffModel(e.target.value as ModelKey)}
                      className="text-xs px-2 py-1 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 text-gray-600 bg-white"
                      disabled={loading}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Claude</option>
                      <option value="gemini">Gemini</option>
                    </select>
                    <span className="text-xs text-gray-400">vs</span>
                    <select
                      value={negModel}
                      onChange={(e) => setNegModel(e.target.value as ModelKey)}
                      className="text-xs px-2 py-1 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 text-gray-600 bg-white"
                      disabled={loading}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Claude</option>
                      <option value="gemini">Gemini</option>
                    </select>
                    <button
                      onClick={() => {
                        console.log('Switching back to simple mode')
                        setAdvancedMode(false)
                      }}
                      disabled={loading}
                      className="text-xs px-3 py-1.5 border border-gray-300 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-200 transition disabled:opacity-50 font-medium"
                      title="Back to simple mode"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {mode === 'discussion' && (
                  <span className="text-xs text-gray-500 px-2">GPT-5 · Claude · Gemini</span>
                )}
                {/* Stop button when loading */}
                {loading && (
                  <button
                    onClick={stopDebate}
                    className="p-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    title="Stop"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="1"/>
                    </svg>
                  </button>
                )}
                {/* Start button when not loading */}
                {!loading && (
                  <button
                    onClick={() => {
                      console.log('Button clicked')
                      runDebate()
                    }}
                    disabled={!topic.trim()}
                    className="p-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title={mode === 'debate' ? 'Start Debate' : 'Start Discussion'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* End Main Content Area */}
      
      {/* Modals */}
      <HistorySidebar
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
        onLoadDebate={handleLoadDebate}
        theme={theme}
      />
      <StatsModal 
        isOpen={showStats} 
        onClose={() => setShowStats(false)}
        theme={theme}
      />
      <TopicsBrowser 
        isOpen={showTopics} 
        onClose={() => setShowTopics(false)}
        onSelectTopic={(t) => setTopic(t)}
        theme={theme}
      />
    </div>
  )
}
