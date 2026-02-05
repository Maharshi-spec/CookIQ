
import React, { useState, useRef, useEffect } from 'react';
import { LiveServerMessage } from '@google/genai';
import { AppState, RecipeSet, StoredRecipeSet } from './types';
import { 
  generateRecipe, 
  analyzeImageForIngredients, 
  connectVoiceAssistant, 
  decode, 
  decodeAudioData, 
  createBlob 
} from './services/geminiService';
import { dbService } from './services/dbService';
import { RecipeDisplay } from './components/RecipeDisplay';

const LANGUAGES = [
  { label: 'English', value: 'English' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'Marathi', value: 'Marathi' },
  { label: 'Tamil', value: 'Tamil' },
  { label: 'Telugu', value: 'Telugu' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'French', value: 'French' }
];

const TIME_OPTIONS = [
  { label: 'Any', value: 'Any Time' },
  { label: '15m', value: 'Under 15 mins' },
  { label: '30m', value: 'Under 30 mins' },
  { label: '60m', value: 'Under 60 mins' }
];

const PANTRY_STAPLES = ["Onions", "Potatoes", "Eggs", "Milk", "Flour", "Tomato", "Paneer", "Spinach"];

const App: React.FC = () => {
  const [ingredients, setIngredients] = useState('');
  const [language, setLanguage] = useState('English');
  const [timeLimit, setTimeLimit] = useState('Any Time');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [loadingStep, setLoadingStep] = useState(0);
  const [recipeSet, setRecipeSet] = useState<RecipeSet | null>(null);
  const [history, setHistory] = useState<StoredRecipeSet[]>([]);
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [aiVoiceTranscript, setAiVoiceTranscript] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const loadingMessages = [
    "Grounding in safety protocols...",
    "Scanning for unconventional items...",
    "Time-optimizing preparation methods...",
    "Simulating three distinct flavor profiles...",
    "Saving to your local database..."
  ];

  useEffect(() => {
    setHistory(dbService.getAll());
  }, []);

  useEffect(() => {
    let interval: any;
    if (appState === AppState.LOADING) {
      interval = setInterval(() => {
        setLoadingStep(s => (s + 1) % loadingMessages.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [appState]);

  const handleCook = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ingredients.trim()) return;

    setAppState(AppState.LOADING);
    setLoadingStep(0);
    setError('');
    
    try {
      const result = await generateRecipe(ingredients, language, timeLimit);
      dbService.saveRecipeSet(result);
      setHistory(dbService.getAll());
      setRecipeSet(result);
      setAppState(AppState.RESULT);
    } catch (err) {
      console.error(err);
      setError('Even for CookIQ, that was a tough one. Try adjusting your ingredients!');
      setAppState(AppState.ERROR);
    }
  };

  const downloadHistory = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cookiq_database_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const addStaple = (item: string) => {
    setIngredients(prev => {
      const list = prev ? prev.split(',').map(i => i.trim()).filter(Boolean) : [];
      if (!list.includes(item)) {
        return [...list, item].join(', ');
      }
      return prev;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const detected = await analyzeImageForIngredients(base64Data, file.type);
        setIngredients(prev => prev ? `${prev}, ${detected}` : detected);
        setIsAnalyzing(false);
      };
    } catch (err) {
      setIsAnalyzing(false);
      setError('Image analysis failed. Please type ingredients.');
    }
  };

  const triggerCamera = () => fileInputRef.current?.click();

  const reset = () => {
    setIngredients('');
    setRecipeSet(null);
    setAppState(AppState.IDLE);
    setError('');
  };

  const loadFromHistory = (stored: StoredRecipeSet) => {
    setRecipeSet(stored);
    setAppState(AppState.RESULT);
  };

  const deleteFromHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dbService.delete(id);
    setHistory(dbService.getAll());
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear your entire culinary history? This cannot be undone.")) {
      dbService.clearAll();
      setHistory([]);
    }
  };

  const startVoiceMode = async () => {
    if (isVoiceActive) { stopVoiceMode(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const sessionPromise = connectVoiceAssistant({
        onopen: () => setIsVoiceActive(true),
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.inputTranscription) setVoiceTranscript(prev => prev + ' ' + message.serverContent?.inputTranscription?.text);
          if (message.serverContent?.outputTranscription) setAiVoiceTranscript(prev => prev + ' ' + message.serverContent?.outputTranscription?.text);
          const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioData && outputAudioContextRef.current) {
            const ctx = outputAudioContextRef.current;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
          }
        },
        onclose: () => stopVoiceMode(),
      }, language);
      sessionRef.current = sessionPromise;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(inputData) }));
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContextRef.current.destination);
    } catch (err) { setError("Voice access denied."); }
  };

  const stopVoiceMode = () => {
    setIsVoiceActive(false);
    sessionRef.current?.then((s: any) => s.close());
    audioContextRef.current?.close();
    outputAudioContextRef.current?.close();
  };

  return (
    <div className="min-h-screen px-4 pb-20 pt-10 md:pt-20">
      <header className="max-w-4xl mx-auto text-center mb-16 space-y-4 relative">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-6xl font-serif text-black font-extrabold tracking-tight">CookIQ</h1>
        <p className="text-gray-500 text-lg max-w-lg mx-auto font-medium">
          Triple the choices, maximum safety. 
          Michelin-star AI at your command.
        </p>

        <div className="flex flex-wrap justify-center gap-3 pt-6">
          <button 
            onClick={() => {
              setAppState(appState === AppState.HISTORY ? AppState.IDLE : AppState.HISTORY);
              setShowRawData(false);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-2xl transition-all font-bold text-sm ${
              appState === AppState.HISTORY 
              ? 'bg-black text-white shadow-lg' 
              : 'bg-white text-gray-500 border border-gray-100 shadow-sm hover:border-black'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            My Cookbook ({history.length})
          </button>
          <div className="flex items-center gap-2 bg-white/80 border border-gray-100 px-4 py-2 rounded-2xl shadow-sm">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Language</span>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-sm font-semibold text-black outline-none cursor-pointer"
            >
              {LANGUAGES.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
            </select>
          </div>
          <button
            onClick={startVoiceMode}
            className={`flex items-center gap-2 px-5 py-2 rounded-2xl transition-all font-bold text-sm ${
              isVoiceActive 
              ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse' 
              : 'bg-white text-black border border-gray-100 shadow-sm hover:shadow-md'
            }`}
          >
            {isVoiceActive ? 'Listening...' : 'Talk to AI'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {isVoiceActive && (
          <div className="max-w-xl mx-auto mb-10 bg-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden transition-all duration-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-amber-400"></div>
            <div className="space-y-6">
              {voiceTranscript && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Chef's Guest</span>
                  <p className="bg-gray-800/50 px-5 py-3 rounded-2xl rounded-tr-none text-sm border border-gray-700 leading-relaxed max-w-[80%]">{voiceTranscript}</p>
                </div>
              )}
              {aiVoiceTranscript && (
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">CookIQ Assistant</span>
                  <p className="bg-white text-black px-5 py-3 rounded-2xl rounded-tl-none text-sm font-medium leading-relaxed max-w-[80%]">{aiVoiceTranscript}</p>
                </div>
              )}
              {!voiceTranscript && !aiVoiceTranscript && (
                <div className="py-6 text-center">
                  <div className="flex justify-center gap-1.5 mb-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="w-1.5 h-6 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}></div>
                    ))}
                  </div>
                  <p className="text-gray-400 font-medium">Listening for ingredients...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {appState === AppState.HISTORY ? (
          <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-top-10 duration-500">
            <div className="flex justify-between items-end mb-4 border-b border-gray-100 pb-6">
              <div>
                <h2 className="text-3xl font-serif font-extrabold text-black">Cookbook Journal</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Database: localStorage (cookiq_history_v1)</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowRawData(!showRawData)}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700 underline"
                >
                  {showRawData ? "Hide Database" : "Inspect Raw Data"}
                </button>
                <button onClick={() => setAppState(AppState.IDLE)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black">Exit</button>
              </div>
            </div>

            {showRawData ? (
              <div className="bg-gray-900 text-emerald-400 p-8 rounded-[2rem] shadow-inner font-mono text-xs overflow-x-auto border-2 border-indigo-900/30">
                <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-4">
                  <span className="text-gray-500 font-bold uppercase tracking-widest">JSON Inspector v1.0</span>
                  <span className="text-[10px] bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-400/20">Read-Only View</span>
                </div>
                <pre className="leading-relaxed">
                  {JSON.stringify(history, null, 2)}
                </pre>
              </div>
            ) : history.length === 0 ? (
               <div className="text-center py-24 bg-white/50 rounded-[3rem] border-2 border-dashed border-gray-100">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Your shelf is empty</p>
                  <button onClick={() => setAppState(AppState.IDLE)} className="mt-4 text-xs font-black text-indigo-500 hover:underline">Go Mix Something</button>
               </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {history.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => loadFromHistory(item)}
                    className="group bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-black transition-all cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <h3 className="text-lg font-black text-black group-hover:text-indigo-600 transition-colors">
                        {item.recipes[0].dishName}
                        {item.recipes.length > 1 && <span className="ml-2 text-xs font-bold text-gray-300">+{item.recipes.length - 1} options</span>}
                      </h3>
                      <div className="flex gap-3 mt-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest bg-indigo-50 px-2 rounded">
                          ID: {item.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => deleteFromHistory(e, item.id)}
                      className="p-3 text-gray-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
                
                <div className="pt-10 flex flex-col items-center gap-4">
                   <button 
                    onClick={downloadHistory}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                     Download Cookbook (.json)
                   </button>
                   <button 
                    onClick={handleClearAll}
                    className="px-6 py-3 border-2 border-red-100 text-red-400 hover:bg-red-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                   >
                     Nuke Database & Clear History
                   </button>
                </div>
              </div>
            )}
          </div>
        ) : (appState === AppState.IDLE || appState === AppState.LOADING || appState === AppState.ERROR) ? (
          <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="glass-card p-8 rounded-[3rem] shadow-2xl space-y-8">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">The Pantry</h3>
                <button
                  onClick={triggerCamera}
                  disabled={isAnalyzing}
                  className="group flex items-center gap-2 text-black hover:text-indigo-600 transition-colors font-bold text-xs uppercase tracking-widest"
                >
                  {isAnalyzing ? "Processing Image..." : (
                    <>
                      <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Visual Scan
                    </>
                  )}
                </button>
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>

              {/* Time Preference UI */}
              <div className="space-y-3 px-2">
                <div className="flex items-center gap-2">
                   <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Prep Time Limit</span>
                </div>
                <div className="flex gap-2">
                  {TIME_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTimeLimit(opt.value)}
                      className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                        timeLimit === opt.value 
                        ? 'bg-black text-white shadow-lg' 
                        : 'bg-white text-gray-400 border border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder="Enter all ingredients (or objects)..."
                  className="w-full h-44 p-6 rounded-[2rem] bg-gray-50/50 border-2 border-transparent focus:border-black/5 focus:bg-white transition-all resize-none text-lg text-black placeholder-gray-300 outline-none font-medium"
                  disabled={appState === AppState.LOADING}
                />
                
                <div className="absolute bottom-4 left-0 w-full px-6 flex flex-wrap gap-2 pointer-events-none">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 w-full">Quick Add:</div>
                  <div className="flex gap-2 pointer-events-auto overflow-x-auto pb-1 no-scrollbar">
                    {PANTRY_STAPLES.map(staple => (
                      <button 
                        key={staple} 
                        onClick={() => addStaple(staple)}
                        className="flex-shrink-0 px-3 py-1 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-gray-600 hover:border-black transition-colors"
                      >
                        + {staple}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {appState === AppState.LOADING ? (
                <div className="pt-4 space-y-4">
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-black transition-all duration-500 ease-in-out" style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}></div>
                  </div>
                  <p className="text-center text-sm font-bold text-gray-500 animate-pulse uppercase tracking-widest">
                    {loadingMessages[loadingStep]}
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleCook}
                  disabled={!ingredients.trim()}
                  className="w-full py-6 bg-black text-white rounded-[2rem] font-bold text-lg shadow-2xl hover:bg-gray-900 transition-all active:scale-[0.98] disabled:bg-gray-200 disabled:shadow-none"
                >
                  Synthesize Choices
                </button>
              )}
            </div>
            
            {error && <p className="text-center text-red-500 font-bold text-sm bg-red-50 p-4 rounded-2xl border border-red-100">{error}</p>}
          </div>
        ) : (
          recipeSet && <RecipeDisplay recipeSet={recipeSet} onReset={reset} />
        )}
      </main>

      <footer className="mt-24 text-center">
        <div className="inline-block px-4 py-2 bg-white/50 rounded-full border border-white text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          CookIQ &bull; Multi-Choice Intelligence &bull; V4.4
        </div>
      </footer>
    </div>
  );
};

export default App;
