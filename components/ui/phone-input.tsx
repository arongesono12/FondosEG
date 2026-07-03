'use client';

import { useState, useRef, useEffect } from 'react';
import { COUNTRIES } from '@/lib/countries';
import { ChevronDown, Search } from 'lucide-react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function PhoneInput({ value, onChange, placeholder = 'Número de teléfono', required = false, className = '' }: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentPrefix = value.match(/^\+\d{1,3}/)?.[0] || '+240';
  const currentNumber = value.replace(/^\+\d{1,3}\s?/, '');

  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.prefix.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCountry = COUNTRIES.find(c => c.prefix === currentPrefix) || COUNTRIES.find(c => c.prefix === '+240') || COUNTRIES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCountrySelect = (prefix: string) => {
    onChange(`${prefix} `);
    setIsOpen(false);
    setSearch('');
    inputRef.current?.focus();
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const number = e.target.value.replace(/[^\d\s]/g, '');
    onChange(`${currentPrefix} ${number}`.trim());
  };

  return (
    <div className={`phone-input relative ${className}`}>
      <div className="flex">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="phone-country-trigger flex items-center gap-1 px-2 h-10 rounded-l-lg border border-r-0 transition-colors focus:ring-2 focus:ring-pink-500/50"
          >
            <span className="phone-country-prefix text-xs font-medium">{selectedCountry.prefix}</span>
            <ChevronDown className={`phone-country-chevron h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isOpen && (
            <div className="phone-country-menu absolute z-50 top-full left-0 mt-1 w-56 border rounded-lg shadow-xl overflow-hidden">
              <div className="phone-country-search-wrap p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="phone-country-search w-full h-8 pl-8 pr-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country.prefix)}
                    className={`phone-country-option w-full flex items-center gap-2 px-2 py-1.5 transition-colors text-left ${
                      country.prefix === currentPrefix ? 'phone-country-option--selected' : ''
                    }`}
                  >
                    <span className="text-xs font-medium w-10 shrink-0">{country.prefix}</span>
                    <span className="text-xs truncate">{country.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <input
          ref={inputRef}
          type="tel"
          value={currentNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          required={required}
          className="phone-number-input flex-1 h-10 px-3 rounded-r-lg border text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-colors"
        />
      </div>
    </div>
  );
}
