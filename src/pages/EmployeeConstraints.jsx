import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import MonthCalendar from '../components/shifts/MonthCalendar';

const SHIFT_COLORS = {
  'קצרה': 'bg-blue-200',
  'ארוכה': 'bg-purple-200',
  'שישי קצר': 'bg-yellow-200',
  'שישי ארוך': 'bg-orange-200',
};

export default function EmployeeConstraints() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const user = await base44.auth.me();
        const allEmployees = await base44.entities.Employee.list();
        const employee = allEmployees.find(emp => emp.email?.toLowerCase() === user.email.toLowerCase());
        setCurrentEmployee(employee);
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, []);

  const { data: shifts = [] } = useQuery({
    queryKey: ['employee-shifts', currentEmployee?.id, monthKey],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const allShifts = await base44.entities.Shift.list();
      return allShifts.filter(s => 
        s.assigned_employee_id === currentEmployee.id &&
        s.date.startsWith(monthKey)
      );
    },
    enabled: !!currentEmployee,
  });

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
        className={`p-3 border rounded-lg min-h-[80px] ${isFriday ? 'bg-blue-50' : 'bg-white'}`}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        <div className="space-y-1">
          {dayShifts.map(shift => (
            <div
              key={shift.id}
              className={`text-xs p-1 rounded ${SHIFT_COLORS[shift.shift_type]} text-center font-medium`}
            >
              {shift.shift_type}
            </div>
          ))}
        </div>
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
          <h2 className="text-2xl font-bold mb-4">חשבונך ממתין לאישור</h2>
          <p className="text-gray-600 mb-6">מנהל המערכת יאשר את החשבון שלך בקרוב</p>
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
          <h1 className="text-3xl font-bold">{currentEmployee.full_name} - המשמרות שלי</h1>
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
          <h3 className="font-bold mb-2">מקרא משמרות:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-200 border"></div>
              <span className="text-sm">קצרה</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-200 border"></div>
              <span className="text-sm">ארוכה</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-yellow-200 border"></div>
              <span className="text-sm">שישי קצר</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-orange-200 border"></div>
              <span className="text-sm">שישי ארוך</span>
            </div>
          </div>
        </div>

        <MonthCalendar year={year} month={month} renderDay={renderDay} />
      </div>
    </div>
  );
}