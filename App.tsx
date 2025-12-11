/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { INTRO_STYLES, CUSTOM_STYLE, SUPPORTED_LANGUAGES } from './constants';
import { IntroStyle } from './types';
import { ALL_VOICES } from './voices';
import { StyleSelector } from './components/StyleSelector';
import { BauhausButton, getColorClass, DownloadIcon } from './components/BauhausComponents';
import { ConfigurationModal } from './components/ConfigurationModal';
import { SystemPromptModal } from './components/SystemPromptModal';
import { generateSpeech, createWavBlob, dramatizeText, generateScriptFromPDF } from './services/geminiService';

const Footer: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`p-4 border-t-4 border-bauhaus-black bg-white text-[8px] text-gray-500 font-bold uppercase tracking-wider ${className}`}>
    Created by <a href="https://x.com/leslienooteboom" target="_blank" rel="noopener noreferrer" className="underline hover:text-bauhaus-red transition-colors">@leslienooteboom</a>
  </div>
);

// Helper to convert country code to flag emoji
const getFlagEmoji = (countryCode: string) => {
  if (!countryCode || countryCode.length !== 2 || !/^[A-Z]+$/.test(countryCode.toUpperCase())) {
    return '🌐';
  }
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char =>  127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const App: React.FC = () => {
  const [currentStyle, setCurrentStyle] = useState<IntroStyle>(INTRO_STYLES[0]);
  const [text, setText] = useState<string>("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  
  // Voice State
  const [selectedVoice, setSelectedVoice] = useState<string>(INTRO_STYLES[0].defaultVoice);
  const [secondVoice, setSecondVoice] = useState<string>(INTRO_STYLES[0].secondVoice || 'Kore');
  
  // States for PDF/Script flow
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scriptGenerated, setScriptGenerated] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDramatizing, setIsDramatizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadData, setDownloadData] = useState<{ url: string, filename: string } | null>(null);
  const [flagIndex, setFlagIndex] = useState(0);

  // Auto-scroll state for languages
  const [isHoveringLang, setIsHoveringLang] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Custom State initialized from constants.ts to match description
  const [customStylePrompt, setCustomStylePrompt] = useState<string>(CUSTOM_STYLE.description);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);
  
  // Generation Ref to handle cancellation
  const generationIdRef = useRef(0);

  // Cycle flags
  useEffect(() => {
    const interval = setInterval(() => {
      setFlagIndex((prev) => (prev + 1) % SUPPORTED_LANGUAGES.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Clear download data when voice changes to ensure regeneration/replay logic is correct
  useEffect(() => {
    setDownloadData(null);
  }, [selectedVoice, secondVoice]);

  // Update text and default voice when style changes
  const handleStyleChange = (style: IntroStyle) => {
    setCurrentStyle(style);
    setSelectedVoice(style.defaultVoice);
    if (style.secondVoice) {
        setSecondVoice(style.secondVoice);
    }
    setError(null);
    setDownloadData(null); 
  };

  const handleCustomize = () => {
    setCurrentStyle(CUSTOM_STYLE);
    setSelectedVoice(CUSTOM_STYLE.defaultVoice);
    if (CUSTOM_STYLE.secondVoice) {
        setSecondVoice(CUSTOM_STYLE.secondVoice);
    }
    setError(null);
    setDownloadData(null);
    if (!customStylePrompt) setCustomStylePrompt(CUSTOM_STYLE.description);
  };

  const handleStop = () => {
    // Stop Web Audio API Source
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    // Stop HTML5 Audio Element
    if (audioElemRef.current) {
      audioElemRef.current.pause();
      audioElemRef.current.currentTime = 0;
      audioElemRef.current = null;
    }
    setIsPlaying(false);
  };

  const getStylePrompt = () => {
    return currentStyle.id === 'custom' ? customStylePrompt : currentStyle.description;
  };

  // 1. File Upload Handler
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
        setPdfFile(file);
        setError(null);
        
        // Convert to Base64
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:application/pdf;base64,")
            const base64 = result.split(',')[1];
            setPdfBase64(base64);
        };
        reader.onerror = () => {
            setError("ファイルの読み込みに失敗しました。");
        };
        reader.readAsDataURL(file);
    } else {
        setError("PDFファイルのみ対応しています。");
    }
  };

  // 2. Analyze PDF & Generate Script
  const handleGenerateScript = async () => {
    if (!pdfBase64) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
        const stylePrompt = getStylePrompt();
        const generatedScript = await generateScriptFromPDF(pdfBase64, stylePrompt);
        setText(generatedScript);
        setScriptGenerated(true);
    } catch (err) {
        console.error(err);
        setError("スライドの解析に失敗しました。もう一度お試しください。");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleResetPDF = () => {
      setPdfFile(null);
      setPdfBase64(null);
      setScriptGenerated(false);
      setText("");
      setDownloadData(null);
  };

  // 3. Rewrite Script (Dramatize)
  const handleDramatize = async () => {
    if (!text.trim()) return;
    setIsDramatizing(true);
    setError(null);
    try {
      const stylePrompt = getStylePrompt();
      const dramaticText = await dramatizeText(text, stylePrompt);
      setText(dramaticText);
      setDownloadData(null); 
    } catch (err) {
      console.error(err);
      setError("台本のリライトに失敗しました。");
    } finally {
      setIsDramatizing(false);
    }
  };

  // 4. Generate Audio (TTS)
  const handlePlay = async () => {
    if (isPlaying) {
      handleStop();
      return;
    }
    if (isGenerating) {
        setIsGenerating(false);
        generationIdRef.current += 1; 
        return;
    }
    if (downloadData && text.trim()) {
      try {
        const audio = new Audio(downloadData.url);
        audioElemRef.current = audio;
        setIsPlaying(true);
        audio.onended = () => {
            setIsPlaying(false);
            audioElemRef.current = null;
        };
        await audio.play();
        return;
      } catch (e) {
        console.warn("Replay failed, falling back to generation", e);
        setDownloadData(null);
      }
    }

    if (!text.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setDownloadData(null);

    const currentGenId = ++generationIdRef.current;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    try {
      const styleInstruction = getStylePrompt();
      // Pass both voices
      const result = await generateSpeech(text, selectedVoice, secondVoice, styleInstruction);
      
      if (currentGenId !== generationIdRef.current) return;

      const audioBuffer = result.buffer;
      const blob = createWavBlob(result.rawData);
      const url = URL.createObjectURL(blob);
      setDownloadData({
        url,
        filename: `podcast-script-${currentStyle.id}-${Date.now()}.wav`
      });
      
      setIsGenerating(false);
      setIsPlaying(true);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      sourceRef.current = source;
      source.onended = () => {
        setIsPlaying(false);
        sourceRef.current = null;
      };
      source.start();

    } catch (err) {
      if (currentGenId !== generationIdRef.current) {
          setIsGenerating(false);
          return;
      }
      console.error(err);
      setError("音声の生成に失敗しました。");
      setIsGenerating(false);
      setIsPlaying(false);
    }
  };

  const handleDownload = async () => {
    if (!downloadData) return;
    const a = document.createElement('a');
    a.href = downloadData.url;
    a.download = downloadData.filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    return () => {
      if (downloadData && downloadData.url.startsWith('blob:')) {
        URL.revokeObjectURL(downloadData.url);
      }
    };
  }, [downloadData]);

  const activeVoiceData = ALL_VOICES.find(v => v.name === selectedVoice);
  const activeVoiceLabel = activeVoiceData ? activeVoiceData.name : selectedVoice;
  const promptText = getStylePrompt();
  const promptPreview = promptText.replace(/\n/g, ' ').slice(0, 50);
  const isCustomMode = currentStyle.id === 'custom';

  return (
    <div className="flex flex-col md:flex-row bg-bauhaus-white font-sans text-bauhaus-black h-screen w-full overflow-hidden">
      {/* Sidebar - Style Selector */}
      <div className="w-full md:w-1/4 md:min-w-[300px] h-[180px] md:h-full flex-shrink-0 border-b-4 md:border-b-0 md:border-r-4 border-bauhaus-black z-10 flex flex-col bg-bauhaus-white">
        <div className="flex-1 min-h-0 relative">
          <StyleSelector 
            selectedStyle={currentStyle} 
            onSelect={handleStyleChange}
            onCustomize={handleCustomize}
          />
        </div>
        <Footer className="hidden md:block" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 overflow-hidden">
        
        {/* Header */}
        <div className="flex-shrink-0 border-b-4 border-bauhaus-black p-3 md:p-8 bg-white flex justify-between items-start z-10">
          <div>
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 md:mb-2">
              Slide to Podcast
            </h1>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-sm font-bold uppercase text-white ${getColorClass(currentStyle.color, true)}`}>
                {isCustomMode ? 'カスタム設定' : 'ホストのペルソナ'}
              </span>
              <span className="font-bold uppercase tracking-widest text-xs md:text-base">{currentStyle.name}</span>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-bold uppercase tracking-wide leading-tight">スライドを音声コンテンツに</p>
            <p className="text-xs font-bold uppercase tracking-wide leading-tight text-gray-500 mt-1">Gemini 2.5 が解説します</p>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-3 md:p-8 bg-bauhaus-white relative flex flex-col min-h-0">
          <div className="flex flex-col h-full">
            
            {/* Top Bar: Prompt & Language */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-x-4 gap-y-2 mb-2 md:mb-4 flex-shrink-0 z-30 relative">
               <button
                 onClick={() => setIsPromptOpen(true)}
                 className={`
                    flex-1 min-w-0 text-left px-3 py-2 border-2 border-dashed transition-all group flex items-center gap-2 w-full md:w-auto
                    ${isCustomMode 
                        ? 'bg-bauhaus-white border-bauhaus-black hover:bg-bauhaus-yellow' 
                        : 'bg-gray-100 border-gray-300 hover:border-bauhaus-black hover:bg-bauhaus-yellow hover:border-solid'
                    }
                 `}
              >
                 <span className={`text-[10px] font-bold uppercase text-white px-1.5 py-0.5 rounded-sm flex-shrink-0 ${isCustomMode ? 'bg-bauhaus-red' : 'bg-bauhaus-black'}`}>
                    {isCustomMode ? 'スタイル設定' : 'ホスト設定'}
                 </span>
                 <span className="font-mono text-xs text-gray-600 group-hover:text-bauhaus-black truncate flex-1">
                   {promptPreview}...
                 </span>
              </button>

              <div className="flex items-center gap-3 flex-shrink-0 self-end md:self-auto ml-auto md:ml-0">
                 {/* Language Display */}
                 <div className="flex items-center gap-2 py-2 px-3 border-2 border-transparent">
                     <span className="text-xs font-bold uppercase text-gray-500">Language</span>
                     <span className="text-base">{getFlagEmoji(SUPPORTED_LANGUAGES[flagIndex].code.split('-')[1])}</span>
                 </div>
              </div>
            </div>

            {/* Main Interactive Area */}
            <div className="relative flex-1 min-h-[100px] bg-white border-4 border-bauhaus-black shadow-hard flex flex-col overflow-hidden">
                
                {/* State A: File Upload (Visible when no script generated) */}
                {!scriptGenerated && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 bg-bauhaus-white/50 backdrop-blur-sm">
                        <div className={`
                            w-full max-w-xl border-4 border-dashed border-bauhaus-black bg-white p-8 md:p-12 text-center transition-all
                            ${pdfFile ? 'border-bauhaus-green bg-green-50' : 'hover:bg-bauhaus-yellow/10'}
                        `}>
                            {!pdfFile ? (
                                <>
                                    <div className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 text-bauhaus-black">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="square" strokeLinejoin="miter" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-bold uppercase mb-2">PDFをアップロード</h3>
                                    <p className="text-sm font-bold text-gray-500 mb-6">スライド資料をドラッグ＆ドロップ</p>
                                    <label className="inline-block cursor-pointer">
                                        <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                                        <span className="px-6 py-3 bg-bauhaus-black text-white font-bold uppercase hover:bg-bauhaus-blue transition-colors border-2 border-transparent">
                                            ファイルを選択
                                        </span>
                                    </label>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 mx-auto mb-4 text-bauhaus-green">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                            <path strokeLinecap="square" strokeLinejoin="miter" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold truncate max-w-full px-4 mb-6">{pdfFile.name}</h3>
                                    <div className="flex flex-col gap-3">
                                        <BauhausButton 
                                            onClick={handleGenerateScript}
                                            disabled={isAnalyzing}
                                            className="w-full"
                                            variant="primary"
                                        >
                                            {isAnalyzing ? (
                                                <span className="animate-pulse">分析中... (Gemini 2.5)</span>
                                            ) : (
                                                "台本を生成する"
                                            )}
                                        </BauhausButton>
                                        <button onClick={handleResetPDF} className="text-xs font-bold underline text-gray-500 hover:text-bauhaus-red">
                                            キャンセル
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* State B: Text Editor (Always rendered but covered by State A if !scriptGenerated) */}
                <textarea 
                    className="w-full h-full resize-none p-4 md:p-6 text-lg md:text-2xl font-bold bg-transparent outline-none leading-normal focus:bg-gray-50 custom-scrollbar"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        setDownloadData(null);
                    }}
                    placeholder=""
                    readOnly={!scriptGenerated}
                />
                
                {scriptGenerated && (
                    <div className="absolute top-4 right-4 flex gap-2">
                         <button 
                            onClick={handleDramatize}
                            disabled={isDramatizing}
                            className="bg-white border-2 border-bauhaus-black px-3 py-1 text-xs font-bold uppercase hover:bg-bauhaus-yellow shadow-[2px_2px_0px_0px_#1A1A1A] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50"
                        >
                            {isDramatizing ? "リライト中..." : "✨ リライト"}
                        </button>
                         <button 
                            onClick={handleResetPDF}
                            className="bg-bauhaus-white border-2 border-bauhaus-black px-3 py-1 text-xs font-bold uppercase hover:bg-gray-200"
                        >
                            別のPDF
                        </button>
                    </div>
                )}
                
                <div className="absolute bottom-4 right-4 text-[10px] md:text-xs font-bold bg-bauhaus-black text-white px-2 py-1 pointer-events-none z-10">
                    {text.length} 文字
                </div>
            </div>
            
            {error && (
              <div className="flex-shrink-0 mt-4 p-4 bg-bauhaus-red text-white font-bold border-4 border-bauhaus-black">
                エラー: {error}
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex-shrink-0 border-t-4 border-bauhaus-black bg-white p-3 md:p-8 z-20">
          <div className="flex items-center justify-between relative">
            
            <div className="flex-1 flex justify-start min-w-0 pr-2">
              <BauhausButton 
                onClick={handleDownload}
                disabled={!downloadData}
                variant="primary"
                icon={<DownloadIcon className="w-5 h-5 md:w-6 md:h-6" />}
                className="text-sm md:text-lg p-3 md:p-4 whitespace-nowrap focus:outline-none focus:ring-4 focus:ring-bauhaus-black"
              >
                <span className="hidden lg:inline">音声保存</span>
              </BauhausButton>
            </div>

            <div className="flex flex-col items-center justify-center flex-shrink-0 z-10 group">
              <button 
                onClick={handlePlay}
                disabled={isAnalyzing || (!text.trim() && !pdfFile)}
                className={`
                  w-14 h-14 md:w-24 md:h-24 rounded-full border-4 border-bauhaus-black flex items-center justify-center transition-all shadow-hard
                  focus:outline-none focus:ring-4 focus:ring-bauhaus-yellow
                  ${(isPlaying || isGenerating) ? 'bg-bauhaus-black hover:bg-gray-800' : 'bg-bauhaus-red hover:bg-red-600 hover:-translate-y-1'}
                  ${isGenerating ? 'hover:translate-y-2 hover:shadow-none' : ''}
                  ${(!text.trim() && !pdfFile) ? 'opacity-50 cursor-not-allowed transform-none' : ''}
                `}
              >
                {isGenerating ? (
                   <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white animate-pulse"></div>
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white animate-pulse delay-75"></div>
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white animate-pulse delay-150"></div>
                  </div>
                ) : isPlaying ? (
                  <div className="w-5 h-5 md:w-8 md:h-8 bg-white"></div>
                ) : (
                  <div className="w-0 h-0 border-t-[8px] md:border-t-[15px] border-t-transparent border-l-[14px] md:border-l-[25px] border-l-white border-b-[8px] md:border-b-[15px] border-b-transparent ml-1 md:ml-2"></div>
                )}
              </button>
              <span className="font-bold mt-4 uppercase tracking-widest text-[10px] md:text-base whitespace-nowrap">
                {isGenerating ? '音声生成中' : isPlaying ? '停止' : '再生'}
              </span>
            </div>

            <div className="flex-1 flex flex-col items-end justify-center min-w-0 pl-2">
               <div className="text-[10px] md:text-xs font-bold uppercase text-gray-500 mb-1 whitespace-nowrap">使用ボイス</div>
               <button 
                 type="button"
                 className={`
                   text-xs md:text-lg font-bold border-2 px-2 md:px-3 py-1 text-right transition-colors max-w-full truncate
                   focus:outline-none focus:ring-4 focus:ring-bauhaus-yellow
                   ${currentStyle.id === 'custom' 
                     ? 'bg-bauhaus-yellow border-bauhaus-black text-bauhaus-black' 
                     : 'bg-bauhaus-black border-bauhaus-black text-white cursor-pointer hover:bg-gray-800'
                   }
                 `}
                 onClick={() => setIsConfigOpen(true)}
               >
                 {activeVoiceLabel} {secondVoice ? `& ${secondVoice}` : ''}
               </button>
            </div>

          </div>
        </div>
        <Footer className="md:hidden flex-shrink-0" />
      </div>

      {/* Modals */}
      <ConfigurationModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)}
        selectedVoice={selectedVoice}
        onVoiceChange={setSelectedVoice}
      />
      
      <SystemPromptModal
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        prompt={promptText}
        isEditable={isCustomMode}
        currentVoice={selectedVoice}
        onSave={(newPrompt, newVoice) => {
            setCustomStylePrompt(newPrompt);
            if (newVoice) setSelectedVoice(newVoice);
            setDownloadData(null);
        }}
      />
    </div>
  );
};

export default App;