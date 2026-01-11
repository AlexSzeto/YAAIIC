import { html } from 'htm/preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button } from './button.mjs';
import { globalAudioPlayer } from '../global-audio-player.mjs';

/**
 * AudioSelect Component
 * A reusable component for selecting audio files via gallery.
 */
export function AudioSelect({ 
  label,
  value, // string (URL) or media data object with audioUrl
  onChange, // (audioUrl) => void
  onSelectFromGallery,
  disabled = false
}) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioName, setAudioName] = useState(null);
  const [albumImageUrl, setAlbumImageUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Update audio URL, name, and album image when value changes
  useEffect(() => {
    if (!value) {
      setAudioUrl(null);
      setAudioName(null);
      setAlbumImageUrl(null);
      return;
    }

    if (typeof value === 'string') {
      setAudioUrl(value);
      setAudioName('Audio File');
      setAlbumImageUrl(null);
    } else if (value && typeof value === 'object') {
      // Assume it's media data with audioUrl, name, and imageUrl (album cover)
      setAudioUrl(value.audioUrl || null);
      setAudioName(value.name || 'Audio File');
      setAlbumImageUrl(value.imageUrl || null);
    }
  }, [value]);

  // Subscribe to global audio player state changes
  useEffect(() => {
    const unsubscribe = globalAudioPlayer.subscribe(() => {
      if (audioUrl) {
        setIsPlaying(globalAudioPlayer.isPlaying(audioUrl));
      }
    });
    
    return unsubscribe;
  }, [audioUrl]);

  const handleBrowseClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (onSelectFromGallery) {
      onSelectFromGallery();
    }
  };

  const handleClearClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (onChange) onChange(null);
  };

  const handleReplaceClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (onSelectFromGallery) {
      onSelectFromGallery();
    }
  };

  const handlePlayPauseClick = (e) => {
    e.stopPropagation();
    if (disabled || !audioUrl) return;
    globalAudioPlayer.toggle(audioUrl);
  };

  return html`
    <div class="audio-select-component">
      ${label && html`<label class="input-label">${label}</label>`}
      
      <div 
        class="audio-select-area ${audioUrl ? 'has-audio' : ''} ${disabled ? 'disabled' : ''}"
        style=${albumImageUrl ? `background-image: url('${albumImageUrl}'); background-size: cover; background-position: center;` : ''}
      >
        ${audioUrl ? html`
          <!-- Audio Selected State with Album Background -->
          <div class="audio-select-header overlay-panel">
            <box-icon name='music' color='white' size='20px'></box-icon>
            <span class="audio-select-name">${audioName}</span>
          </div>
          
          <!-- Control Buttons at Bottom -->
          <div class="audio-select-overlay overlay-panel">
            <${Button}
              variant="icon-danger"
              icon="x"
              onClick=${handleClearClick}
              title="Clear audio"
            />
            <${Button}
              variant="icon"
              icon=${isPlaying ? 'pause' : 'play'}
              onClick=${handlePlayPauseClick}
              title=${isPlaying ? 'Pause' : 'Play'}
            />
            <${Button}
              variant="icon"
              icon="music"
              onClick=${handleReplaceClick}
              title="Replace audio"
            />
          </div>
        ` : html`
          <!-- Empty State -->
          <div class="audio-select-empty" onClick=${handleBrowseClick}>
            <box-icon name='music' color='white' size='48px'></box-icon>
            <div class="audio-select-text">Select Audio</div>
          </div>
        `}
      </div>
    </div>
  `;
}
