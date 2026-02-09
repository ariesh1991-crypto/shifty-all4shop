import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
];

export default function ConstraintSelector({ isOpen, onClose, onSelect, selectedDate }) {
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
              onClick={() => onSelect(option.value)}
              className={`w-full ${option.color} hover:opacity-90 text-white`}
            >
              {option.label}
            </Button>
          ))}
          
          <Button
            onClick={() => onSelect(null)}
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