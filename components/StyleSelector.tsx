/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { INTRO_STYLES, TRANSLATIONS } from '../constants';
import { getIcon, getColorClass } from './BauhausComponents';
import { IntroStyle } from '../types';

interface StyleSelectorProps {
  selectedStyle: IntroStyle;
  onSelect: (style: IntroStyle) => void;
  onCustomize: () => void;
  isCollapsed: boolean;
  language: 'ja' | 'en';
}

interface StyleButtonProps {
  style: IntroStyle;
  isSelected: boolean;
  onClick: () => void;
  effectiveAvatarSrc?: string;
  isCollapsed: boolean;
  language: 'ja' | 'en';
}

const StyleButton: React.FC<StyleButtonProps> = ({ 
  style, 
  isSelected, 
  onClick,
  effectiveAvatarSrc,
  isCollapsed,
  language
}) => {
  const [imgError, setImgError] = useState(false);
  const displayName = language === 'en' ? style.nameEn : style.name;

  return (
    <button
      onClick={onClick}
      title={isCollapsed ? displayName : undefined}
      className={`
        group relative flex items-center transition-all border-b-4 border-bauhaus-black
        ${isCollapsed ? 'justify-center p-4' : 'gap-4 p-6 text-left'}
        ${isSelected ? 'bg-bauhaus-black text-white' : 'hover:bg-gray-100 text-bauhaus-black'}
      `}
    >
      <div className={`
        w-12 h-12 flex-shrink-0 flex items-center justify-center border-4 border-current overflow-hidden transition-transform
        ${isSelected && !isCollapsed ? 'scale-110' : ''}
        ${isSelected ? 'bg-white text-black' : getColorClass(style.color, false)}
      `}>
        {effectiveAvatarSrc && !imgError ? (
          <img 
            src={effectiveAvatarSrc} 
            alt={displayName} 
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          getIcon(style.icon, "w-6 h-6")
        )}
      </div>
      
      {!isCollapsed && (
        <div className="min-w-0">
          <div className="font-bold uppercase text-lg leading-tight mb-1">{displayName}</div>
        </div>
      )}
      
      {isSelected && (
        <div className={`
          absolute bg-white rounded-full animate-pulse flex-shrink-0
          ${isCollapsed ? 'top-2 right-2 w-2 h-2' : 'right-4 w-4 h-4'}
        `}></div>
      )}
    </button>
  );
};

export const StyleSelector: React.FC<StyleSelectorProps> = ({ selectedStyle, onSelect, onCustomize, isCollapsed, language }) => {
  const [loadedAvatars, setLoadedAvatars] = useState<Record<string, string>>({});
  const t = TRANSLATIONS[language];

  // Load thumbnails via fetch to bypass potential img tag static serving issues
  useEffect(() => {
    const createdUrls: string[] = [];
    const loadThumbnails = async () => {
      const loaded: Record<string, string> = {};
      await Promise.all(INTRO_STYLES.map(async (style) => {
        if (style.avatarSrc) {
          try {
            const response = await fetch(style.avatarSrc);
            if (response.ok) {
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              createdUrls.push(url);
              loaded[style.id] = url;
            }
          } catch (e) {
            console.error("Failed to load avatar:", style.avatarSrc, e);
          }
        }
      }));
      setLoadedAvatars(loaded);
    };
    loadThumbnails();

    return () => {
        // Cleanup object URLs to avoid memory leaks
        createdUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const customLabel = language === 'en' ? 'Create Custom' : 'カスタム作成';

  return (
    <div className="flex flex-col h-full bg-bauhaus-white">
      
      <div className="flex-1 overflow-y-auto bg-bauhaus-white custom-scrollbar">
        <div className="flex flex-col">
          {INTRO_STYLES.map((style) => (
            <StyleButton 
              key={style.id}
              style={style}
              isSelected={selectedStyle.id === style.id}
              onClick={() => onSelect(style)}
              effectiveAvatarSrc={loadedAvatars[style.id] || style.avatarSrc}
              isCollapsed={isCollapsed}
              language={language}
            />
          ))}

          <button
            onClick={onCustomize}
            title={isCollapsed ? t.customCreate : undefined}
            className={`
              group relative flex items-center transition-all border-b-4 border-bauhaus-black
              ${isCollapsed ? 'justify-center p-4' : 'gap-4 p-6 text-left'}
              ${selectedStyle.id === 'custom' ? 'bg-bauhaus-yellow text-black' : 'hover:bg-gray-100 text-bauhaus-black'}
            `}
          >
             <div className={`
                  w-12 h-12 flex-shrink-0 flex items-center justify-center border-4 border-current
                  ${selectedStyle.id === 'custom' ? 'bg-black text-white' : 'bg-white text-bauhaus-black'}
                `}>
                  {getIcon('plus', "w-6 h-6")}
                </div>
                {!isCollapsed && (
                    <div className="min-w-0">
                    <div className="font-bold uppercase text-lg leading-tight mb-1">{t.customCreate}</div>
                    </div>
                )}
                {selectedStyle.id === 'custom' && (
                  <div className={`
                    absolute bg-black rounded-full animate-pulse flex-shrink-0
                    ${isCollapsed ? 'top-2 right-2 w-2 h-2' : 'right-4 w-4 h-4'}
                  `}></div>
                )}
          </button>

        </div>
      </div>
      
    </div>
  );
};