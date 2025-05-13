import React, { useEffect, useState } from 'react';
import { createLogo } from '../../utils/createLogo';

interface LogoProps {
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ size = 192 }) => {
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const logo = createLogo();
    setLogoUrl(logo);
  }, []);

  if (!logoUrl) return null;

  return (
    <img
      src={logoUrl}
      alt="School Quiz Game Logo"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
    />
  );
};

export default Logo; 