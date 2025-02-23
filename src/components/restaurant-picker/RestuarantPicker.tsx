'use client';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, RefreshCcw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  price: string;
  rating: number;
  address: string;
  reviewCount: number;
}

interface Location {
  lat: number;
  lng: number;
}

interface APIResponse {
  data: Restaurant[];
  source: 'api' | 'user_cache' | 'location_cache';
}

const RestaurantPicker = () => {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(2);
  const [suggestion, setSuggestion] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('');

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setError(null);
        },
        error => {
          console.error('Error getting location:', error);
          setError('Unable to get your location. Please enable location services.');
        },
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getRandomRestaurant = async () => {
    if (!userLocation) return;

    setLoading(true);
    setError(null);
    setSuggestion(null);
    setDataSource('');

    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: userLocation,
          radius: searchRadius,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 429) {
          throw new Error(
            `Rate limit exceeded. Please try again after ${new Date(data.reset).toLocaleTimeString()}.`,
          );
        }
        throw new Error(data.error || 'Failed to fetch restaurants');
      }

      const { data, source } = (await response.json()) as APIResponse;

      if (data.length === 0) {
        setError(
          'No restaurants found with the selected criteria. Try increasing the radius or changing the cuisine type.',
        );
        return;
      }

      // Get random restaurant from results
      const randomIndex = Math.floor(Math.random() * data.length);
      setSuggestion(data[randomIndex]);
      setDataSource(source);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Error fetching restaurants. Please try again.',
      );
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Smart Restaurant Picker</CardTitle>
          <CardDescription>Don&apos;t know what to eat? We do!</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Location Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4" />
                {userLocation ? (
                  <span className="text-green-600">Location detected</span>
                ) : (
                  <span className="text-yellow-600">Detecting location...</span>
                )}
              </div>
              {userLocation && (
                <button
                  onClick={getCurrentLocation}
                  className="text-blue-600 hover:text-blue-800"
                  title="Refresh location"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <p>{error}</p>
              </div>
            )}

            {/* Radius Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Search Radius: {searchRadius}km
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={searchRadius}
                onChange={e => setSearchRadius(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Suggestion Button */}
            <button
              onClick={getRandomRestaurant}
              disabled={!userLocation || loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg 
                       hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCcw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Suggest Restaurant
            </button>

            {/* Restaurant Suggestion */}
            {suggestion && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-bold text-lg">{suggestion.name}</h3>
                <p className="text-sm text-gray-600">
                  {suggestion.cuisine} • {suggestion.price}
                </p>
                <p className="text-sm text-gray-600 mt-1">{suggestion.address}</p>
                <div className="mt-2">
                  <span className="text-yellow-500">
                    {'★'.repeat(Math.floor(suggestion.rating))}
                  </span>
                  <span className="text-gray-300">
                    {'★'.repeat(5 - Math.floor(suggestion.rating))}
                  </span>
                  <span className="ml-1 text-sm text-gray-600">
                    {suggestion.rating.toFixed(1)} ({suggestion.reviewCount} reviews)
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Source:{' '}
                  {dataSource === 'api'
                    ? 'Live Search'
                    : dataSource === 'user_cache'
                      ? 'Recent Search'
                      : 'Nearby Search'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestaurantPicker;
