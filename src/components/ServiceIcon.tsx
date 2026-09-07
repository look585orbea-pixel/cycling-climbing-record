import React from 'react';

interface ServiceIconProps {
  url?: string;
  size?: number;
  className?: string;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({
  url = '',
  size = 20,
  className = '',
}) => {
  const isYamap = url.toLowerCase().includes('yamap');
  const isGarmin = url.toLowerCase().includes('garmin');

  if (isYamap) {
    return (
      <img
        src="/YAMAPアイコン.jpg"
        alt="YAMAP"
        width={size}
        height={size}
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`object-contain inline-block shrink-0 transition-opacity hover:opacity-80 ${className}`}
        onError={(e) => {
          // Fallback to SVG if image file is not found
          const target = e.currentTarget;
          target.style.display = 'none';
        }}
      />
    );
  }

  if (isGarmin) {
    return (
      <img
        src="/GARMINアイコン.jpg"
        alt="GARMIN"
        width={size}
        height={size}
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`object-contain inline-block shrink-0 transition-opacity hover:opacity-80 ${className}`}
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = 'none';
        }}
      />
    );
  }

  return null;
};
