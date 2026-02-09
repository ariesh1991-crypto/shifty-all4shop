import React from 'react';

const SHIFT_TYPES = [
  { type: 'morning', label: 'בוקר 08:00-17:30', color: 'bg-blue-200' },
  { type: 'evening_type1', label: 'ערב סוג 1 - 10:30-19:00', color: 'bg-purple-200' },
  { type: 'evening_type2', label: 'ערב סוג 2 - 10:00-19:00', color: 'bg-green-200' },
  { type: 'friday_a', label: 'שישי A 08:00-14:00', color: 'bg-yellow-200' },
  { type: 'friday_b', label: 'שישי B 08:30-12:00', color: 'bg-orange-200' },
];

const CONSTRAINT_TYPES = [
  { type: 'unavailable', label: 'לא זמין', color: 'bg-red-500 text-white' },
  { type: 'prefer_morning', label: 'מעדיף בוקר', color: 'bg-blue-500 text-white' },
  { type: 'prefer_evening', label: 'מעדיף ערב', color: 'bg-purple-500 text-white' },
];

export default function ShiftLegend({ showConstraints = false }) {
  const items = showConstraints ? CONSTRAINT_TYPES : SHIFT_TYPES;
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4" dir="rtl">
      <h3 className="font-bold mb-3">
        {showConstraints ? 'מקרא אילוצים:' : 'מקרא משמרות:'}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded ${item.color} border border-gray-300`}></div>
            <span className="text-sm">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}