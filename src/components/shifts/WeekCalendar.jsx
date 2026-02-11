import React from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WeekCalendar({ currentDate, onDateChange, renderDay }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handlePrevWeek = () => {
    onDateChange(subWeeks(currentDate, 1));
  };

  const handleNextWeek = () => {
    onDateChange(addWeeks(currentDate, 1));
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <Button onClick={handleNextWeek} variant="outline" size="sm">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-bold">
          {format(weekStart, 'd MMM', { locale: he })} - {format(weekEnd, 'd MMM yyyy', { locale: he })}
        </h2>
        <Button onClick={handlePrevWeek} variant="outline" size="sm">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((day, idx) => (
          <div key={idx} className="text-center font-bold text-sm py-2 bg-gray-100 rounded">
            {day}
          </div>
        ))}
        {days.map((date) => {
          const dayOfWeek = getDay(date);
          if (dayOfWeek === 6) {
            return (
              <div key={date.toString()} className="bg-gray-100 rounded-lg p-2 min-h-[120px]">
                <div className="text-center text-gray-400 font-bold">{format(date, 'd')}</div>
              </div>
            );
          }
          return renderDay(date);
        })}
      </div>
    </div>
  );
}