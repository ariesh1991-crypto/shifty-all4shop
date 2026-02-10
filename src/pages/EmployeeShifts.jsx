import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, LogOut, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import NotificationBell from '../components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import MonthCalendar from '../components/shifts/MonthCalendar';

export default function EmployeeShifts() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        const allEmployees = await base44.entities.Employee.list();
        const employee = allEmployees.find(emp => emp.user_id === user.id);
        setCurrentEmployee(employee);
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, []);

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', currentEmployee?.id, monthKey],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const allShifts = await base44.entities.Shift.list();
      return allShifts.filter(s => s.assigned_employee_id === currentEmployee.id && s.date && s.date.startsWith(monthKey));
    },
    enabled: !!currentEmployee,
  });

  const renderDay = (date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 6) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = shifts.filter(s => s.date === dateStr);
    const dayNumber = format(date, 'd');

    const SHIFT_COLORS = {
      'מסיים ב-17:30': 'bg-blue-200 border-blue-500',
      'מסיים ב-19:00': 'bg-purple-200 border-purple-500',
      'שישי קצר': 'bg-yellow-200 border-yellow-500',
      'שישי ארוך': 'bg-orange-200 border-orange-500',
    };

    return (
      <div
        key={date.toString()}
        className={`p-3 border-2 rounded-lg min-h-[100px] ${dayShifts.length > 0 ? 'bg-white' : 'bg-gray-50'}`}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        <div className="space-y-1">
          {dayShifts.map((shift) => (
            <div
              key={shift.id}
              className={`text-xs p-2 rounded border-2 ${SHIFT_COLORS[shift.shift_type]}`}
            >
              <div className="font-bold text-center">{shift.shift_type}</div>
              {shift.start_time && shift.end_time && (
                <div className="text-center text-[10px] text-gray-700 mt-1">
                  {shift.start_time} - {shift.end_time}
                </div>
              )}
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

  const totalShifts = shifts.length;
  const shortShifts = shifts.filter(s => s.shift_type === 'מסיים ב-17:30').length;
  const longShifts = shifts.filter(s => s.shift_type === 'מסיים ב-19:00').length;
  const fridayShifts = shifts.filter(s => s.shift_type.includes('שישי')).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">{currentEmployee.full_name} - המשמרות שלי</h1>
          <div className="flex gap-2 flex-wrap">
            {currentUser && <NotificationBell userId={currentUser.id} />}
            <Link to={createPageUrl('EmployeeConstraints')}>
              <Button variant="outline">
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה לאילוצים
              </Button>
            </Link>
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

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="font-bold text-lg mb-4">סיכום משמרות לחודש {format(currentDate, 'MM/yyyy')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-700">{totalShifts}</div>
              <div className="text-sm text-blue-600">סה״כ משמרות</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{shortShifts}</div>
              <div className="text-sm text-blue-500">מסיים ב-17:30</div>
            </div>
            <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-700">{longShifts}</div>
              <div className="text-sm text-purple-600">מסיים ב-19:00</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-700">{fridayShifts}</div>
              <div className="text-sm text-yellow-600">משמרות שישי</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h3 className="font-bold mb-2">מקרא:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-200 border-2 border-blue-500"></div>
              <span className="text-sm">מסיים ב-17:30</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-200 border-2 border-purple-500"></div>
              <span className="text-sm">מסיים ב-19:00</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-yellow-200 border-2 border-yellow-500"></div>
              <span className="text-sm">שישי קצר</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-orange-200 border-2 border-orange-500"></div>
              <span className="text-sm">שישי ארוך</span>
            </div>
          </div>
        </div>

        <MonthCalendar year={year} month={month} renderDay={renderDay} />

        {shifts.length === 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 text-center mt-6">
            <p className="text-lg text-yellow-800 font-medium">
              עדיין לא שובצת למשמרות בחודש זה
            </p>
            <p className="text-sm text-yellow-700 mt-2">
              המנהל טרם יצר סידור משמרות או שטרם שובצת למשמרות
            </p>
          </div>
        )}
      </div>
    </div>
  );
}