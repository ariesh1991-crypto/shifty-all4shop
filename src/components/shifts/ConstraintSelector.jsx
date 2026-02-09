import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const CONSTRAINT_OPTIONS = [
  { value: 'unavailable', label: 'לא זמין', color: 'bg-red-500' },
  { value: 'prefer_morning', label: 'מעדיף בוקר', color: 'bg-blue-500' },
  { value: 'prefer_evening', label: 'מעדיף ערב', color: 'bg-purple-500' },
  { value: 'special_hours_only', label: 'הערת שעות בלבד', color: 'bg-amber-500' },
];

export default function ConstraintSelector({ isOpen, onClose, onSelect, selectedDate, currentConstraint }) {
  const [selectedType, setSelectedType] = useState(currentConstraint?.constraint_type || null);
  const [specialHours, setSpecialHours] = useState(currentConstraint?.special_hours || '');

  React.useEffect(() => {
    if (currentConstraint) {
      setSelectedType(currentConstraint.constraint_type);
      setSpecialHours(currentConstraint.special_hours || '');
    } else {
      setSelectedType(null);
      setSpecialHours('');
    }
  }, [currentConstraint, selectedDate, isOpen]);

  const handleSelect = (constraintType) => {
    if (constraintType === null) {
      onSelect(null);
      setSelectedType(null);
      setSpecialHours('');
    } else {
      setSelectedType(constraintType);
    }
  };

  const handleSave = () => {
    if (selectedType) {
      onSelect(selectedType, specialHours);
      setSelectedType(null);
      setSpecialHours('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>בחר אילוץ ליום {selectedDate}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {CONSTRAINT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full ${option.color} hover:opacity-90 text-white ${selectedType === option.value ? 'ring-2 ring-offset-2 ring-gray-800' : ''}`}
            >
              {option.label}
            </Button>
          ))}
          
          {selectedType && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="special-hours">
                {selectedType === 'special_hours_only' ? 'הערת שעות (חובה)' : 'שעות מיוחדות (אופציונלי)'}
              </Label>
              <Input
                id="special-hours"
                placeholder='למשל: "מגיע ב-09:00" או "עד 15:30"'
                value={specialHours}
                onChange={(e) => setSpecialHours(e.target.value)}
                dir="rtl"
              />
            </div>
          )}
          
          {selectedType && (
            <Button
              onClick={handleSave}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
              disabled={selectedType === 'special_hours_only' && !specialHours.trim()}
            >
              ✓ אשר ושמור
            </Button>
          )}
          
          <Button
            onClick={() => handleSelect(null)}
            variant="outline"
            className="w-full"
          >
            <X className="w-4 h-4 ml-2" />
            הסר אילוץ
          </Button>
        </div>
        
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}