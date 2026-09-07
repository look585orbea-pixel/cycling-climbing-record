import React from 'react';

/**
 * Renders text with customized colors for specific cycling/mountain emojis,
 * matching the original index.html style.
 */
export function renderColorizedEmoji(text: string | undefined | null): React.ReactNode {
  if (!text) return null;

  // Split text by emojis that have custom styling
  const regex = /(🚲|🏔|🚶|🍁|🌸|🌷|💮)/g;
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        switch (part) {
          case '🚲':
            return <span key={i} style={{ color: '#3b82f6' }}>🚲</span>;
          case '🏔':
            return <span key={i} style={{ color: '#8b4513' }}>🏔</span>;
          case '🚶':
            return <span key={i} style={{ color: '#000000' }}>🚶</span>;
          case '🍁':
            return <span key={i} style={{ color: '#fdbb2d' }}>🍁</span>;
          case '🌸':
            return <span key={i} style={{ color: '#ffb7c5' }}>🌸</span>;
          case '🌷':
            return <span key={i} style={{ color: '#ff0000' }}>🌷</span>;
          case '💮':
            return <span key={i} style={{ color: '#ff0000' }}>💮</span>;
          default:
            return <React.Fragment key={i}>{part}</React.Fragment>;
        }
      })}
    </>
  );
}
