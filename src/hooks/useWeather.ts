// src/hooks/useWeather.ts - Updated with session-based caching
import { useState, useEffect, useRef, useCallback } from 'react';
import WeatherService from '@/services/weatherService';

interface WeatherData {
  location: string;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed?: number;
  pressure?: number;
  error?: string;
  isMockData?: boolean;
}

export const useWeather = (base: string) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const weatherService = useRef(WeatherService.getInstance());
  const lastFetchTime = useRef<number>(0);

  const fetchWeather = useCallback(async () => {
    // Use local variable instead of modifying parameter
    const targetBase = base || 'TSA';
    
    if (!base) {
      console.log('No base provided, using default TSA');
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching weather for base:', targetBase);
      const weatherData = await weatherService.current.getWeather(targetBase);
      
      setWeather(weatherData);
      lastFetchTime.current = Date.now();
      
      if (weatherData.isMockData) {
        setError('Using fallback weather data');
      }
      
    } catch (err) {
      console.error('Weather fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      // Set fallback weather
      const locationName = targetBase === 'KHH' ? '高雄' : targetBase === 'RMQ' ? '台中' : '松山';
      setWeather({
        location: locationName,
        temperature: 28,
        description: '晴朗',
        icon: '☀️',
        humidity: 65,
        error: 'Unable to fetch live weather data',
        isMockData: true
      });
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    // Only fetch if we don't have recent data
    const timeSinceLastFetch = Date.now() - lastFetchTime.current;
    const shouldFetch = !weather || timeSinceLastFetch > 10 * 60 * 1000; // 10 minutes

    if (shouldFetch) {
      fetchWeather();
    } else {
      console.log('⚡ Skipping weather fetch - recent data available');
      setLoading(false);
    }

    // Set up refresh interval (much longer now - only for fallback)
    const interval = setInterval(() => {
      const timeSinceLastFetch = Date.now() - lastFetchTime.current;
      if (timeSinceLastFetch > 30 * 60 * 1000) { // 30 minutes
        fetchWeather();
      }
    }, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [base, weather, fetchWeather]); // Include all dependencies

  // Function to manually refresh weather
  const refreshWeather = useCallback(async () => {
    // Use local variable for consistency
    const targetBase = base || 'TSA';
    
    try {
      setLoading(true);
      setError(null);
      const weatherData = await weatherService.current.getWeather(targetBase, true); // Force refresh
      setWeather(weatherData);
      lastFetchTime.current = Date.now();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [base]);

  return { weather, loading, error, refreshWeather };
};