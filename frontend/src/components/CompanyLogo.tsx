import React from 'react';

interface CompanyLogoProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({ name, size = 32, className = '', style = {} }) => {
  const normalized = name.toLowerCase().trim();

  // 1. PostHog - Official SimpleIcon Hedgehog Silhouette / Mark
  if (normalized.includes('posthog')) {
    return (
      <div 
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${Math.max(6, Math.round(size * 0.22))}px`,
          backgroundColor: '#F54E00', // PostHog vibrant orange brand color
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(245, 78, 0, 0.25)',
          ...style
        }}
        title="PostHog"
      >
        <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.996 11.238c-.469-.974-1.127-1.745-1.921-2.274.053-.299.117-.597.117-.9 0-1.558-1.267-2.825-2.825-2.825-.333 0-.665.064-.974.171-.621-1.026-1.579-1.774-2.73-2.031a2.822 2.822 0 0 0-1.636-.085c-.651-.897-1.635-1.517-2.783-1.666A4.708 4.708 0 0 0 6.643 3.51a3.985 3.985 0 0 0-1.281.8c-1.325.321-2.457 1.154-3.13 2.308C.93 7.794.417 9.162.247 10.605a6.002 6.002 0 0 0-.15 2.106c.15 1.517.726 2.927 1.635 4.081 1.058 1.346 2.565 2.265 4.253 2.617 1.838.385 3.75-.021 5.342-1.026.545-.342 1.026-.748 1.453-1.218 1.058.427 2.223.534 3.345.299 1.218-.256 2.287-.897 3.12-1.795.534-.577.962-1.239 1.261-1.966.534-.363 1.004-.812 1.378-1.346.577-.822.887-1.816.897-2.842 0-.096.011-.182.011-.277zM9.421 13.91c-.812 0-1.464-.652-1.464-1.464s.652-1.464 1.464-1.464 1.464.652 1.464 1.464-.652 1.464-1.464 1.464zm4.701 0c-.812 0-1.464-.652-1.464-1.464s.652-1.464 1.464-1.464 1.464.652 1.464 1.464-.652 1.464-1.464 1.464z"/>
        </svg>
      </div>
    );
  }

  // 2. Stripe - Official SimpleIcon Stripe S Mark
  if (normalized.includes('stripe')) {
    return (
      <div 
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${Math.max(6, Math.round(size * 0.22))}px`,
          backgroundColor: '#635BFF', // Stripe Blurple brand color
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(99, 91, 255, 0.25)',
          ...style
        }}
        title="Stripe"
      >
        <svg width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.303 1.901-1.303 2.227 0 4.125.882 4.125.882l.66-3.233s-1.895-.626-3.92-.626C10.133 2.46 8.35 3.784 8.35 6.223c0 3.23 2.977 4.292 6.208 5.143 2.378.694 3.284 1.341 3.284 2.483 0 1.054-.93 1.545-2.228 1.545-2.525 0-4.66-.995-4.66-.995l-.71 3.321s2.138.835 4.58.835c3.34 0 5.32-1.332 5.32-3.864 0-3.376-3.136-4.24-6.168-5.042z"/>
        </svg>
      </div>
    );
  }

  // 3. Linear - Official SimpleIcon Linear Crescent / Wave Mark
  if (normalized.includes('linear')) {
    return (
      <div 
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${Math.max(6, Math.round(size * 0.22))}px`,
          backgroundColor: '#5E6AD2', // Linear Indigo/Purple brand color
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(94, 106, 210, 0.25)',
          ...style
        }}
        title="Linear"
      >
        <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.093 15.65A9.957 9.957 0 0 1 2 10C2 4.477 6.477 0 12 0c2.208 0 4.25.717 5.903 1.93L3.093 15.65zM5.38 17.935l14.81-14.81A9.954 9.954 0 0 1 22 10c0 5.523-4.477 10-10 10a9.954 9.954 0 0 1-6.62-2.065z"/>
        </svg>
      </div>
    );
  }

  // 4. Vercel - Official Vercel Triangle Mark
  if (normalized.includes('vercel')) {
    return (
      <div 
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${Math.max(6, Math.round(size * 0.22))}px`,
          backgroundColor: '#000000', // Vercel sleek black
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          border: '1px solid #333333',
          ...style
        }}
        title="Vercel"
      >
        <svg width={Math.round(size * 0.54)} height={Math.round(size * 0.54)} viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12 3 22 20 2 20" />
        </svg>
      </div>
    );
  }

  // 5. Supabase - Official SimpleIcon Emerald Lightning Mark
  if (normalized.includes('supabase')) {
    return (
      <div 
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${Math.max(6, Math.round(size * 0.22))}px`,
          backgroundColor: '#3ECF8E', // Supabase Emerald
          color: '#0D1117', // Dark contrast for bolt
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(62, 207, 142, 0.25)',
          ...style
        }}
        title="Supabase"
      >
        <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z"/>
        </svg>
      </div>
    );
  }

  // 6. Generic / Fallback Monogram for any other company
  return (
    <div 
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${Math.max(6, Math.round(size * 0.22))}px`,
        backgroundColor: 'var(--ink)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: `${Math.max(10, Math.round(size * 0.38))}px`,
        letterSpacing: '0.04em',
        flexShrink: 0,
        ...style
      }}
      title={name}
    >
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
};
