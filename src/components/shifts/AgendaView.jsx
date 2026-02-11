import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function AgendaView({ currentDate, items, getItemsForDate, renderItem }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    .filter(date => getDay(date) !== 6); // exclude Saturdays

  const daysWithItems = days.filter(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return getItemsForDate(dateStr).length > 0;
  });

  if (daysWithItems.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
        <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>אין אירועים לחודש זה</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="divide-y">
        {daysWithItems.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayItems = getItemsForDate(dateStr);
          
          return (
            <div key={dateStr} className="p-4 hover:bg-gray-50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {format(date, 'd')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(date, 'EEE', { locale: he })}
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {dayItems.map((item, idx) => renderItem(item, idx))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}