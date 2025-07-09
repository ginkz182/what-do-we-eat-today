'use client';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, RefreshCcw, AlertCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  price: string;
  rating: number;
  address: string;
  reviewCount: number;
  photos?: string[];
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
  const cuisineOptions = [
    { value: 'cafe', label: 'Cafes' },
    { value: 'bar', label: 'Bars' },
    { value: 'bakery', label: 'Bakeries' },
    { value: 'meal_takeaway', label: 'Takeaway' },
    { value: 'meal_delivery', label: 'Delivery' },
    { value: 'fast_food_restaurant', label: 'Fast Food' },
    { value: 'pizza_restaurant', label: 'Pizza' },
    { value: 'coffee_shop', label: 'Coffee Shops' },
    { value: 'ice_cream_shop', label: 'Ice Cream' },
    { value: 'sandwich_shop', label: 'Sandwiches' },
    { value: 'brunch_restaurant', label: 'Brunch' },
    { value: 'american_restaurant', label: 'American' },
    { value: 'chinese_restaurant', label: 'Chinese' },
    { value: 'italian_restaurant', label: 'Italian' },
    { value: 'japanese_restaurant', label: 'Japanese' },
    { value: 'korean_restaurant', label: 'Korean' },
    { value: 'indian_restaurant', label: 'Indian' },
    { value: 'thai_restaurant', label: 'Thai' },
    { value: 'mexican_restaurant', label: 'Mexican' },
    { value: 'french_restaurant', label: 'French' },
    { value: 'seafood_restaurant', label: 'Seafood' },
    { value: 'steak_house', label: 'Steakhouse' },
    { value: 'sushi_restaurant', label: 'Sushi' },
    { value: 'vegan_restaurant', label: 'Vegan' },
    { value: 'vegetarian_restaurant', label: 'Vegetarian' },
  ];

  const allCuisineValues = cuisineOptions.map(option => option.value);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(allCuisineValues);
  const [isCuisineExpanded, setIsCuisineExpanded] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('');

  const isAllSelected = selectedCuisines.length === allCuisineValues.length;

  const handleCuisineChange = (cuisineValue: string) => {
    setSelectedCuisines(prev => 
      prev.includes(cuisineValue)
        ? prev.filter(c => c !== cuisineValue)
        : [...prev, cuisineValue]
    );
  };

  const handleAllChange = () => {
    if (isAllSelected) {
      setSelectedCuisines([]);
    } else {
      setSelectedCuisines(allCuisineValues);
    }
  };

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
          cuisines: selectedCuisines,
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
      const selectedRestaurant = data[randomIndex];
      setSuggestion(selectedRestaurant);
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

            {/* Cuisine Selection */}
            <div>
              <button
                onClick={() => setIsCuisineExpanded(!isCuisineExpanded)}
                className="flex items-center justify-between w-full text-sm font-medium mb-3 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 text-left">
                  <div>Cuisine Types ({selectedCuisines.length} selected)</div>
                  {!isCuisineExpanded && selectedCuisines.length > 0 && selectedCuisines.length < allCuisineValues.length && (
                    <div className="text-xs text-gray-600 mt-1 truncate">
                      {selectedCuisines
                        .slice(0, 3)
                        .map(cuisine => cuisineOptions.find(opt => opt.value === cuisine)?.label)
                        .join(', ')}
                      {selectedCuisines.length > 3 && ` +${selectedCuisines.length - 3} more`}
                    </div>
                  )}
                  {!isCuisineExpanded && isAllSelected && (
                    <div className="text-xs text-gray-600 mt-1">All types selected</div>
                  )}
                </div>
                {isCuisineExpanded ? (
                  <ChevronUp className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                )}
              </button>
              
              {isCuisineExpanded && (
                <div className="max-h-48 overflow-y-auto">
                  {/* All checkbox */}
                  <label className="flex items-center space-x-2 text-sm font-medium mb-2 p-2 bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleAllChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>All Types</span>
                  </label>
                  
                  {/* Individual cuisine checkboxes */}
                  <div className="grid grid-cols-2 gap-2">
                    {cuisineOptions.map((cuisine) => (
                      <label key={cuisine.value} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedCuisines.includes(cuisine.value)}
                          onChange={() => handleCuisineChange(cuisine.value)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{cuisine.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
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
                {/* Restaurant Photos */}
                {suggestion.photos && suggestion.photos.length > 0 && (
                  <div className="mt-3">
                    <div className="flex gap-2 overflow-x-auto">
                      {suggestion.photos.map((photo: string, index: number) => (
                        <Image
                          key={index}
                          src={photo}
                          alt={`${suggestion.name} photo ${index + 1}`}
                          width={80}
                          height={80}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {/* Google Maps Link */}
                <div className="mt-3">
                  <a
                    href={`https://www.google.com/maps/place/?q=place_id:${suggestion.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Google Maps
                  </a>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Source:{' '}
                  {dataSource === 'api'
                    ? 'Live Search'
                    : dataSource === 'user_cache'
                      ? 'Recent Search'
                      : dataSource === 'location_cache'
                        ? 'Cached Search'
                        : dataSource === 'mixed'
                          ? 'Mixed Cache + Live'
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
