import React from 'react';

interface BrandLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'dark',
  size = 'md',
  showTagline = true
}) => {
  const iconDimensions =
    size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-13 h-13' : 'w-11 h-11';
  const titleSize =
    size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className="inline-flex items-center gap-2.5 select-none group">
      {/* Geometric Line-Art Landmark Simpang Tiga Cilegon Icon */}
      <div
        className={`${iconDimensions} rounded-xl bg-gradient-to-br from-navy-800 via-navy-800 to-forest-600 p-1.5 shadow-sm flex items-center justify-center border border-white/15 transition-transform duration-200 group-hover:scale-105`}
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-hidden="true"
        >
          {/* Crown / Dome */}
          <ellipse
            cx="32"
            cy="14"
            rx="18"
            ry="6"
            fill="#2E6F40"
            stroke="#E5A93C"
            strokeWidth="2.4"
          />
          <path
            d="M17 16L25 23H39L47 16"
            stroke="#E5A93C"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Central Steel Core */}
          <rect
            x="27"
            y="21"
            width="10"
            height="27"
            rx="1.5"
            fill="#FFFFFF"
            fillOpacity="0.14"
            stroke="#FFFFFF"
            strokeWidth="2.2"
          />
          {/* Left & Right Architectural Fins */}
          <path
            d="M27 26L18 21M27 32L18 27M27 38L18 33M27 44L19 39"
            stroke="#E5A93C"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M37 26L46 21M37 32L46 27M37 38L46 33M37 44L45 39"
            stroke="#E5A93C"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Base Pillars & Steps */}
          <path
            d="M20 48H44M22 44V52M42 44V52"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M14 54C20 51 26 51 32 51C38 51 44 51 50 54"
            stroke="#5fa978"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Typography: Bold Sans-Serif CILEGON + Friendly Handwritten/Light Italic ENGGIH */}
      <div className="flex flex-col leading-none">
        <div className={`flex items-baseline gap-1.5 ${titleSize}`}>
          <span
            className={`font-extrabold tracking-tight ${
              variant === 'light' ? 'text-white' : 'text-navy-800'
            }`}
          >
            CILEGON
          </span>
          <span
            className={`font-medium italic tracking-wide ${
              variant === 'light' ? 'text-amberbrand-400' : 'text-forest-600'
            }`}
            style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
          >
            Enggih
          </span>
        </div>
        {showTagline && (
          <span
            className={`text-[10.5px] font-medium tracking-wide mt-0.5 ${
              variant === 'light' ? 'text-slate-200/85' : 'text-slate-500'
            }`}
          >
            Official Merchandise Kota Baja
          </span>
        )}
      </div>
    </div>
  );
};
