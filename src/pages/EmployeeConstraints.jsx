import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay, startOfMonth, endOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import MonthCalendar from '../components/shifts/MonthCalendar';

export default function EmployeeConstraints() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const user = await base44.auth.me();
        const allEmployees = await base44.entities.Employee.list();
        const employee = allEmployees.find(emp => emp.user_id === user.id);
        setCurrentEmployee(employee);
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, []);

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints', currentEmployee?.id, monthKey],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const all = await base44.entities.Constraint.list();
      return all.filter(c => c.employee_id === currentEmployee.id && c.date.startsWith(monthKey));
    },
    enabled: !!currentEmployee,
  });

  const createConstraintMutation = useMutation({
    mutationFn: (data) => base44.entities.Constraint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ נשמר' });
      setDialogOpen(false);
    },
  });

  const updateConstraintMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Constraint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ עודכן' });
      setDialogOpen(false);
    },
  });

  const deleteConstraintMutation = useMutation({
    mutationFn: (id) => base44.entities.Constraint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ נמחק' });
    },
  });

  const handleSaveConstraint = (constraintData) => {
    const existing = constraints.find(c => c.date === selectedDate);
    if (existing) {
      updateConstraintMutation.mutate({ id: existing.id, data: constraintData });
    } else {
      createConstraintMutation.mutate({ ...constraintData, employee_id: currentEmployee.id, date: selectedDate });
    }
  };

  const renderDay = (date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 6) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const constraint = constraints.find(c => c.date === dateStr);
    const dayNumber = format(date, 'd');

    return (
      <div
        key={date.toString()}
        onClick={() => { setSelectedDate(dateStr); setDialogOpen(true); }}
        className={`p-3 border-2 rounded-lg cursor-pointer hover:shadow-md min-h-[80px] ${
          constraint?.unavailable ? 'bg-red-100 border-red-400' :
          constraint?.preference === 'מעדיף קצרה' ? 'bg-blue-100 border-blue-400' :
          constraint?.preference === 'מעדיף ארוכה' ? 'bg-purple-100 border-purple-400' :
          'bg-white'
        }`}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        {constraint && (
          <div className="text-xs text-center space-y-1">
            {constraint.unavailable && <div className="font-bold text-red-600">לא זמין</div>}
            {constraint.preference !== 'אין העדפה' && (
              <div className="text-gray-700">{constraint.preference}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" dir="rtl">טוען...</div>;
  }

  if (!currentEmployee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-6" dir="rtl">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">חשבונך ממתין לחיבור</h2>
          <p className="text-gray-600 mb-6">מנהל המערכת יחבר את חשבונך לרשומת העובד שלך בקרוב</p>
          <Button onClick={() => base44.auth.logout()}>
            <LogOut className="w-4 h-4 ml-2" />
            יציאה
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{currentEmployee.full_name} - אילוצים והעדפות</h1>
          <div className="flex gap-2">
            <Button onClick={() => setCurrentDate(new Date(year, month - 2))} variant="outline">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={() => setCurrentDate(new Date(year, month))} variant="outline">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button onClick={() => base44.auth.logout()} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h3 className="font-bold mb-2">מקרא:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-red-100 border-2 border-red-400"></div>
              <span className="text-sm">לא זמין</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-100 border-2 border-blue-400"></div>
              <span className="text-sm">מעדיף קצרה</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-100 border-2 border-purple-400"></div>
              <span className="text-sm">מעדיף ארוכה</span>
            </div>
          </div>
        </div>

        <MonthCalendar year={year} month={month} renderDay={renderDay} />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>אילוצים והעדפות - {selectedDate}</DialogTitle>
            </DialogHeader>
            <ConstraintForm
              selectedDate={selectedDate}
              existingConstraint={constraints.find(c => c.date === selectedDate)}
              onSave={handleSaveConstraint}
              onDelete={(id) => deleteConstraintMutation.mutate(id)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ConstraintForm({ selectedDate, existingConstraint, onSave, onDelete }) {
  const [unavailable, setUnavailable] = useState(existingConstraint?.unavailable || false);
  const [preference, setPreference] = useState(existingConstraint?.preference || 'אין העדפה');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch checked={unavailable} onCheckedChange={setUnavailable} />
        <Label>לא זמין בתאריך זה</Label>
      </div>

      <div>
        <Label>העדפה</Label>
        <Select value={preference} onValueChange={setPreference}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="אין העדפה">אין העדפה</SelectItem>
            <SelectItem value="מעדיף קצרה">מעדיף קצרה</SelectItem>
            <SelectItem value="מעדיף ארוכה">מעדיף ארוכה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 justify-end">
        {existingConstraint && (
          <Button variant="destructive" onClick={() => onDelete(existingConstraint.id)}>
            מחק
          </Button>
        )}
        <Button onClick={() => onSave({ unavailable, preference })}>
          שמור
        </Button>
      </div>
    </div>
  );
}