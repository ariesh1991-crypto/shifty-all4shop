import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { he } from 'date-fns/locale';

const DAYS_OF_WEEK = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function MonthCalendar({ year, month, renderDay }) {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = getDay(monthStart);
  const emptyDays = Array(firstDayOfWeek).fill(null);

  return (
    <div className="bg-white rounded-lg shadow-md p-6" dir="rtl">
      <h2 className="text-2xl font-bold mb-4 text-center">
        {format(monthStart, 'MMMM yyyy', { locale: he })}
      </h2>
      
      <div className="grid grid-cols-7 gap-2">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="text-center font-bold text-gray-700 py-2">
            {day}
          </div>
        ))}
        
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="p-2"></div>
        ))}
        
        {days.map((day) => renderDay(day))}
      </div>
    </div>
  );
}