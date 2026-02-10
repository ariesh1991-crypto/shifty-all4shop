import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Sparkles, Users, LogOut, AlertCircle, ArrowLeftRight, Plus, Filter, Briefcase } from 'lucide-react';
import NotificationBell from '../components/notifications/NotificationBell';
import VacationManager from '../components/vacations/VacationManager';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import MonthCalendar from '../components/shifts/MonthCalendar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SHIFT_COLORS = {
  'מסיים ב-17:30': 'bg-blue-200',
  'מסיים ב-19:00': 'bg-purple-200',
  'שישי קצר': 'bg-yellow-200',
  'שישי ארוך': 'bg-orange-200',
};

const STATUS_COLORS = {
  'תקין': 'border-green-500',
  'בעיה': 'border-red-500',
  'חריגה מאושרת': 'border-amber-500',
};

// פונקציה לחישוב שעות
function calculateShiftTimes(shiftType, contractType) {
  if (shiftType === 'שישי קצר') return { start: '08:30', end: '12:00' };
  if (shiftType === 'שישי ארוך') return { start: '08:00', end: '14:00' };
  
  if (shiftType === 'מסיים ב-17:30') {
    if (contractType === '08:00–17:00 / 10:00–19:00') return { start: '08:00', end: '17:30' };
    if (contractType === '08:00–16:30 / 10:30–19:00') return { start: '08:00', end: '17:30' };
  }
  
  if (shiftType === 'מסיים ב-19:00') {
    if (contractType === '08:00–17:00 / 10:00–19:00') return { start: '10:00', end: '19:00' };
    if (contractType === '08:00–16:30 / 10:30–19:00') return { start: '10:30', end: '19:00' };
  }
  
  return { start: '', end: '' };
}

// פונקציה לוולידציה של משמרת מול יום בשבוע
function validateShiftForDay(shiftType, dayOfWeek) {
  const isFriday = dayOfWeek === 5;
  const isFridayShift = (shiftType === 'שישי קצר' || shiftType === 'שישי ארוך');
  
  if (isFriday && !isFridayShift) {
    return false; // משמרת רגילה ביום שישי - לא חוקי
  }
  if (!isFriday && isFridayShift) {
    return false; // משמרת שישי ביום רגיל - לא חוקי
  }
  return true;
}

