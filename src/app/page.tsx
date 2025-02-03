import RestaurantPicker from '../components/restaurant-picker/RestuarantPicker';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          What do we eat today?
        </h1>
        <RestaurantPicker />
      </div>
    </main>
  );
}
