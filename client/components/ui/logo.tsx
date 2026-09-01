import React from 'react';

export function Logo({ className }: { className?: string }) {
 return (
 <svg
 xmlns="http://www.w3.org/2000/svg"
 viewBox="0 0 48 48"
 className={className}
 style={{ backgroundColor: '#0a0a0a' }}
 >
 <path
 d="M18 14L8 24L18 34"
 stroke="#f59e0b"
 strokeWidth="4"
 strokeLinecap="square"
 strokeLinejoin="miter"
 fill="none"
 />
 <path
 d="M30 14L40 24L30 34"
 stroke="#f59e0b"
 strokeWidth="4"
 strokeLinecap="square"
 strokeLinejoin="miter"
 fill="none"
 />
 </svg>
 );
}
