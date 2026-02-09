import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay, startOfWeek, endOfWeek, isSameWeek, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, Sparkles, Users, LogOut, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import MonthCalendar from '../components/shifts/MonthCalendar';
import { he } from 'date-fns/locale';

const SHIFT_COLORS = {
  'בוקר': 'bg-blue-200',
  'ערב': 'bg-purple-200',
  'שישי קצר': 'bg-yellow-200',
  'שישי ארוך': 'bg-orange-200',
};

const STATUS_COLORS = {
  'תקין': 'border-green-500',
  'בעיה': 'border-red-500',
  'חריגה מאושרת': 'border-amber-500',
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
    queryKey: ['shifts', year, month],
    queryFn: async () => {
      const allShifts = await base44.entities.Shift.list();
      return allShifts.filter(s => s.date && s.date.startsWith(monthKey));
    },
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
      toast({ title: 'המשמרת עודכנה' });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id) => base44.entities.Shift.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
    },
  });

  const validateShift = (shift, allShifts, employees) => {
    const employee = employees.find(e => e.id === shift.assigned_employee_id);
    if (!employee) return { status: 'בעיה', reason: 'עובד לא קיים' };
    
    // כלל 6: לא זמין
    if (employee.unavailable) {
      return { status: 'בעיה', reason: 'עובד מסומן כלא זמין' };
    }

    const shiftDate = parseISO(shift.date);
    const weekStart = startOfWeek(shiftDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(shiftDate, { weekStartsOn: 0 });
    
    // משמרות העובד באותו שבוע (ללא שישי)
    const weekShifts = allShifts.filter(s => 
      s.assigned_employee_id === employee.id &&
      s.date >= format(weekStart, 'yyyy-MM-dd') &&
      s.date <= format(weekEnd, 'yyyy-MM-dd') &&
      !s.shift_type.includes('שישי')
    );

    // כלל 1: מקסימום 2 משמרות בשבוע
    if (weekShifts.length > 2 && !shift.shift_type.includes('שישי')) {
      return { status: 'בעיה', reason: 'חריגה מ-2 משמרות בשבוע' };
    }

    // כלל 4: חמישי ערב → אין שישי למחרת
    const dayOfWeek = getDay(shiftDate);
    if (dayOfWeek === 5 && shift.shift_type.includes('שישי')) {
      const yesterday = format(new Date(shiftDate.getTime() - 86400000), 'yyyy-MM-dd');
      const thursdayEvening = allShifts.find(s => 
        s.date === yesterday && 
        s.assigned_employee_id === employee.id && 
        s.shift_type === 'ערב'
      );
      if (thursdayEvening) {
        return { status: 'בעיה', reason: 'עשה חמישי ערב אתמול' };
      }
    }

    // כלל 5: שישי רצוף / יותר משישי אחד בחודש
    if (shift.shift_type.includes('שישי')) {
      const monthShifts = allShifts.filter(s => 
        s.assigned_employee_id === employee.id &&
        s.date.startsWith(monthKey) &&
        s.shift_type.includes('שישי')
      );
      
      if (monthShifts.length > 1) {
        return { status: 'בעיה', reason: 'יותר משישי אחד בחודש' };
      }
      
      if (employee.last_friday_date) {
        const lastFriday = parseISO(employee.last_friday_date);
        const daysDiff = Math.floor((shiftDate - lastFriday) / (1000 * 60 * 60 * 24));
        if (daysDiff === 7) {
          return { status: 'בעיה', reason: 'שישי רצוף' };
        }
      }
    }

    return { status: 'תקין', reason: '' };
  };

  const generateSchedule = async () => {
    setGenerating(true);
    try {
      // מחיקת משמרות קיימות
      for (const shift of shifts) {
        await deleteShiftMutation.mutateAsync(shift.id);
      }

      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      const newShifts = [];
      const activeEmployees = employees.filter(e => e.active && !e.unavailable);
      
      let morningIndex = 0;
      let eveningIndex = 0;

      for (const day of days) {
        const dayOfWeek = getDay(day);
        if (dayOfWeek === 6) continue; // דלג על שבת

        const dateStr = format(day, 'yyyy-MM-dd');
        const isFriday = dayOfWeek === 5;

        if (isFriday) {
          // שישי - 2 עובדים
          if (activeEmployees.length >= 2) {
            newShifts.push({
              date: dateStr,
              shift_type: 'שישי קצר',
              assigned_employee_id: activeEmployees[0].id,
              status: 'תקין',
            });
            newShifts.push({
              date: dateStr,
              shift_type: 'שישי ארוך',
              assigned_employee_id: activeEmployees[1].id,
              status: 'תקין',
            });
          }
        } else {
          // יום רגיל - בוקר וערב
          if (activeEmployees.length > 0) {
            newShifts.push({
              date: dateStr,
              shift_type: 'בוקר',
              assigned_employee_id: activeEmployees[morningIndex % activeEmployees.length].id,
              status: 'תקין',
            });
            morningIndex++;
            
            newShifts.push({
              date: dateStr,
              shift_type: 'ערב',
              assigned_employee_id: activeEmployees[eveningIndex % activeEmployees.length].id,
              status: 'תקין',
            });
            eveningIndex++;
          }
        }
      }

      // יצירת משמרות
      await base44.entities.Shift.bulkCreate(newShifts);
      queryClient.invalidateQueries(['shifts']);
      
      toast({ title: `נוצרו ${newShifts.length} משמרות` });
    } catch (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const renderDay = (date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 6) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = shifts.filter(s => s.date === dateStr);
    const dayNumber = format(date, 'd');
    const isFriday = dayOfWeek === 5;

    return (
      <div
        key={date.toString()}
        onClick={() => { setSelectedDate(dateStr); setDialogOpen(true); }}
        className={`p-2 border-2 rounded-lg cursor-pointer hover:shadow-md min-h-[100px] ${isFriday ? 'bg-blue-50' : 'bg-white'}`}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        <div className="space-y-1">
          {dayShifts.map((shift) => {
            const employee = employees.find(e => e.id === shift.assigned_employee_id);
            const validation = validateShift(shift, shifts, employees);
            return (
              <div
                key={shift.id}
                className={`text-xs p-1 rounded border-2 ${SHIFT_COLORS[shift.shift_type]} ${STATUS_COLORS[validation.status]}`}
              >
                <div className="font-medium">{employee?.full_name || 'לא משובץ'}</div>
                <div>{shift.shift_type}</div>
                {validation.status !== 'תקין' && (
                  <div className="text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-[10px]">{validation.reason}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">לוח משמרות</h1>
          
          <div className="flex gap-3">
            <Link to={createPageUrl('ManageEmployees')}>
              <Button variant="outline">
                <Users className="w-4 h-4 ml-2" />
                ניהול עובדים
              </Button>
            </Link>
            <Button onClick={generateSchedule} disabled={generating}>
              <Sparkles className="w-4 h-4 ml-2" />
              {generating ? 'יוצר...' : 'צור שיבוץ'}
            </Button>
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

        <MonthCalendar year={year} month={month} renderDay={renderDay} />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת משמרות - {selectedDate}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {shifts.filter(s => s.date === selectedDate).map(shift => (
                <div key={shift.id} className="border p-3 rounded">
                  <Label>עובד: {employees.find(e => e.id === shift.assigned_employee_id)?.full_name}</Label>
                  <div className="mt-2">סוג: {shift.shift_type}</div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="mt-2"
                    onClick={async () => {
                      await deleteShiftMutation.mutateAsync(shift.id);
                      setDialogOpen(false);
                    }}
                  >
                    מחק
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}