import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, List, Clock } from 'lucide-react';

export default function CalendarViewToggle({ view, onViewChange }) {
  return (
    <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm border">
      <Button
        variant={view === 'month' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('month')}
        className="gap-2"
      >
        <Calendar className="w-4 h-4" />
        חודשי
      </Button>
      <Button
        variant={view === 'week' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('week')}
        className="gap-2"
      >
        <Clock className="w-4 h-4" />
        שבועי
      </Button>
      <Button
        variant={view === 'agenda' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('agenda')}
        className="gap-2"
      >
        <List className="w-4 h-4" />
        רשימה
      </Button>
    </div>
  );
}