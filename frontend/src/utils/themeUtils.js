// src/utils/themeUtils.js
export const ThemeUtils = {
    // Generate dynamic color schemes
    generateColorScheme: (baseColor) => {
      const hsl = ThemeUtils.hexToHsl(baseColor);
      
      return {
        primary: baseColor,
        secondary: ThemeUtils.hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l),
        accent: ThemeUtils.hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l),
        success: ThemeUtils.hslToHex(120, hsl.s, hsl.l),
        warning: ThemeUtils.hslToHex(45, hsl.s, hsl.l),
        error: ThemeUtils.hslToHex(0, hsl.s, hsl.l)
      };
    },
    
    hexToHsl: (hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      
      return { h: h * 360, s: s * 100, l: l * 100 };
    },
    
    hslToHex: (h, s, l) => {
      h /= 360;
      s /= 100;
      l /= 100;
      
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      const r = hue2rgb(p, q, h + 1/3);
      const g = hue2rgb(p, q, h);
      const b = hue2rgb(p, q, h - 1/3);
      
      const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },
    
    // Get contrasting text color
    getContrastColor: (backgroundColor) => {
      const hex = backgroundColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 128 ? '#000000' : '#ffffff';
    }
  };