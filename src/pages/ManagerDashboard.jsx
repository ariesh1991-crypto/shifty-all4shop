import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Sparkles, Edit2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MonthCalendar from '../components/shifts/MonthCalendar';
import ShiftLegend from '../components/shifts/ShiftLegend';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SHIFT_COLORS = {
  morning: 'bg-blue-200',
  evening: 'bg-purple-200',
  special: 'bg-green-200',
  friday_a: 'bg-yellow-200',
  friday_b: 'bg-orange-200',
};

const SHIFT_LABELS = {
  morning: 'בוקר',
  evening: 'ערב',
  special: 'מיוחד',
  friday_a: 'שישי A',
  friday_b: 'שישי B',
};

export default function ManagerDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', monthKey],
    queryFn: () => base44.entities.Shift.filter({ month: monthKey }),
  });

  const { data: constraints = [] } = useQuery({
    queryKey: ['all-constraints'],
    queryFn: () => base44.entities.Constraint.list(),
  });

  const createShiftMutation = useMutation({
    mutationFn: (data) => base44.entities.Shift.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Shift.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
      toast({ title: 'המשמרת עודכנה בהצלחה' });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id) => base44.entities.Shift.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
    },
  });

  const getShiftForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.filter((s) => s.date === dateStr);
  };

  const generateSchedule = async () => {
    setGenerating(true);
    try {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      const daysInMonth = monthEnd.getDate();

      // מחיקת משמרות קיימות של החודש
      for (const shift of shifts) {
        await deleteShiftMutation.mutateAsync(shift.id);
      }

      const newShifts = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);

        // דלג על שבתות
        if (dayOfWeek === 6) continue;

        const isFriday = dayOfWeek === 5;

        // עובדים זמינים לאותו יום
        const availableEmployees = employees.filter((emp) => {
          if (emp.contract_type === 'regular') return false;
          
          const hasUnavailableConstraint = constraints.some(
            (c) => c.employee_id === emp.id && c.date === dateStr && c.constraint_type === 'unavailable'
          );
          return !hasUnavailableConstraint;
        });

        if (isFriday) {
          // שיבוץ שישי - לסירוגין A ו-B
          const fridayType = Math.floor(day / 7) % 2 === 0 ? 'friday_a' : 'friday_b';
          const employee = availableEmployees[0];
          if (employee) {
            newShifts.push({
              employee_id: employee.id,
              date: dateStr,
              shift_type: fridayType,
              month: monthKey,
            });
          }
        } else {
          // שיבוץ ימים רגילים
          const morningEmployees = availableEmployees.filter((emp) => {
            const pref = constraints.find(
              (c) => c.employee_id === emp.id && c.date === dateStr
            );
            return emp.contract_type === 'morning' || emp.contract_type === 'special' || 
                   (pref && pref.constraint_type === 'prefer_morning');
          });

          const eveningEmployees = availableEmployees.filter((emp) => {
            const pref = constraints.find(
              (c) => c.employee_id === emp.id && c.date === dateStr
            );
            return emp.contract_type === 'evening' || emp.contract_type === 'special' || 
                   (pref && pref.constraint_type === 'prefer_evening');
          });

          if (morningEmployees.length > 0) {
            const employee = morningEmployees[day % morningEmployees.length];
            newShifts.push({
              employee_id: employee.id,
              date: dateStr,
              shift_type: employee.contract_type === 'special' ? 'special' : 'morning',
              month: monthKey,
            });
          }

          if (eveningEmployees.length > 0) {
            const employee = eveningEmployees[(day + 1) % eveningEmployees.length];
            newShifts.push({
              employee_id: employee.id,
              date: dateStr,
              shift_type: employee.contract_type === 'special' ? 'special' : 'evening',
              month: monthKey,
            });
          }
        }
      }

      // יצירת כל המשמרות
      await base44.entities.Shift.bulkCreate(newShifts);
      queryClient.invalidateQueries(['shifts']);
      
      toast({
        title: 'השיבוץ נוצר בהצלחה!',
        description: `נוצרו ${newShifts.length} משמרות`,
      });
    } catch (error) {
      toast({
        title: 'שגיאה ביצירת השיבוץ',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDayClick = (date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setDialogOpen(true);
  };

  const handleShiftUpdate = async (shiftId, employeeId, shiftType) => {
    if (shiftId) {
      if (!employeeId || !shiftType) {
        await deleteShiftMutation.mutateAsync(shiftId);
      } else {
        await updateShiftMutation.mutateAsync({
          id: shiftId,
          data: { employee_id: employeeId, shift_type: shiftType },
        });
      }
    } else if (employeeId && shiftType) {
      await createShiftMutation.mutateAsync({
        employee_id: employeeId,
        date: selectedDate,
        shift_type: shiftType,
        month: monthKey,
      });
    }
    setDialogOpen(false);
  };

  const renderDay = (date) => {
    const dayShifts = getShiftForDate(date);
    const dayNumber = format(date, 'd');
    const isWeekend = format(date, 'i') === '6' || format(date, 'i') === '7';

    return (
      <div
        key={date.toString()}
        onClick={() => handleDayClick(date)}
        className={`
          p-2 border rounded-lg cursor-pointer transition-all hover:shadow-md min-h-[80px]
          ${isWeekend ? 'bg-gray-100 border-blue-300' : 'bg-white border-gray-200'}
        `}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        <div className="space-y-1">
          {dayShifts.map((shift) => {
            const employee = employees.find((e) => e.id === shift.employee_id);
            return (
              <div
                key={shift.id}
                className={`text-xs p-1 rounded ${SHIFT_COLORS[shift.shift_type]} text-center`}
              >
                {employee?.full_name} - {SHIFT_LABELS[shift.shift_type]}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const shiftsForSelectedDate = selectedDate ? getShiftForDate(new Date(selectedDate)) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold text-gray-800">לוח משמרות - ניהול</h1>
          
          <div className="flex gap-3">
            <Link to={createPageUrl('ManageEmployees')}>
              <Button variant="outline">
                <Users className="w-4 h-4 ml-2" />
                ניהול עובדים
              </Button>
            </Link>
            
            <Button onClick={generateSchedule} disabled={generating} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Sparkles className="w-4 h-4 ml-2" />
              {generating ? 'יוצר שיבוץ...' : 'צור שיבוץ אוטומטי'}
            </Button>
            
            <Button onClick={goToPreviousMonth} variant="outline">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={goToNextMonth} variant="outline">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <ShiftLegend />

        <MonthCalendar year={year} month={month} renderDay={renderDay} />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת משמרות ליום {selectedDate}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {shiftsForSelectedDate.length === 0 && (
                <p className="text-gray-500 text-center">אין משמרות ליום זה</p>
              )}
              
              {shiftsForSelectedDate.map((shift) => {
                const employee = employees.find((e) => e.id === shift.employee_id);
                return (
                  <div key={shift.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{employee?.full_name}</span>
                    </div>
                    
                    <Select
                      value={shift.shift_type}
                      onValueChange={(value) => handleShiftUpdate(shift.id, shift.employee_id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">בוקר 08:00-17:30</SelectItem>
                        <SelectItem value="evening">ערב 10:30-19:00</SelectItem>
                        <SelectItem value="special">מיוחד 10:00-19:00</SelectItem>
                        <SelectItem value="friday_a">שישי A 08:00-14:00</SelectItem>
                        <SelectItem value="friday_b">שישי B 08:30-12:00</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleShiftUpdate(shift.id, null, null)}
                      className="w-full"
                    >
                      מחק משמרת
                    </Button>
                  </div>
                );
              })}
              
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full">
                סגור
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}