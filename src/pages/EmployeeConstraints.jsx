import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear } from 'date-fns';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MonthCalendar from '../components/shifts/MonthCalendar';
import ConstraintSelector from '../components/shifts/ConstraintSelector';
import ShiftLegend from '../components/shifts/ShiftLegend';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CONSTRAINT_COLORS = {
  unavailable: 'bg-red-500 text-white',
  prefer_morning: 'bg-blue-500 text-white',
  prefer_evening: 'bg-purple-500 text-white',
  special_hours_only: 'bg-amber-500 text-white',
};

const SHIFT_COLORS = {
  morning_type1: 'bg-blue-200',
  evening_type1: 'bg-purple-200',
  morning_type2: 'bg-cyan-200',
  evening_type2: 'bg-green-200',
  friday_a: 'bg-yellow-200',
  friday_b: 'bg-orange-200',
};

const SHIFT_LABELS = {
  morning_type1: 'בוקר 1',
  evening_type1: 'ערב 1',
  morning_type2: 'בוקר 2',
  evening_type2: 'ערב 2',
  friday_a: 'שישי A',
  friday_b: 'שישי B',
};

export default function EmployeeConstraints() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    const loadCurrentEmployee = async () => {
      try {
        const user = await base44.auth.me();
        const allEmployees = await base44.entities.Employee.list();
        const employee = allEmployees.find(emp => emp.email.toLowerCase() === user.email.toLowerCase());
        if (employee) {
          setCurrentEmployee(employee);
        }
      } finally {
        setLoading(false);
      }
    };
    loadCurrentEmployee();
  }, []);

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints', currentEmployee?.id, year, month],
    queryFn: async () => {
      if (!currentEmployee) return [];
      return await base44.entities.Constraint.filter({
        employee_id: currentEmployee.id,
      });
    },
    enabled: !!currentEmployee,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['employee-shifts', currentEmployee?.id, monthKey],
    queryFn: async () => {
      if (!currentEmployee) return [];
      return await base44.entities.Shift.filter({
        employee_id: currentEmployee.id,
        month: monthKey,
      });
    },
    enabled: !!currentEmployee,
  });

  const createConstraintMutation = useMutation({
    mutationFn: (data) => base44.entities.Constraint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'האילוץ נשמר בהצלחה' });
    },
  });

  const updateConstraintMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Constraint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'האילוץ עודכן בהצלחה' });
    },
  });

  const deleteConstraintMutation = useMutation({
    mutationFn: (id) => base44.entities.Constraint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'האילוץ הוסר בהצלחה' });
    },
  });

  const getConstraintForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return constraints.find((c) => c.date === dateStr);
  };

  const getShiftsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.filter((s) => s.date === dateStr);
  };

  const handleDayClick = (date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setDialogOpen(true);
  };

  const handleConstraintSelect = async (constraintType, specialHours = '') => {
    if (!currentEmployee) return;

    const existingConstraint = getConstraintForDate(new Date(selectedDate));

    if (constraintType === null) {
      if (existingConstraint) {
        await deleteConstraintMutation.mutateAsync(existingConstraint.id);
      }
    } else if (existingConstraint) {
      await updateConstraintMutation.mutateAsync({
        id: existingConstraint.id,
        data: { constraint_type: constraintType, special_hours: specialHours },
      });
    } else {
      await createConstraintMutation.mutateAsync({
        employee_id: currentEmployee.id,
        date: selectedDate,
        constraint_type: constraintType,
        special_hours: specialHours,
      });
    }

    setDialogOpen(false);
  };

  const renderConstraintDay = (date) => {
    const dayOfWeek = format(date, 'i');
    if (dayOfWeek === '6') return null;
    
    const constraint = getConstraintForDate(date);
    const dayNumber = format(date, 'd');
    const isFriday = dayOfWeek === '5';

    return (
      <div
        key={date.toString()}
        onClick={() => handleDayClick(date)}
        className={`
          p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md
          ${constraint ? CONSTRAINT_COLORS[constraint.constraint_type] : 'bg-gray-50 hover:bg-gray-100'}
          ${isFriday ? 'border-blue-300' : 'border-gray-200'}
        `}
      >
        <div className="font-bold text-center mb-1">{dayNumber}</div>
        {constraint?.special_hours && (
          <div className="text-xs text-center mt-1 font-medium">
            {constraint.special_hours}
          </div>
        )}
      </div>
    );
  };

  const renderShiftDay = (date) => {
    const dayOfWeek = format(date, 'i');
    if (dayOfWeek === '6') return null;
    
    const dayShifts = getShiftsForDate(date);
    const dayNumber = format(date, 'd');
    const isFriday = dayOfWeek === '5';

    return (
      <div
        key={date.toString()}
        className={`
          p-2 border rounded-lg min-h-[80px]
          ${isFriday ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}
        `}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        <div className="space-y-1">
          {dayShifts.map((shift) => (
            <div
              key={shift.id}
              className={`text-xs p-1 rounded ${SHIFT_COLORS[shift.shift_type]} text-center font-medium`}
            >
              {SHIFT_LABELS[shift.shift_type]}
            </div>
          ))}
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6" dir="rtl">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">טוען נתוני עובד...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentEmployee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6 flex items-center justify-center" dir="rtl">
        <div className="max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">חשבונך ממתין לאישור</h2>
            <p className="text-gray-600 mb-4">ההרשמה שלך התקבלה בהצלחה!</p>
            <p className="text-gray-500 text-sm mb-6">מנהל המערכת יאשר את החשבון שלך בקרוב, ואז תוכל להתחיל להגדיר אילוצים ולראות את המשמרות שלך.</p>
            <Button 
              onClick={() => base44.auth.logout()} 
              className="bg-amber-600 hover:bg-amber-700"
            >
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            {currentEmployee.full_name}
          </h1>
          <div className="flex gap-2">
            <Button onClick={goToPreviousMonth} variant="outline">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={goToNextMonth} variant="outline">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button onClick={() => base44.auth.logout()} variant="outline" className="text-red-600 hover:text-red-700">
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>

        <Tabs defaultValue="shifts" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="shifts">המשמרות שלי</TabsTrigger>
            <TabsTrigger value="constraints">האילוצים שלי</TabsTrigger>
          </TabsList>
          
          <TabsContent value="shifts">
            <ShiftLegend showConstraints={false} />
            <MonthCalendar year={year} month={month} renderDay={renderShiftDay} />
          </TabsContent>
          
          <TabsContent value="constraints">
            <ShiftLegend showConstraints={true} />
            <MonthCalendar year={year} month={month} renderDay={renderConstraintDay} />
          </TabsContent>
        </Tabs>

        <ConstraintSelector
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSelect={handleConstraintSelect}
          selectedDate={selectedDate}
          currentConstraint={selectedDate ? getConstraintForDate(new Date(selectedDate)) : null}
        />
      </div>
    </div>
  );
}