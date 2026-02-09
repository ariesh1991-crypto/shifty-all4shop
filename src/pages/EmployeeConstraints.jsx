import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear } from 'date-fns';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MonthCalendar from '../components/shifts/MonthCalendar';
import ConstraintSelector from '../components/shifts/ConstraintSelector';
import ShiftLegend from '../components/shifts/ShiftLegend';
import { useToast } from '@/components/ui/use-toast';

const CONSTRAINT_COLORS = {
  unavailable: 'bg-red-500 text-white',
  prefer_morning: 'bg-blue-500 text-white',
  prefer_evening: 'bg-purple-500 text-white',
  special_hours_only: 'bg-amber-500 text-white',
};

export default function EmployeeConstraints() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;

  useEffect(() => {
    const loadCurrentEmployee = async () => {
      const user = await base44.auth.me();
      const employees = await base44.entities.Employee.filter({ email: user.email });
      if (employees.length > 0) {
        setCurrentEmployee(employees[0]);
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

  const renderDay = (date) => {
    const constraint = getConstraintForDate(date);
    const dayNumber = format(date, 'd');
    const isWeekend = format(date, 'i') === '6' || format(date, 'i') === '7';

    return (
      <div
        key={date.toString()}
        onClick={() => handleDayClick(date)}
        className={`
          p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md
          ${constraint ? CONSTRAINT_COLORS[constraint.constraint_type] : 'bg-gray-50 hover:bg-gray-100'}
          ${isWeekend ? 'border-blue-300' : 'border-gray-200'}
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

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  if (!currentEmployee) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            האילוצים שלי - {currentEmployee.full_name}
          </h1>
          <div className="flex gap-2">
            <Button onClick={goToPreviousMonth} variant="outline">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={goToNextMonth} variant="outline">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <ShiftLegend showConstraints={true} />

        <MonthCalendar year={year} month={month} renderDay={renderDay} />

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