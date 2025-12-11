/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { INTRO_STYLES, CUSTOM_STYLE, SUPPORTED_LANGUAGES } from './constants';
import { IntroStyle } from './types';
import { ALL_VOICES } from './voices';
import { StyleSelector } from './components/StyleSelector';
import { BauhausButton, getColorClass, DownloadIcon, SquareIcon, RectIcon, IndeterminateProgressBar, CircleIcon, TriangleIcon } from './components/BauhausComponents';
import { ConfigurationModal } from './components/ConfigurationModal';
import { SystemPromptModal } from './components/SystemPromptModal';
import { generateSpeech, createWavBlob, dramatizeText, generateScriptFromPDF } from './services/geminiService';
// @ts-ignore
import * as pdfjsDist from 'pdfjs-dist';

// Handle potential default export structure for PDF.js
const pdfjsLib = (pdfjsDist as any).default || pdfjsDist;

if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

const Footer: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`p-4 border-t-4 border-bauhaus-black bg-white text-[8px] text-gray-500 font-bold uppercase tracking-wider ${className}`}>
    Created by <a href="https://x.com/leslienooteboom" target="_blank" rel="noopener noreferrer" className="underline hover:text-bauhaus-red transition-colors">@leslienooteboom</a>
  </div>
);

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

// --- Helper Types for Script Parsing ---
interface ScriptSegment {
  id: string;
  slideIndex: number; // 0-based index corresponding to image array
  speaker: 'Host' | 'Expert';
  text: string;
  startTime: number; // Estimated start time in seconds
  endTime: number; // Estimated end time in seconds
}

// --- Parsing Logic ---
const parseScriptToSegments = (fullText: string): ScriptSegment[] => {
  const segments: ScriptSegment[] = [];
  // Split by Slide Markers first, supporting optional markdown bolds
  const slideBlocks = fullText.split(/\[(?:\*\*)?SLIDE\s+(\d+)(?:\*\*)?\]/i);
  
  // The split results in: [textBefore, "1", textAfter, "2", textAfter...]
  
  let currentSlideIndex = 0;
  let runningTime = 0;
  // Approximating chars per second. JP needs less chars per sec as they are denser.
  const CHARS_PER_SEC = 12; 

  for (let i = 0; i < slideBlocks.length; i++) {
    const block = slideBlocks[i];
    
    // If it's a number (captured group), set current slide
    if (/^\d+$/.test(block)) {
      const pageNum = parseInt(block, 10);
      currentSlideIndex = Math.max(0, pageNum - 1); // 0-based
      continue;
    }

    // Otherwise, it's text content. Parse line by line.
    const lines = block.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let speaker: 'Host' | 'Expert' | null = null;
      let content = trimmed;

      // Handle Host: / **Host**: formats
      if (/^(?:\*\*)?Host(?:\*\*)?:/i.test(trimmed)) {
        speaker = 'Host';
        content = trimmed.replace(/^(?:\*\*)?Host(?:\*\*)?:/i, '').trim();
      } else if (/^(?:\*\*)?Expert(?:\*\*)?:/i.test(trimmed)) {
        speaker = 'Expert';
        content = trimmed.replace(/^(?:\*\*)?Expert(?:\*\*)?:/i, '').trim();
      }

      if (speaker && content) {
        const duration = Math.max(2.0, content.length / CHARS_PER_SEC);
        segments.push({
          id: Math.random().toString(36).substr(2, 9),
          slideIndex: currentSlideIndex,
          speaker,
          text: content,
          startTime: runningTime,
          endTime: runningTime + duration
        });
        runningTime += duration;
      }
    }
  }
  return segments;
};

