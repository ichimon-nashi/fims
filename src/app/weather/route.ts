// src/app/api/weather/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Base location mapping
const BASE_LOCATIONS = {
  'TSA': {
    name: '松山',
    lat: 25.0676,
    lon: 121.5527
  },
  'KHH': {
    name: '高雄',
    lat: 22.6273,
    lon: 120.3014
  },
  'RMQ': {
    name: '台中',
    lat: 24.2621,
    lon: 120.6244
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base')?.toUpperCase() || 'TSA';
    
    // Get location info
    const location = BASE_LOCATIONS[base as keyof typeof BASE_LOCATIONS] || BASE_LOCATIONS.TSA;
    
    // Use OpenWeatherMap API (you'll need to get a free API key)
    const API_KEY = process.env.OPENWEATHER_API_KEY;
    
    if (!API_KEY) {
      // Return mock data if no API key
      return NextResponse.json({
        location: location.name,
        temperature: Math.floor(Math.random() * 10) + 25, // 25-35°C
        description: ['晴朗', '多雲', '陰天'][Math.floor(Math.random() * 3)],
        icon: '☀️',
        humidity: Math.floor(Math.random() * 30) + 50, // 50-80%
      });
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${API_KEY}&units=metric&lang=zh_tw`;
    
    const response = await fetch(weatherUrl);
    
    if (!response.ok) {
      throw new Error('Weather API request failed');
    }
    
    const weatherData = await response.json();
    
    // Map weather conditions to Chinese and emojis
    const getWeatherIcon = (condition: string): string => {
      const iconMap: { [key: string]: string } = {
        'clear': '☀️',
        'clouds': '☁️',
        'rain': '🌧️',
        'thunderstorm': '⛈️',
        'snow': '❄️',
        'mist': '🌫️',
        'fog': '🌫️',
        'haze': '🌫️'
      };
      return iconMap[condition.toLowerCase()] || '☀️';
    };
    
    const result = {
      location: location.name,
      temperature: Math.round(weatherData.main.temp),
      description: weatherData.weather[0].description,
      icon: getWeatherIcon(weatherData.weather[0].main),
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind?.speed || 0,
      pressure: weatherData.main.pressure
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Weather API error:', error);
    
    // Return fallback data
    const base = new URL(request.url).searchParams.get('base')?.toUpperCase() || 'TSA';
    const location = BASE_LOCATIONS[base as keyof typeof BASE_LOCATIONS] || BASE_LOCATIONS.TSA;
    
    return NextResponse.json({
      location: location.name,
      temperature: 28,
      description: '晴朗',
      icon: '☀️',
      humidity: 65,
      error: 'Unable to fetch live weather data'
    });
  }
}