export default function ManagerDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterShiftType, setFilterShiftType] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const loadUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ['shifts', year, month],
    queryFn: async () => {
      const allShifts = await base44.entities.Shift.list();
      return allShifts.filter(s => s.date && s.date.startsWith(monthKey));
    },
  });

  const { data: vacationRequests = [] } = useQuery({
    queryKey: ['vacationRequests'],
    queryFn: () => base44.entities.VacationRequest.list('-created_date'),
  });

  const pendingVacations = vacationRequests.filter(v => v.status === 'ממתין לאישור');

  const approveScheduleMutation = useMutation({
    mutationFn: async () => {
      const drafts = allShifts.filter(s => s.schedule_status === 'טיוטה');
      await Promise.all(drafts.map(shift => 
        base44.entities.Shift.update(shift.id, { ...shift, schedule_status: 'מאושר' })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
      toast({ title: 'הסידור אושר בהצלחה' });
    },
  });

  const shifts = allShifts.filter(shift => {
    const employeeMatch = filterEmployee === 'all' || shift.assigned_employee_id === filterEmployee;
    const shiftTypeMatch = filterShiftType === 'all' || shift.shift_type === filterShiftType;
    return employeeMatch && shiftTypeMatch;
  });

  const createShiftMutation = useMutation({
    mutationFn: (data) => {
      const date = new Date(data.date);
      const dayOfWeek = getDay(date);
      if (!validateShiftForDay(data.shift_type, dayOfWeek)) {
        throw new Error('לא ניתן לשבץ משמרת זו ביום זה');
      }
      return base44.entities.Shift.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
    },
    onError: () => {
      // שגיאה שקטה - לא מציגים כלום
    },
  });

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints', year, month],
    queryFn: async () => {
      const all = await base44.entities.Constraint.list();
      return all.filter(c => c.date && c.date.startsWith(monthKey));
    },
  });

  const { data: swapRequests = [] } = useQuery({
    queryKey: ['swapRequests'],
    queryFn: () => base44.entities.SwapRequest.list(),
  });

  const pendingSwaps = swapRequests.filter(req => req.status === 'ממתין לאישור');

  const deleteShiftMutation = useMutation({
    mutationFn: (id) => base44.entities.Shift.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
    },
    onError: () => {
      // שגיאה שקטה - לא מציגים כלום
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Shift.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
    },
    onError: () => {
      // שגיאה שקטה - לא מציגים כלום
    },
  });

  const updateSwapMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SwapRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['swapRequests']);
    },
  });

  const updateVacationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VacationRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacationRequests']);
    },
  });

  const createConstraintMutation = useMutation({
    mutationFn: (data) => base44.entities.Constraint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
    },
  });

  const handleApproveSwap = async (swapRequest) => {
    const shift = shifts.find(s => s.id === swapRequest.shift_id);
    if (!shift) return;

    await updateShiftMutation.mutateAsync({
      id: shift.id,
      data: { ...shift, assigned_employee_id: swapRequest.target_employee_id }
    });

    await updateSwapMutation.mutateAsync({
      id: swapRequest.id,
      data: { status: 'אושר' }
    });

    const requestingEmployee = employees.find(e => e.id === swapRequest.requesting_employee_id);
    if (requestingEmployee?.user_id) {
      await base44.entities.Notification.create({
        user_id: requestingEmployee.user_id,
        employee_id: requestingEmployee.id,
        type: 'swap_approved',
        title: 'בקשת החלפה אושרה',
        message: 'בקשת ההחלפה שלך אושרה על ידי המנהל',
        swap_request_id: swapRequest.id,
      });
    }

    const targetEmployee = employees.find(e => e.id === swapRequest.target_employee_id);
    if (targetEmployee?.user_id) {
      await base44.entities.Notification.create({
        user_id: targetEmployee.user_id,
        employee_id: targetEmployee.id,
        type: 'shift_changed',
        title: 'המשמרת שלך שונתה',
        message: `שובצת למשמרת חדשה לאחר אישור החלפה`,
        swap_request_id: swapRequest.id,
      });
    }
  };

  const handleRejectSwap = async (swapRequest, managerNotes) => {
    await updateSwapMutation.mutateAsync({
      id: swapRequest.id,
      data: { status: 'נדחה', manager_notes: managerNotes }
    });

    const requestingEmployee = employees.find(e => e.id === swapRequest.requesting_employee_id);
    if (requestingEmployee?.user_id) {
      await base44.entities.Notification.create({
        user_id: requestingEmployee.user_id,
        employee_id: requestingEmployee.id,
        type: 'swap_rejected',
        title: 'בקשת החלפה נדחתה',
        message: managerNotes || 'בקשת ההחלפה שלך נדחתה על ידי המנהל',
        swap_request_id: swapRequest.id,
      });
    }
  };

  const handleApproveVacation = async (vacationRequest) => {
    // עדכן בקשה לאושר
    await updateVacationMutation.mutateAsync({
      id: vacationRequest.id,
      data: { status: 'אושר' }
    });

    // צור אילוצים אוטומטית לכל התאריכים
    const start = new Date(vacationRequest.start_date);
    const end = new Date(vacationRequest.end_date);
    const dates = eachDayOfInterval({ start, end });

    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = constraints.find(c => c.employee_id === vacationRequest.employee_id && c.date === dateStr);
      
      if (!existing) {
        await createConstraintMutation.mutateAsync({
          employee_id: vacationRequest.employee_id,
          date: dateStr,
          unavailable: true,
          notes: `${vacationRequest.type} מאושרת`
        });
      }
    }

    // שלח התראה לעובד
    const employee = employees.find(e => e.id === vacationRequest.employee_id);
    if (employee?.user_id) {
      await base44.entities.Notification.create({
        user_id: employee.user_id,
        employee_id: employee.id,
        type: 'swap_approved',
        title: 'בקשת החופשה אושרה',
        message: `בקשת ה${vacationRequest.type} שלך לתאריכים ${format(start, 'dd/MM')} - ${format(end, 'dd/MM')} אושרה`,
      });
    }

    toast({ title: 'בקשת החופשה אושרה והתאריכים סומנו כלא זמין' });
  };

  const handleRejectVacation = async (vacationRequest, managerNotes) => {
    await updateVacationMutation.mutateAsync({
      id: vacationRequest.id,
      data: { status: 'נדחה', manager_notes: managerNotes }
    });

    const employee = employees.find(e => e.id === vacationRequest.employee_id);
    if (employee?.user_id) {
      await base44.entities.Notification.create({
        user_id: employee.user_id,
        employee_id: employee.id,
        type: 'swap_rejected',
        title: 'בקשת החופשה נדחתה',
        message: managerNotes || 'בקשת החופשה שלך נדחתה על ידי המנהל',
      });
    }

    toast({ title: 'בקשת החופשה נדחתה' });
  };

  const generateSchedule = async () => {
    setGenerating(true);
    try {
      // מחק משמרות קיימות
      const shiftsToDelete = allShifts.filter(s => s.date && s.date.startsWith(monthKey));
      if (shiftsToDelete.length > 0) {
        const batchSize = 3;
        for (let i = 0; i < shiftsToDelete.length; i += batchSize) {
          const batch = shiftsToDelete.slice(i, i + batchSize);
          await Promise.all(batch.map(shift => deleteShiftMutation.mutateAsync(shift.id)));
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const activeEmployees = employees.filter(e => e.active);

      if (activeEmployees.length === 0) {
        toast({ title: 'שגיאה', description: 'אין עובדים פעילים במערכת', variant: 'destructive' });
        return;
      }

      // מבנה נתונים למעקב
      const employeeStats = {};
      activeEmployees.forEach(emp => {
        employeeStats[emp.id] = {
          employee: emp,
          weeklyShifts: {}, // { weekNum: count }
          fridayCount: 0,
          totalShifts: 0,
        };
      });

      // פונקציה לחישוב מספר שבוע
      const getWeekNum = (date) => {
        const weekStart = startOfWeek(date, { weekStartsOn: 0 });
        return format(weekStart, 'yyyy-ww');
      };

      // פונקציה לבדוק אם עובד זמין
      const isEmployeeAvailable = (empId, dateStr) => {
        const constraint = constraints.find(c => c.employee_id === empId && c.date === dateStr);
        return !constraint || !constraint.unavailable;
      };

      // פונקציה לבדוק אם עובד יכול לקבל משמרת
      const canAssignShift = (empId, date, isFridayShift) => {
        const stats = employeeStats[empId];
        const weekNum = getWeekNum(date);
        const dateStr = format(date, 'yyyy-MM-dd');

        // בדוק זמינות
        if (!isEmployeeAvailable(empId, dateStr)) return false;

        // בדוק מגבלת שבוע (מקסימום 2 משמרות)
        const weekShifts = stats.weeklyShifts[weekNum] || 0;
        if (weekShifts >= 2) return false;

        // בדוק מגבלת שישי (מקסימום 1 לחודש)
        if (isFridayShift && stats.fridayCount >= 1) return false;

        return true;
      };

      // פונקציה לשבץ משמרת
      const assignShift = (empId, date, shiftType) => {
        const stats = employeeStats[empId];
        const weekNum = getWeekNum(date);
        const isFridayShift = shiftType.includes('שישי');

        stats.weeklyShifts[weekNum] = (stats.weeklyShifts[weekNum] || 0) + 1;
        stats.totalShifts += 1;
        if (isFridayShift) stats.fridayCount += 1;
      };

      // פונקציה לבחור עובד למשמרת (בחירה הוגנת)
      const selectEmployeeForShift = (date, shiftType, preferredType = null) => {
        const isFridayShift = shiftType.includes('שישי');
        
        // מיון לפי מספר משמרות (מי שיש לו פחות יקבל קודם)
        const sortedEmployees = activeEmployees
          .map(emp => ({ emp, stats: employeeStats[emp.id] }))
          .filter(({ emp }) => canAssignShift(emp.id, date, isFridayShift))
          .sort((a, b) => a.stats.totalShifts - b.stats.totalShifts);

        if (sortedEmployees.length === 0) return null;

        // נסה למצוא עובד עם העדפה מתאימה
        if (preferredType) {
          const preferred = sortedEmployees.find(({ emp }) => {
            const constraint = constraints.find(c => 
              c.employee_id === emp.id && 
              c.date === format(date, 'yyyy-MM-dd')
            );
            return constraint && constraint.preference === preferredType;
          });
          if (preferred) return preferred.emp.id;
        }

        // אחרת - תן למי שיש פחות משמרות
        return sortedEmployees[0].emp.id;
      };

      const newShifts = [];
      const unassignedShifts = [];

      // צור משמרות לכל יום
      for (const day of days) {
        const dayOfWeek = getDay(day);
        if (dayOfWeek === 6) continue; // דלג על שבת

        const dateStr = format(day, 'yyyy-MM-dd');
        const isFriday = dayOfWeek === 5;

        const shiftTypes = isFriday
          ? ['שישי קצר', 'שישי ארוך']
          : ['מסיים ב-17:30', 'מסיים ב-19:00'];

        for (const shiftType of shiftTypes) {
          // בחר עובד למשמרת
          const preferredType = shiftType === 'מסיים ב-17:30' ? 'מעדיף מסיים ב-17:30' : 
                                shiftType === 'מסיים ב-19:00' ? 'מעדיף מסיים ב-19:00' : null;
          
          const empId = selectEmployeeForShift(day, shiftType, preferredType);

          if (empId) {
            const employee = activeEmployees.find(e => e.id === empId);
            const times = calculateShiftTimes(shiftType, employee.contract_type);
            
            newShifts.push({
              date: dateStr,
              shift_type: shiftType,
              assigned_employee_id: empId,
              start_time: times.start,
              end_time: times.end,
              status: 'תקין',
              schedule_status: 'טיוטה',
            });

            assignShift(empId, day, shiftType);
          } else {
            // לא נמצא עובד זמין
            newShifts.push({
              date: dateStr,
              shift_type: shiftType,
              status: 'בעיה',
              schedule_status: 'טיוטה',
              exception_reason: 'אין עובד זמין - כל העובדים הגיעו למגבלה השבועית/חודשית או לא זמינים',
            });
            unassignedShifts.push({ date: dateStr, type: shiftType });
          }
        }
      }

      // צור משמרות ב-batches כדי לא לעבור rate limit
      const createBatchSize = 10;
      for (let i = 0; i < newShifts.length; i += createBatchSize) {
        const batch = newShifts.slice(i, i + createBatchSize);
        await base44.entities.Shift.bulkCreate(batch);
        if (i + createBatchSize < newShifts.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      queryClient.invalidateQueries(['shifts']);

      // הצג סיכום פשוט
      const assignedCount = newShifts.filter(s => s.assigned_employee_id).length;
      toast({
        title: 'הסקיצה נוצרה',
        description: `${assignedCount} משמרות שובצו`,
      });
    } catch (error) {
      console.error('שגיאה ביצירת סידור:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateRecurringShifts = async (startDate, endDate, shiftType, employeeId) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = eachDayOfInterval({ start, end });
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    const newShifts = [];
    for (const date of dates) {
      const dayOfWeek = getDay(date);
      if (dayOfWeek === 6) continue;

      if (!validateShiftForDay(shiftType, dayOfWeek)) {
        console.warn(`Skipping invalid shift: ${shiftType} on day ${dayOfWeek}`);
        continue;
      }

      const dateStr = format(date, 'yyyy-MM-dd');
      const times = calculateShiftTimes(shiftType, employee.contract_type);
      
      newShifts.push({
        date: dateStr,
        shift_type: shiftType,
        assigned_employee_id: employeeId,
        start_time: times.start,
        end_time: times.end,
        status: 'תקין',
        schedule_status: 'טיוטה',
      });
    }

    await base44.entities.Shift.bulkCreate(newShifts);
    queryClient.invalidateQueries(['shifts']);
    setRecurringDialogOpen(false);
    toast({ title: `נוצרו ${newShifts.length} משמרות חוזרות` });
  };

  const renderDay = (date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 6) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = allShifts.filter(s => s.date === dateStr);
    const dayNumber = format(date, 'd');
    const isFriday = dayOfWeek === 5;

    const expectedShiftTypes = isFriday 
      ? ['שישי קצר', 'שישי ארוך']
      : ['מסיים ב-17:30', 'מסיים ב-19:00'];

    return (
      <div
        key={date.toString()}
        onClick={() => { setSelectedDate(dateStr); setDialogOpen(true); }}
        className={`p-2 border-2 rounded-lg cursor-pointer hover:shadow-md min-h-[100px] ${isFriday ? 'bg-blue-50' : 'bg-white'}`}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        <div className="space-y-1">
          {expectedShiftTypes.map(expectedType => {
            const shift = dayShifts.find(s => s.shift_type === expectedType);
            const employee = shift ? employees.find(e => e.id === shift.assigned_employee_id) : null;

            if (!shift) {
              return (
                <div key={expectedType} className="text-xs p-1 rounded border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500">
                  <div className="font-medium">ריק</div>
                  <div className="text-[10px]">{expectedType}</div>
                </div>
              );
            }

            if (shift.status === 'בעיה') {
              return (
                <div key={shift.id} className="text-xs p-1 rounded border-2 border-red-500 bg-red-100">
                  <div className="font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    <span className="text-red-700">לא משובץ</span>
                  </div>
                  <div className="text-red-600 text-[10px]">{shift.shift_type}</div>
                  {shift.exception_reason && <div className="text-[9px] text-red-500 mt-1">{shift.exception_reason}</div>}
                </div>
              );
            }

            return (
              <div
                key={shift.id}
                className={`text-xs p-1 rounded border-2 ${SHIFT_COLORS[shift.shift_type]} ${STATUS_COLORS[shift.status]}`}
              >
                <div className="font-medium">{employee?.full_name || 'לא משובץ'}</div>
                <div className="text-[10px]">{shift.shift_type}</div>
                {shift.start_time && shift.end_time && (
                  <div className="text-[9px] text-gray-600">{shift.start_time}–{shift.end_time}</div>
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
          
          <div className="flex gap-3 flex-wrap">
            {currentUser && <NotificationBell userId={currentUser.id} />}
            <Button onClick={() => setVacationDialogOpen(true)} variant="outline">
              <Briefcase className="w-4 h-4 ml-2" />
              בקשות חופשה {pendingVacations.length > 0 && `(${pendingVacations.length})`}
            </Button>
            <Button onClick={() => setRecurringDialogOpen(true)} variant="outline">
              <Plus className="w-4 h-4 ml-2" />
              משמרות חוזרות
            </Button>
            <Button onClick={() => setFilterDialogOpen(true)} variant="outline">
              <Filter className="w-4 h-4 ml-2" />
              סינון
            </Button>
            <Link to={createPageUrl('ManageEmployees')}>
              <Button variant="outline">
                <Users className="w-4 h-4 ml-2" />
                ניהול עובדים
              </Button>
            </Link>
            <Button onClick={() => setSwapDialogOpen(true)} variant="outline">
              <ArrowLeftRight className="w-4 h-4 ml-2" />
              בקשות החלפה {pendingSwaps.length > 0 && `(${pendingSwaps.length})`}
            </Button>
            <Button 
              onClick={generateSchedule} 
              disabled={generating}
              variant="default"
            >
              <Sparkles className="w-4 h-4 ml-2" />
              {generating ? 'יוצר...' : 'צור סקיצת משמרות'}
            </Button>
            <Button 
              onClick={() => approveScheduleMutation.mutate()}
              disabled={allShifts.filter(s => s.schedule_status === 'טיוטה').length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              אשר סידור
            </Button>
            <Button 
              onClick={async () => {
                if (confirm('האם אתה בטוח שברצונך למחוק את כל המשמרות לחודש הנוכחי?')) {
                  try {
                    const shiftsToDelete = allShifts;
                    const batchSize = 3;
                    for (let i = 0; i < shiftsToDelete.length; i += batchSize) {
                      const batch = shiftsToDelete.slice(i, i + batchSize);
                      await Promise.all(batch.map(shift => deleteShiftMutation.mutateAsync(shift.id)));
                      await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    toast({ title: 'כל המשמרות נמחקו' });
                  } catch (error) {
                    console.error('Error deleting shifts:', error);
                    toast({ title: 'שגיאה במחיקת משמרות', description: error.message, variant: 'destructive' });
                  }
                }
              }}
              variant="destructive"
              disabled={allShifts.length === 0}
            >
              מחק כל המשמרות
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

        {(filterEmployee !== 'all' || filterShiftType !== 'all') && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium">סינון פעיל:</span>
                {filterEmployee !== 'all' && (
                  <Badge>{employees.find(e => e.id === filterEmployee)?.full_name}</Badge>
                )}
                {filterShiftType !== 'all' && (
                  <Badge>{filterShiftType}</Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFilterEmployee('all'); setFilterShiftType('all'); }}>
                נקה סינון
              </Button>
            </div>
          </div>
        )}

        <MonthCalendar year={year} month={month} renderDay={renderDay} />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>עריכת משמרות - {selectedDate}</DialogTitle>
            </DialogHeader>
            <ShiftEditor
              selectedDate={selectedDate}
              shifts={allShifts.filter(s => s.date === selectedDate)}
              employees={employees}
              onDelete={(id) => deleteShiftMutation.mutate(id)}
              onUpdate={(id, data) => updateShiftMutation.mutate({ id, data })}
              onCreate={(data) => createShiftMutation.mutate(data)}
              onClose={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>יצירת משמרות חוזרות</DialogTitle>
            </DialogHeader>
            <RecurringShiftForm
              employees={employees.filter(e => e.active)}
              onCreate={handleCreateRecurringShifts}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>סינון משמרות</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>עובד</Label>
                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל העובדים</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>סוג משמרת</Label>
                <Select value={filterShiftType} onValueChange={setFilterShiftType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל המשמרות</SelectItem>
                    <SelectItem value="מסיים ב-17:30">מסיים ב-17:30</SelectItem>
                    <SelectItem value="מסיים ב-19:00">מסיים ב-19:00</SelectItem>
                    <SelectItem value="שישי קצר">שישי קצר</SelectItem>
                    <SelectItem value="שישי ארוך">שישי ארוך</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setFilterDialogOpen(false)} className="w-full">
                החל סינון
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={vacationDialogOpen} onOpenChange={setVacationDialogOpen}>
          <DialogContent dir="rtl" className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ניהול בקשות חופשה והיעדרות</DialogTitle>
            </DialogHeader>
            <VacationManager
              vacationRequests={vacationRequests}
              employees={employees}
              onApprove={handleApproveVacation}
              onReject={handleRejectVacation}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
          <DialogContent dir="rtl" className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ניהול בקשות החלפת משמרות</DialogTitle>
            </DialogHeader>
            <SwapRequestsManager
              swapRequests={swapRequests}
              shifts={shifts}
              employees={employees}
              onApprove={handleApproveSwap}
              onReject={handleRejectSwap}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ShiftEditor({ selectedDate, shifts, employees, onDelete, onUpdate, onCreate, onClose }) {
  const [newShiftType, setNewShiftType] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');

  const date = new Date(selectedDate);
  const dayOfWeek = getDay(date);
  const isFriday = dayOfWeek === 5;

  const availableShiftTypes = isFriday
    ? [
        { value: 'שישי קצר', label: 'שישי קצר (08:30-12:00)' },
        { value: 'שישי ארוך', label: 'שישי ארוך (08:00-14:00)' }
      ]
    : [
        { value: 'מסיים ב-17:30', label: 'מסיים ב-17:30' },
        { value: 'מסיים ב-19:00', label: 'מסיים ב-19:00' }
      ];

  const handleCreate = () => {
    if (!newShiftType || !newEmployeeId) return;
    
    const employee = employees.find(e => e.id === newEmployeeId);
    const times = calculateShiftTimes(newShiftType, employee.contract_type);
    
    onCreate({
      date: selectedDate,
      shift_type: newShiftType,
      assigned_employee_id: newEmployeeId,
      start_time: times.start,
      end_time: times.end,
      status: 'תקין',
      schedule_status: 'טיוטה',
    });
    
    setNewShiftType('');
    setNewEmployeeId('');
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-bold mb-3">הוסף משמרת חדשה</h3>
        {isFriday && (
          <div className="mb-3 text-sm text-blue-700 bg-blue-100 p-2 rounded">
            📅 יום שישי - רק משמרות שישי זמינות
          </div>
        )}
        <div className="space-y-3">
          <Select value={newShiftType} onValueChange={setNewShiftType}>
            <SelectTrigger>
              <SelectValue placeholder="בחר סוג משמרת..." />
            </SelectTrigger>
            <SelectContent>
              {availableShiftTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newEmployeeId} onValueChange={setNewEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="בחר עובד..." />
            </SelectTrigger>
            <SelectContent>
              {employees.filter(e => e.active).map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} className="w-full" disabled={!newShiftType || !newEmployeeId}>
            <Plus className="w-4 h-4 ml-2" />
            הוסף משמרת
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-bold">משמרות קיימות</h3>
        {shifts.length === 0 ? (
          <p className="text-center text-gray-500 py-4">אין משמרות ליום זה</p>
        ) : (
          shifts.map(shift => (
            <div key={shift.id} className="border p-3 rounded">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-bold">{shift.shift_type}</div>
                  {shift.assigned_employee_id && (
                    <>
                      <div>עובד: {employees.find(e => e.id === shift.assigned_employee_id)?.full_name}</div>
                      {shift.start_time && shift.end_time && (
                        <div className="text-sm text-gray-600">{shift.start_time}–{shift.end_time}</div>
                      )}
                    </>
                  )}
                  <div className="mt-1 text-sm">סטטוס: {shift.status}</div>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={shift.assigned_employee_id || ''}
                    onValueChange={(value) => {
                      const emp = employees.find(e => e.id === value);
                      const times = calculateShiftTimes(shift.shift_type, emp.contract_type);
                      onUpdate(shift.id, { 
                        ...shift, 
                        assigned_employee_id: value,
                        start_time: times.start,
                        end_time: times.end,
                        status: 'תקין'
                      });
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="שבץ עובד" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.filter(e => e.active).map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                      onDelete(shift.id);
                      if (shifts.length === 1) onClose();
                    }}
                  >
                    מחק
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecurringShiftForm({ employees, onCreate }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [shiftType, setShiftType] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(startDate, endDate, shiftType, employeeId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>תאריך התחלה</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </div>
      <div>
        <Label>תאריך סיום</Label>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
      </div>
      <div>
        <Label>סוג משמרת</Label>
        <Select value={shiftType} onValueChange={setShiftType} required>
          <SelectTrigger>
            <SelectValue placeholder="בחר סוג משמרת..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="מסיים ב-17:30">מסיים ב-17:30 (ימים רגילים)</SelectItem>
            <SelectItem value="מסיים ב-19:00">מסיים ב-19:00 (ימים רגילים)</SelectItem>
            <SelectItem value="שישי קצר">שישי קצר</SelectItem>
            <SelectItem value="שישי ארוך">שישי ארוך</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          💡 המשמרת תישבץ רק בימים המתאימים (רגילים/שישי)
        </p>
      </div>
      <div>
        <Label>עובד</Label>
        <Select value={employeeId} onValueChange={setEmployeeId} required>
          <SelectTrigger>
            <SelectValue placeholder="בחר עובד..." />
          </SelectTrigger>
          <SelectContent>
            {employees.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full">צור משמרות</Button>
    </form>
  );
}

function SwapRequestsManager({ swapRequests, shifts, employees, onApprove, onReject }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const pendingRequests = swapRequests.filter(req => req.status === 'ממתין לאישור');

  return (
    <div className="space-y-4">
      {pendingRequests.length === 0 ? (
        <p className="text-center text-gray-500 py-8">אין בקשות החלפה ממתינות</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">משמרת</TableHead>
              <TableHead className="text-right">עובד מבקש</TableHead>
              <TableHead className="text-right">עובד מוצע</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingRequests.map((req) => {
              const shift = shifts.find(s => s.id === req.shift_id);
              const requestingEmp = employees.find(e => e.id === req.requesting_employee_id);
              const targetEmp = employees.find(e => e.id === req.target_employee_id);
              return (
                <TableRow key={req.id}>
                  <TableCell>
                    {shift ? (
                      <div>
                        <div className="font-medium">{format(new Date(shift.date), 'dd/MM/yyyy')}</div>
                        <div className="text-sm text-gray-600">{shift.shift_type}</div>
                        <div className="text-xs text-gray-500">{shift.start_time} - {shift.end_time}</div>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{requestingEmp?.full_name}</TableCell>
                  <TableCell>{targetEmp?.full_name}</TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm">{req.notes || '-'}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onApprove(req)}
                      >
                        אשר
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setSelectedRequest(req)}
                      >
                        דחה
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>דחיית בקשת החלפה</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>סיבת הדחייה (אופציונלי)</Label>
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="הסבר קצר לסיבת הדחייה..."
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  ביטול
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    onReject(selectedRequest, rejectNotes);
                    setSelectedRequest(null);
                    setRejectNotes('');
                  }}
                >
                  דחה בקשה
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}