// --- Presentation Slide Viewer ---
const PresentationViewer: React.FC<{ 
  url: string | null; 
  activeSlideIndex: number;
  onImagesLoaded: (count: number) => void;
}> = ({ url, activeSlideIndex, onImagesLoaded }) => {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setImages([]);
      return;
    }
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        setImages([]);
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        onImagesLoaded(numPages);
        
        const loadedImages: string[] = [];
        for (let i = 1; i <= numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); 
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              await page.render({ canvasContext: context, viewport }).promise;
              loadedImages.push(canvas.toDataURL('image/jpeg', 0.9));
            }
          } catch (e) { console.error(e); }
        }
        setImages(loadedImages);
      } catch (err) {
        console.error("Error loading PDF", err);
        setError("PDFの読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, [url]);

  if (error) return <div className="flex items-center justify-center h-full text-bauhaus-red font-bold">{error}</div>;
  
  if (loading && images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 border-4 border-bauhaus-black border-t-bauhaus-yellow rounded-full animate-spin"></div>
        <p className="font-bold text-gray-500 uppercase">Loading Presentation...</p>
      </div>
    );
  }

  const currentImage = images[Math.min(activeSlideIndex, images.length - 1)];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-4 overflow-hidden relative">
      {currentImage ? (
        <div className="relative w-full h-full flex items-center justify-center">
            <img 
              src={currentImage} 
              alt={`Slide ${activeSlideIndex + 1}`} 
              className="max-w-full max-h-full object-contain shadow-2xl bg-white" 
            />
            <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 font-mono font-bold text-sm backdrop-blur-sm rounded">
                SLIDE {activeSlideIndex + 1} / {images.length}
            </div>
        </div>
      ) : (
        <div className="text-gray-500 font-bold">Waiting for slides...</div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  // --- Core State ---
  const [currentStyle, setCurrentStyle] = useState<IntroStyle>(INTRO_STYLES[0]);
  const [text, setText] = useState<string>("");
  
  // --- Audio/Playback State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0);

  // --- PDF & Script State ---
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scriptGenerated, setScriptGenerated] = useState(false);
  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<'script' | 'slides'>('script');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>(INTRO_STYLES[0].defaultVoice);
  const [secondVoice, setSecondVoice] = useState<string>(INTRO_STYLES[0].secondVoice || 'Kore');
  const [error, setError] = useState<string | null>(null);
  const [downloadData, setDownloadData] = useState<{ url: string, filename: string } | null>(null);
  const [customStylePrompt, setCustomStylePrompt] = useState<string>(CUSTOM_STYLE.description);
  const [flagIndex, setFlagIndex] = useState(0);

  const generationIdRef = useRef(0);

  // --- Effects ---

  // Re-parse script when text changes
  useEffect(() => {
    if (text) {
      const parsed = parseScriptToSegments(text);
      setSegments(parsed);
    }
  }, [text]);

  // Sync logic using requestAnimationFrame for smooth UI updates during playback
  useEffect(() => {
    let animationFrameId: number;
    
    const updateSync = () => {
      if (audioElemRef.current && !audioElemRef.current.paused) {
        const t = audioElemRef.current.currentTime;
        setCurrentTime(t);
        setDuration(audioElemRef.current.duration || 0);

        // Best Effort Sync
        const totalEstimated = segments.length > 0 ? segments[segments.length - 1].endTime : 0;
        const actualDuration = audioElemRef.current.duration;
        
        let adjustedTime = t;
        if (actualDuration && totalEstimated > 0) {
           const ratio = totalEstimated / actualDuration;
           adjustedTime = t * ratio;
        }

        const foundIndex = segments.findIndex(seg => adjustedTime >= seg.startTime && adjustedTime < seg.endTime);
        
        if (foundIndex !== -1) {
          setActiveSegmentIndex(foundIndex);
          setActiveSlideIndex(segments[foundIndex].slideIndex);
        } else if (adjustedTime >= totalEstimated) {
           setActiveSegmentIndex(segments.length - 1);
        }

        animationFrameId = requestAnimationFrame(updateSync);
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateSync);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, segments]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      if (downloadData) URL.revokeObjectURL(downloadData.url);
    };
  }, [pdfUrl, downloadData]);

  useEffect(() => {
      const interval = setInterval(() => {
        setFlagIndex((prev) => (prev + 1) % SUPPORTED_LANGUAGES.length);
      }, 1000);
      return () => clearInterval(interval);
  }, []);

  // --- Handlers ---

  const handleStyleChange = (style: IntroStyle) => {
    setCurrentStyle(style);
    setSelectedVoice(style.defaultVoice);
    if (style.secondVoice) setSecondVoice(style.secondVoice);
    setError(null);
    setDownloadData(null); 
  };

  const handleCustomize = () => {
    setCurrentStyle(CUSTOM_STYLE);
    setSelectedVoice(CUSTOM_STYLE.defaultVoice);
    if (CUSTOM_STYLE.secondVoice) setSecondVoice(CUSTOM_STYLE.secondVoice);
    setIsPromptOpen(true);
    setError(null);
    setDownloadData(null);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
        setPdfFile(file);
        const url = URL.createObjectURL(file);
        setPdfUrl(url);
        setError(null);
        
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setPdfBase64(base64);
        };
        reader.readAsDataURL(file);
    } else {
        setError("PDFファイルのみ対応しています。");
    }
  };

  const handleGenerateScript = async () => {
    if (!pdfBase64) return;
    setIsAnalyzing(true);
    setError(null);
    try {
        const prompt = currentStyle.id === 'custom' ? customStylePrompt : currentStyle.description;
        const generatedScript = await generateScriptFromPDF(pdfBase64, prompt);
        setText(generatedScript);
        setScriptGenerated(true);
        setActiveTab('script'); 
    } catch (err) {
        console.error(err);
        setError("スライドの解析に失敗しました。");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handlePlay = async () => {
    if (isPlaying) {
      if (audioElemRef.current) {
        audioElemRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (scriptGenerated) setActiveTab('slides');

    if (audioElemRef.current && audioElemRef.current.paused && audioElemRef.current.currentTime > 0) {
        await audioElemRef.current.play();
        setIsPlaying(true);
        return;
    }

    if (isGenerating) return;

    if (downloadData && text.trim()) {
      const audio = new Audio(downloadData.url);
      audioElemRef.current = audio;
      setIsPlaying(true);
      audio.onended = () => { setIsPlaying(false); setActiveSegmentIndex(-1); };
      await audio.play();
      return;
    }

    setIsGenerating(true);
    setError(null);
    const currentGenId = ++generationIdRef.current;
    
    try {
      const prompt = currentStyle.id === 'custom' ? customStylePrompt : currentStyle.description;
      const result = await generateSpeech(text, selectedVoice, secondVoice, prompt);
      
      if (currentGenId !== generationIdRef.current) return;

      const blob = createWavBlob(result.rawData);
      const url = URL.createObjectURL(blob);
      setDownloadData({ url, filename: `podcast-${Date.now()}.wav` });
      
      const audio = new Audio(url);
      audioElemRef.current = audio;
      
      setIsGenerating(false);
      setIsPlaying(true);
      audio.onended = () => { setIsPlaying(false); setActiveSegmentIndex(-1); };
      await audio.play();

    } catch (err) {
      console.error(err);
      setError("音声生成に失敗しました。");
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!downloadData) return;
    const a = document.createElement('a');
    a.href = downloadData.url;
    a.download = downloadData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col md:flex-row bg-bauhaus-white font-sans text-bauhaus-black h-screen w-full overflow-hidden">
      {/* Sidebar */}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 overflow-hidden">
        
        {/* Header */}
        <div className="flex-shrink-0 border-b-4 border-bauhaus-black p-3 md:p-8 bg-white flex justify-between items-start z-10">
          <div>
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 md:mb-2">
              Slide to Podcast
            </h1>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-sm font-bold uppercase text-white ${getColorClass(currentStyle.color, true)}`}>
                {currentStyle.id === 'custom' ? 'カスタム設定' : 'ホストのペルソナ'}
              </span>
              <span className="font-bold uppercase tracking-widest text-xs md:text-base">{currentStyle.name}</span>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 p-3 md:p-6 bg-bauhaus-white relative flex flex-col min-h-0">
          <div className="flex flex-col h-full bg-white border-4 border-bauhaus-black shadow-hard overflow-hidden relative">
            
            {/* --- File Upload State --- */}
            {!scriptGenerated && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 bg-white">
                 <div className={`w-full max-w-xl border-4 border-dashed border-bauhaus-black p-12 text-center ${pdfFile ? 'bg-green-50' : ''}`}>
                    {!pdfFile ? (
                        <>
                            <h3 className="text-2xl font-bold uppercase mb-4">PDFをアップロード</h3>
                            <label className="inline-block cursor-pointer">
                                <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                                <span className="px-6 py-3 bg-bauhaus-black text-white font-bold uppercase hover:bg-bauhaus-blue transition-colors">
                                    ファイルを選択
                                </span>
                            </label>
                        </>
                    ) : (
                        <>
                            <h3 className="text-lg font-bold mb-6">{pdfFile.name}</h3>
                            <BauhausButton onClick={handleGenerateScript} disabled={isAnalyzing} className="w-full">
                                {isAnalyzing ? "分析中..." : "台本を生成する"}
                            </BauhausButton>
                        </>
                    )}
                 </div>
              </div>
            )}

            {/* --- Main View (Tabs) --- */}
            {scriptGenerated && (
                <div className="flex flex-col h-full">
                    {/* Tab Buttons */}
                    <div className="flex border-b-4 border-bauhaus-black bg-gray-100 flex-shrink-0">
                        <button onClick={() => setActiveTab('script')} className={`flex-1 py-2 font-bold uppercase ${activeTab === 'script' ? 'bg-white text-black' : 'text-gray-500'}`}>Script</button>
                        <button onClick={() => setActiveTab('slides')} className={`flex-1 py-2 font-bold uppercase ${activeTab === 'slides' ? 'bg-white text-black' : 'text-gray-500'}`}>Presentation</button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 relative overflow-hidden">
                        
                        {/* Script Editor */}
                        <div className={`absolute inset-0 z-10 bg-white ${activeTab === 'script' ? 'block' : 'hidden'}`}>
                            <textarea 
                                className="w-full h-full p-6 text-lg font-bold bg-transparent outline-none resize-none custom-scrollbar"
                                value={text}
                                onChange={(e) => { setText(e.target.value); setDownloadData(null); }}
                            />
                        </div>

                        {/* Presentation Mode */}
                        <div className={`absolute inset-0 z-10 bg-black ${activeTab === 'slides' ? 'flex flex-col' : 'hidden'}`}>
                            {/* Slide View (Full Height) */}
                            <div className="flex-1 relative overflow-hidden bg-gray-900">
                                <PresentationViewer 
                                    url={pdfUrl} 
                                    activeSlideIndex={activeSlideIndex}
                                    onImagesLoaded={setTotalSlides}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* Error Display */}
          {error && <div className="mt-4 p-4 bg-bauhaus-red text-white font-bold border-4 border-bauhaus-black">Error: {error}</div>}
        </div>

        {/* Action Bar & Subtitles */}
        <div className="flex-shrink-0 border-t-4 border-bauhaus-black bg-white relative z-20 flex flex-col md:flex-row h-auto md:h-[140px]">
          {isGenerating && <IndeterminateProgressBar className="absolute top-0 left-0 right-0 z-30 border-t-0 border-l-0 border-r-0 border-b-2" />}
          
          {/* Left Controls */}
          <div className="flex-shrink-0 p-4 md:border-r-4 border-bauhaus-black bg-gray-50 flex items-center justify-between md:justify-start gap-6 md:min-w-[280px]">
              
              {/* Play/Stop Button */}
              <button 
                onClick={handlePlay}
                className={`
                  w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-bauhaus-black flex items-center justify-center shadow-hard transition-transform active:scale-95 flex-shrink-0
                  ${isPlaying ? 'bg-bauhaus-black' : 'bg-bauhaus-red'}
                `}
              >
                  {isPlaying ? (
                    <div className="w-6 h-6 bg-white"></div>
                  ) : (
                     <div className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-2"></div>
                  )}
              </button>

              {/* Sub-controls */}
              <div className="flex flex-col gap-2 flex-1">
                 <BauhausButton 
                    onClick={handleDownload} 
                    disabled={!downloadData} 
                    className="py-2 px-4 text-xs font-bold w-full flex justify-center"
                    icon={<DownloadIcon className="w-3" />}
                  >
                    保存
                 </BauhausButton>
                 <button 
                    onClick={() => setIsConfigOpen(true)} 
                    className="text-xs font-bold border-2 border-bauhaus-black bg-white text-bauhaus-black px-2 py-2 hover:bg-gray-200 w-full truncate text-center"
                 >
                    {selectedVoice} & {secondVoice}
                 </button>
              </div>
          </div>

          {/* Right: Subtitles (Takes up rest of space) */}
          <div className="flex-1 p-4 md:p-6 bg-white flex items-center justify-center relative overflow-hidden border-t-4 md:border-t-0 border-bauhaus-black md:border-none">
              {scriptGenerated && activeTab === 'slides' ? (
                  activeSegmentIndex >= 0 && segments[activeSegmentIndex] ? (
                    <div className={`
                      w-full max-w-3xl p-3 md:p-4 rounded-xl border-2 shadow-sm border-bauhaus-black transition-all duration-300 animate-in fade-in slide-in-from-bottom-2
                      ${segments[activeSegmentIndex].speaker === 'Host' 
                          ? 'bg-bauhaus-blue text-white rounded-bl-none ml-0 mr-auto' 
                          : 'bg-bauhaus-yellow text-bauhaus-black rounded-br-none ml-auto mr-0'}
                    `}>
                      <div className="flex items-center gap-2 mb-1 text-[10px] font-bold uppercase opacity-80">
                          {segments[activeSegmentIndex].speaker === 'Host' ? <CircleIcon className="w-2 h-2" /> : <TriangleIcon className="w-2 h-2" />}
                          {segments[activeSegmentIndex].speaker}
                      </div>
                      <p className="text-sm md:text-lg font-bold leading-snug md:leading-relaxed line-clamp-3">
                        {segments[activeSegmentIndex].text}
                      </p>
                    </div>
                  ) : (
                    <div className="text-gray-300 font-bold uppercase text-xl md:text-3xl tracking-widest select-none">
                        Ready to play
                    </div>
                  )
              ) : (
                 <div className="text-gray-300 font-bold uppercase text-xl md:text-3xl tracking-widest select-none">
                    Slide to Podcast
                 </div>
              )}
          </div>
        </div>

        <Footer className="md:hidden" />
      </div>

      {/* Modals */}
      <ConfigurationModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} selectedVoice={selectedVoice} onVoiceChange={setSelectedVoice} />
      <SystemPromptModal 
        isOpen={isPromptOpen} 
        onClose={() => setIsPromptOpen(false)} 
        prompt={customStylePrompt} 
        isEditable={currentStyle.id === 'custom'} 
        onSave={(p, v, v2) => { setCustomStylePrompt(p); if(v) setSelectedVoice(v); if(v2) setSecondVoice(v2); }} 
      />

    </div>
  );
};

export default App;