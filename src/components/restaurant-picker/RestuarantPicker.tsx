'use client';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, RefreshCcw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Define interfaces
interface Restaurant {
  id: number;
  name: string;
  cuisine: string;
  price: string;
  distance: number;
  rating: number;
}

interface Location {
  lat: number;
  lng: number;
}

// Mock data - Replace with actual API calls
const mockRestaurants = [
  { id: 1, name: "Sushi Place", cuisine: "Japanese", price: "$$", distance: 0.8, rating: 4.5 },
  { id: 2, name: "Seoul Kitchen", cuisine: "Korean", price: "$$", distance: 1.2, rating: 4.2 },
  { id: 3, name: "Pad Thai Heaven", cuisine: "Thai", price: "$", distance: 0.5, rating: 4.7 },
  { id: 4, name: "Noodle House", cuisine: "Chinese", price: "$", distance: 1.5, rating: 4.0 },
  { id: 5, name: "Steak & Co", cuisine: "Western", price: "$$$", distance: 2.0, rating: 4.8 }
];

const cuisineTypes = ["All", "Japanese", "Korean", "Thai", "Chinese", "Western"];

const RestaurantPicker = () => {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string>("All");
  const [searchRadius, setSearchRadius] = useState<number>(2);
  const [suggestion, setSuggestion] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Get user's location when component mounts
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  const getRandomRestaurant = () => {
    setLoading(true);

    // Filter restaurants based on selected cuisine and radius
    const filteredRestaurants = mockRestaurants.filter(restaurant =>
      (selectedCuisine === "All" || restaurant.cuisine === selectedCuisine) &&
      restaurant.distance <= searchRadius
    );

    // Simulate API delay
    setTimeout(() => {
      if (filteredRestaurants.length > 0) {
        const randomIndex = Math.floor(Math.random() * filteredRestaurants.length);
        setSuggestion(filteredRestaurants[randomIndex]);
      } else {
        setSuggestion(null);
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Picker</CardTitle>
          <CardDescription>Let us help you decide what to eat</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Location Status */}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4" />
              {userLocation ?
                <span className="text-green-600">Location detected</span> :
                <span className="text-yellow-600">Detecting location...</span>
              }
            </div>

            {/* Cuisine Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Cuisine Type</label>
              <Select value={selectedCuisine} onValueChange={setSelectedCuisine}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cuisine" />
                </SelectTrigger>
                <SelectContent>
                  {cuisineTypes.map(cuisine => (
                    <SelectItem key={cuisine} value={cuisine}>
                      {cuisine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
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
                  {suggestion.cuisine} • {suggestion.price} • {suggestion.distance}km
                </p>
                <div className="mt-2">
                  <span className="text-yellow-500">{'★'.repeat(Math.floor(suggestion.rating))}</span>
                  <span className="text-gray-300">{'★'.repeat(5 - Math.floor(suggestion.rating))}</span>
                  <span className="ml-1 text-sm text-gray-600">{suggestion.rating}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestaurantPicker;
