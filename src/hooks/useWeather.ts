// src/hooks/useWeather.ts - Session-based caching (fetch once per login)
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

const WEATHER_SESSION_KEY = 'weather_session_data';
const WEATHER_TIMESTAMP_KEY = 'weather_session_timestamp';

export const useWeather = (base: string) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const weatherService = useRef(WeatherService.getInstance());
  const hasFetchedThisSession = useRef(false);

  // Load cached weather from sessionStorage
  const loadCachedWeather = useCallback(() => {
    try {
      const cachedData = sessionStorage.getItem(WEATHER_SESSION_KEY);
      const cachedTimestamp = sessionStorage.getItem(WEATHER_TIMESTAMP_KEY);
      
      if (cachedData && cachedTimestamp) {
        const weatherData = JSON.parse(cachedData);
        console.log('⚡ Using cached weather data from session');
        setWeather(weatherData);
        setLoading(false);
        hasFetchedThisSession.current = true;
        return true;
      }
    } catch (err) {
      console.error('Error loading cached weather:', err);
    }
    return false;
  }, []);

  // Save weather to sessionStorage
  const cacheWeather = useCallback((weatherData: WeatherData) => {
    try {
      sessionStorage.setItem(WEATHER_SESSION_KEY, JSON.stringify(weatherData));
      sessionStorage.setItem(WEATHER_TIMESTAMP_KEY, Date.now().toString());
    } catch (err) {
      console.error('Error caching weather:', err);
    }
  }, []);

  const fetchWeather = useCallback(async (forceRefresh = false) => {
    // Use local variable instead of modifying parameter
    const targetBase = base || 'TSA';
    
    if (!base) {
      console.log('No base provided, using default TSA');
    }

    // If already fetched this session and not forcing refresh, skip
    if (hasFetchedThisSession.current && !forceRefresh) {
      console.log('⚡ Weather already fetched this session, skipping');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('🌤️  Fetching weather for base:', targetBase);
      const weatherData = await weatherService.current.getWeather(targetBase);
      
      setWeather(weatherData);
      cacheWeather(weatherData);
      hasFetchedThisSession.current = true;
      
      if (weatherData.isMockData) {
        setError('Using fallback weather data');
      }
      
    } catch (err) {
      console.error('Weather fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      // Set fallback weather
      const locationName = targetBase === 'KHH' ? '高雄' : targetBase === 'RMQ' ? '台中' : '松山';
      const fallbackWeather = {
        location: locationName,
        temperature: 28,
        description: '晴朗',
        icon: '☀️',
        humidity: 65,
        error: 'Unable to fetch live weather data',
        isMockData: true
      };
      setWeather(fallbackWeather);
      cacheWeather(fallbackWeather);
      hasFetchedThisSession.current = true;
    } finally {
      setLoading(false);
    }
  }, [base, cacheWeather]);

  useEffect(() => {
    // Try to load cached weather first
    const hasCache = loadCachedWeather();
    
    // If no cache, fetch new data
    if (!hasCache && !hasFetchedThisSession.current) {
      fetchWeather();
    }
  }, [base, loadCachedWeather, fetchWeather]);

  // Function to manually refresh weather (clears session cache)
  const refreshWeather = useCallback(async () => {
    console.log('🔄 Manual weather refresh requested');
    hasFetchedThisSession.current = false;
    sessionStorage.removeItem(WEATHER_SESSION_KEY);
    sessionStorage.removeItem(WEATHER_TIMESTAMP_KEY);
    await fetchWeather(true);
  }, [fetchWeather]);

  return { weather, loading, error, refreshWeather };
};