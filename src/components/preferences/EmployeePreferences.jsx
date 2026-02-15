import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function EmployeePreferences({ employee, onSave }) {
  const [preferences, setPreferences] = useState({
    preferred_days: employee?.preferred_days || [],
    blocked_days: employee?.blocked_days || [],
    friday_preference: employee?.friday_preference || 'none',
    morning_preferred_days: employee?.morning_preferred_days || [],
    evening_preferred_days: employee?.evening_preferred_days || [],
  });

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

  const toggleDay = (type, day) => {
    const current = preferences[type] || [];
    if (current.includes(day)) {
      setPreferences({ ...preferences, [type]: current.filter(d => d !== day) });
    } else {
      setPreferences({ ...preferences, [type]: [...current, day] });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>העדפות ימים בשבוע</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-3 block">ימים מועדפים לעבודה</Label>
            <div className="grid grid-cols-3 gap-2">
              {dayNames.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay('preferred_days', idx)}
                  className={`p-2 rounded border-2 text-sm transition-all ${
                    preferences.preferred_days?.includes(idx)
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white border-gray-300 hover:border-green-400'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-3 block text-red-600">ימים שמעדיף לא לעבוד</Label>
            <div className="grid grid-cols-3 gap-2">
              {dayNames.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay('blocked_days', idx)}
                  className={`p-2 rounded border-2 text-sm transition-all ${
                    preferences.blocked_days?.includes(idx)
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white border-gray-300 hover:border-red-400'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>העדפות סוגי משמרות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-3 block">ימים מועדפים למשמרות בוקר (מסיים 17:30)</Label>
            <div className="grid grid-cols-3 gap-2">
              {dayNames.slice(0, 5).map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay('morning_preferred_days', idx)}
                  className={`p-2 rounded border-2 text-sm transition-all ${
                    preferences.morning_preferred_days?.includes(idx)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-3 block">ימים מועדפים למשמרות ערב (מסיים 19:00)</Label>
            <div className="grid grid-cols-3 gap-2">
              {dayNames.slice(0, 5).map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay('evening_preferred_days', idx)}
                  className={`p-2 rounded border-2 text-sm transition-all ${
                    preferences.evening_preferred_days?.includes(idx)
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'bg-white border-gray-300 hover:border-purple-400'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>העדפות שישי</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="mb-2 block">מה אתה מעדיף בשישי?</Label>
          <Select 
            value={preferences.friday_preference} 
            onValueChange={(val) => setPreferences({ ...preferences, friday_preference: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא העדפה</SelectItem>
              <SelectItem value="long">מעדיף שישי ארוך (08:00-14:00)</SelectItem>
              <SelectItem value="short">מעדיף שישי קצר (08:30-12:00)</SelectItem>
              <SelectItem value="avoid">מעדיף להימנע משישי</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button onClick={() => onSave(preferences)}>
          שמור העדפות
        </Button>
      </div>
    </div>
  );
}