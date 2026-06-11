import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function TopPredictorsCarousel({ users }: { users: User[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (users.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % users.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [users.length]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % users.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + users.length) % users.length);
  };

  if (users.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-br from-indigo-50 flex flex-col to-white rounded-3xl shadow-sm border border-gray-100 p-6 items-center justify-center min-h-[180px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.9, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.9, x: -20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center absolute"
        >
          <div className="relative mb-3">
            <img 
              src={users[currentIndex].avatar} 
              alt={users[currentIndex].name} 
              className="w-20 h-20 rounded-full border-4 border-white shadow-md object-cover" 
            />
            {currentIndex === 0 && <span className="absolute -top-2 -right-2 text-3xl drop-shadow-sm">👑</span>}
            {currentIndex === 1 && <span className="absolute -top-2 -right-2 text-3xl drop-shadow-sm">🥈</span>}
            {currentIndex === 2 && <span className="absolute -top-2 -right-2 text-3xl drop-shadow-sm">🥉</span>}
          </div>
          <h3 className="text-base font-bold text-gray-900 text-center">{users[currentIndex].name}</h3>
          <p className="text-sm text-indigo-600 font-black mt-1">{users[currentIndex].score} PTS</p>
          <p className="text-xs text-gray-500 font-medium">Rank #{currentIndex + 1}</p>
        </motion.div>
      </AnimatePresence>

      <button 
        onClick={handlePrev} 
        className="absolute left-4 p-2 bg-white rounded-full shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-95 transition-transform"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>

      <button 
        onClick={handleNext} 
        className="absolute right-4 p-2 bg-white rounded-full shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-95 transition-transform"
      >
        <ChevronRight className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  );
}
