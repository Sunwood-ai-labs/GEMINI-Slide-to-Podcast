/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useEffect } from 'react';
import { ALL_VOICES } from '../voices';
import { BauhausButton } from './BauhausComponents';
import { TRANSLATIONS } from '../constants';

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: string;
  onVoiceChange: (voiceName: string) => void;
  language: 'ja' | 'en';
}

export const ConfigurationModal: React.FC<ConfigurationModalProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onVoiceChange,
  language
}) => {
  const [filterGender, setFilterGender] = useState('ALL');
  const t = TRANSLATIONS[language];

  // Filter voices
  const filteredVoices = useMemo(() => {
    return ALL_VOICES.filter(voice => {
      const matchGender = filterGender === 'ALL' || voice.ssmlGender === filterGender;
      return matchGender;
    });
  }, [filterGender]);

  // Focus Management (Only runs when isOpen changes)
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement;
    const modalElement = document.getElementById('config-modal');

    if (modalElement) {
        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
            (focusableElements[0] as HTMLElement).focus();
        }
    }

    return () => {
        previousActiveElement?.focus();
    };
  }, [isOpen]);

  // Keyboard Event Trap
  useEffect(() => {
    if (!isOpen) return;

    const modalElement = document.getElementById('config-modal');

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!modalElement) return;

        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (e.key === 'Tab') {
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleApiKeySelect = async () => {
    if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
      try {
        await (window as any).aistudio.openSelectKey();
      } catch (e) {
        console.error("Failed to select key:", e);
      }
    } else {
      alert("API Key selection is not available in this environment.");
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bauhaus-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-modal-title"
    >
      <div 
        id="config-modal"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-bauhaus-white border-4 border-bauhaus-black shadow-hard"
      >
        
        {/* Header */}
        <div className="bg-bauhaus-yellow border-b-4 border-bauhaus-black p-6 flex justify-between items-center flex-shrink-0">
          <h2 id="config-modal-title" className="text-2xl font-bold uppercase flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">⚙</span> {t.configTitle}
          </h2>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white border-4 border-black hover:bg-black hover:text-white transition-colors text-xl font-bold focus:outline-none focus:ring-4 focus:ring-bauhaus-red"
            aria-label="Close Settings"
          >
            X
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
          
          {/* API Key Section */}
          <div className="mb-8 p-4 border-4 border-bauhaus-black bg-gray-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold uppercase mb-1 flex items-center gap-2">
                  🔑 {t.apiKeyTitle}
                </h3>
                <p className="text-xs font-bold text-gray-500 max-w-md">
                  {t.apiKeyDesc}
                </p>
                <a 
                  href="https://ai.google.dev/gemini-api/docs/billing" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[10px] font-bold uppercase text-bauhaus-blue underline hover:text-bauhaus-black mt-1 inline-block"
                >
                  {t.apiKeyLink}
                </a>
              </div>
              <BauhausButton 
                onClick={handleApiKeySelect}
                variant="secondary"
                className="text-sm py-2 px-4 whitespace-nowrap w-full md:w-auto"
              >
                {t.selectKeyBtn}
              </BauhausButton>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xl font-bold uppercase mb-1">{t.voiceSelectTitle}</label>
            <p className="text-sm text-gray-600 font-bold uppercase">{t.voiceSelectDesc}</p>
          </div>
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label htmlFor="gender-filter" className="block text-xs font-bold uppercase mb-2">{t.gender}</label>
              <select 
                id="gender-filter"
                className="w-full p-3 border-4 border-bauhaus-black font-bold bg-white focus:outline-none focus:shadow-hard-sm focus:ring-4 focus:ring-bauhaus-yellow"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
              >
                <option value="ALL">{t.all}</option>
                <option value="MALE">{t.male}</option>
                <option value="FEMALE">{t.female}</option>
              </select>
            </div>
          </div>

          {/* Voice List */}
          <div className="flex-1 overflow-y-auto min-h-[300px] border-4 border-bauhaus-black bg-white p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-label="Voice Selection">
              {filteredVoices.map((voice) => (
                <label 
                  key={voice.name}
                  className={`
                    flex items-center justify-between p-3 border-2 border-bauhaus-black cursor-pointer transition-colors
                    focus-within:ring-4 focus-within:ring-bauhaus-yellow
                    ${selectedVoice === voice.name ? 'bg-bauhaus-black text-white' : 'bg-gray-50 hover:bg-bauhaus-yellow hover:text-bauhaus-black'}
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-5 h-5 flex-shrink-0 border-2 border-current rounded-full flex items-center justify-center`}>
                      {selectedVoice === voice.name && <div className="w-2.5 h-2.5 bg-current rounded-full" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-sm truncate">{voice.name}</span>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 border border-current rounded-sm ${selectedVoice === voice.name ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-bauhaus-yellow/50'}`}>
                          {voice.style}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase opacity-70">{voice.ssmlGender}</span>
                    </div>
                  </div>
                  
                  <input 
                    type="radio" 
                    name="voice" 
                    value={voice.name}
                    checked={selectedVoice === voice.name}
                    onChange={(e) => onVoiceChange(e.target.value)}
                    className="sr-only" 
                  />
                </label>
              ))}
              {filteredVoices.length === 0 && (
                <div className="col-span-2 text-center p-8 text-gray-500 font-bold">
                  {t.notFound}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};