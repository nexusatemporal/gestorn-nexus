import { useState, useEffect, useRef } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { leadsApi } from '../services/leads.api';

interface CityComboboxProps {
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  error?: string;
}

interface City {
  id: number;
  name: string;
}

export function CityCombobox({ value, onChange, isDark, error }: CityComboboxProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number>();

  // Sync input value with prop value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (inputValue.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const cities = await leadsApi.searchCities(inputValue.trim());
        setSuggestions(cities);
        setIsOpen(cities.length > 0);
        setHighlightedIndex(-1);
      } catch (error) {
        console.error('Erro ao buscar cidades:', error);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleSelectCity = (city: City) => {
    const formattedValue = city.name;
    setInputValue(formattedValue);
    onChange(formattedValue);
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectCity(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">
        Cidade / Estado
      </label>
      <div className="relative">
        {/* Input Field */}
        <div className="relative">
          <MapPin
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            className={`w-full rounded-xl pl-10 pr-10 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
              error
                ? 'border-red-500 focus:ring-red-500/20'
                : isDark
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'bg-white border-zinc-300'
            }`}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setIsOpen(true);
              }
            }}
            placeholder="Ex: São Paulo - SP"
            autoComplete="off"
          />
          {/* Loading Spinner */}
          {isLoading && (
            <Loader2
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            />
          )}
          {/* Clear Button */}
          {!isLoading && inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-colors ${
                isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>
        )}

        {/* Suggestions Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div
            className={`absolute z-50 w-full mt-1 rounded-xl border shadow-lg max-h-60 overflow-y-auto ${
              isDark
                ? 'bg-zinc-800 border-zinc-700'
                : 'bg-white border-zinc-300'
            }`}
          >
            {suggestions.map((city, index) => (
              <button
                key={city.id}
                type="button"
                onClick={() => handleSelectCity(city)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                  highlightedIndex === index
                    ? isDark
                      ? 'bg-zinc-700 text-white'
                      : 'bg-zinc-100 text-zinc-900'
                    : isDark
                    ? 'text-zinc-300 hover:bg-zinc-700'
                    : 'text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <MapPin
                  className={`w-4 h-4 flex-shrink-0 ${
                    highlightedIndex === index
                      ? 'text-nexus-orange'
                      : isDark
                      ? 'text-zinc-500'
                      : 'text-zinc-400'
                  }`}
                />
                <span className="truncate">{city.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* No Results Message */}
        {isOpen && !isLoading && inputValue.trim().length >= 2 && suggestions.length === 0 && (
          <div
            className={`absolute z-50 w-full mt-1 rounded-xl border shadow-lg px-4 py-3 text-sm ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-400'
                : 'bg-white border-zinc-300 text-zinc-500'
            }`}
          >
            Nenhuma cidade encontrada
          </div>
        )}
      </div>
    </div>
  );
}
