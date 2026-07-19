import React, { useState, useEffect } from 'react';
import { Delete } from 'lucide-react';

interface PinLockScreenProps {
  onPinComplete: (pin: string) => void;
  onGoogleLogin?: () => void;
  title?: string;
}

export default function PinLockScreen({ onPinComplete, onGoogleLogin, title = "Ingresa tu PIN de Cajero" }: PinLockScreenProps) {
  const [pin, setPin] = useState('');

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === 4) {
      // Usamos setTimeout para que el usuario pueda ver el último punto llenarse
      // antes de que se limpie la pantalla o se procese
      const timer = setTimeout(() => {
        onPinComplete(pin);
        setPin('');
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pin, onPinComplete]);

  // Teclado numérico estándar 3x4
  const keypad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'delete']
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
      
      {/* Candado / Título */}
      <div className="mb-12 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-foreground">{title}</h2>
      </div>

      {/* Indicadores de PIN */}
      <div className="flex gap-6 mb-16">
        {[0, 1, 2, 3].map((index) => (
          <div 
            key={index}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              index < pin.length 
                ? 'bg-emerald-500 scale-110 shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
                : 'bg-muted-foreground/20'
            }`}
          />
        ))}
      </div>

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-x-8 gap-y-6 w-full max-w-[320px]">
        {keypad.map((row, rowIndex) => 
          row.map((key, colIndex) => {
            if (key === '') {
              return <div key={`empty-${rowIndex}-${colIndex}`} />;
            }

            if (key === 'delete') {
              return (
                <button
                  key="delete"
                  onClick={handleDelete}
                  disabled={pin.length === 0}
                  className="w-20 h-20 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/50 active:bg-secondary/80 active:scale-95 transition-all disabled:opacity-30 disabled:active:scale-100"
                >
                  <Delete className="w-8 h-8" />
                </button>
              );
            }

            return (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-normal text-foreground bg-secondary/20 hover:bg-secondary/50 active:bg-secondary active:scale-95 transition-all shadow-sm"
              >
                {key}
              </button>
            );
          })
        )}
      </div>

      {/* Google Login Button */}
      {onGoogleLogin && (
        <div className="mt-12 flex flex-col items-center w-full max-w-[320px]">
          <div className="relative w-full mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
            </div>
          </div>
          <button
            onClick={onGoogleLogin}
            className="w-full h-12 flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 border border-gray-200 rounded-full font-medium transition-all shadow-sm active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Iniciar sesión con Google
          </button>
        </div>
      )}
    </div>
  );
}
