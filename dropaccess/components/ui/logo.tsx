import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

const sizeMap = {
  sm: { height: 24, width: 80 },   // Small - for mobile/footer
  md: { height: 32, width: 107 },  // Medium - for navbar
  lg: { height: 40, width: 160 },  // Large - for headers
  xl: { height: 60, width: 200 },  // Extra large - for landing page
};

const iconSizeMap = {
  sm: { height: 24, width: 24 },
  md: { height: 32, width: 32 },
  lg: { height: 40, width: 40 },
  xl: { height: 48, width: 48 },
};

export function Logo({ 
  variant = 'light', 
  size = 'md', 
  className, 
  showText = true 
}: LogoProps) {
  const logoSrc = variant === 'dark' ? '/dropaccess_white.svg' : '/dropaccess_dark.svg';
  const dimensions = sizeMap[size];

  if (!showText) {
    return <LogoIcon variant={variant} size={size} className={className} />;
  }

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src={logoSrc}
        alt="DropAccess"
        width={dimensions.width}
        height={dimensions.height}
        className="h-auto w-auto"
        priority
      />
    </div>
  );
}

// Icon-only version using the unified icon
export function LogoIcon({ 
  variant = 'light', 
  size = 'md', 
  className 
}: Omit<LogoProps, 'showText'>) {
  const dimensions = iconSizeMap[size];

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/dropaccess_icon.svg"
        alt="DropAccess"
        width={dimensions.width}
        height={dimensions.height}
        className="h-auto w-auto"
        priority
      />
    </div>
  );
}