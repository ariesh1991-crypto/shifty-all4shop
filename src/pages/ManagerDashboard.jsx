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
import CalendarViewToggle from '../components/shifts/CalendarViewToggle';
import WeekCalendar from '../components/shifts/WeekCalendar';
import AgendaView from '../components/shifts/AgendaView';
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
  const [currentDate, setCurrentDate] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [scheduleAlerts, setScheduleAlerts] = useState([]);
  const [calendarView, setCalendarView] = useState('month');
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiSuggestionsDialogOpen, setAiSuggestionsDialogOpen] = useState(false);
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

  const { data: dayNotes = [] } = useQuery({
    queryKey: ['dayNotes'],
    queryFn: () => base44.entities.DayNote.list(),
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

  const shifts = allShifts;

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

  const { data: recurringConstraints = [] } = useQuery({
    queryKey: ['recurringConstraints'],
    queryFn: () => base44.entities.RecurringConstraint.list(),
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

  const createDayNoteMutation = useMutation({
    mutationFn: (data) => base44.entities.DayNote.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dayNotes']);
      toast({ title: 'הערת יום נשמרה' });
    },
  });

  const updateDayNoteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DayNote.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dayNotes']);
      toast({ title: 'הערת יום עודכנה' });
    },
  });

  const deleteDayNoteMutation = useMutation({
    mutationFn: (id) => base44.entities.DayNote.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['dayNotes']);
      toast({ title: 'הערת יום נמחקה' });
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

  const analyzeConflictsWithAI = async (unassignedShifts, alerts, employeeStats, allData) => {
    try {
      const prompt = `אתה מומחה לניהול משמרות עובדים. נתון לך מצב סידור משמרות עם קונפליקטים.

**נתונים:**
- משמרות שלא שובצו: ${unassignedShifts.length} משמרות
${unassignedShifts.slice(0, 10).map(s => `  • ${s.date} - ${s.type}`).join('\n')}
${unassignedShifts.length > 10 ? `  • ... ועוד ${unassignedShifts.length - 10}` : ''}

- התראות קונפליקטים: ${alerts.length} התראות
${alerts.slice(0, 5).map(a => `  • ${a.employeeName} - ${a.date}: ${a.message}`).join('\n')}
${alerts.length > 5 ? `  • ... ועוד ${alerts.length - 5}` : ''}

- סטטיסטיקות עובדים:
${Object.values(employeeStats).slice(0, 5).map(s => 
  `  • ${s.employee.full_name}: ${s.totalShifts} משמרות, ${s.fridayCount} שישי`
).join('\n')}

- אילוצים פעילים: ${allData.constraints.length}
- חופשות מאושרות: ${allData.approvedVacations.length}

**משימה:**
1. נתח את הקונפליקטים לפי חומרה (קריטי/בינוני/נמוך)
2. הצע פתרונות קונקרטיים:
   - החלפות משמרות בין עובדים
   - עובדים שיכולים לקבל עוד משמרות
   - שינויים בהגדרות שיפתרו בעיות
3. סמן קונפליקטים שלא ניתנים לפתרון
4. הצע סדר עדיפויות לטיפול

**חשוב:** התשובה חייבת להיות מעשית ומבוססת על הנתונים שסופקו.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: {
              type: "object",
              properties: {
                total_conflicts: { type: "number" },
                critical_conflicts: { type: "number" },
                resolvable_conflicts: { type: "number" },
                unresolvable_conflicts: { type: "number" }
              }
            },
            priority_conflicts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  severity: { type: "string" },
                  description: { type: "string" },
                  affected_dates: { type: "array", items: { type: "string" } },
                  affected_employees: { type: "array", items: { type: "string" } }
                }
              }
            },
            suggested_solutions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  solution_type: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  expected_impact: { type: "string" },
                  difficulty: { type: "string" }
                }
              }
            },
            unresolvable_issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  issue: { type: "string" },
                  reason: { type: "string" },
                  recommendation: { type: "string" }
                }
              }
            },
            overall_assessment: { type: "string" }
          }
        }
      });

      return result;
    } catch (error) {
      console.error('AI analysis failed:', error);
      return null;
    }
  };

  const generateSchedule = async () => {
    setGenerating(true);
    setAiSuggestions(null);
    try {
      // מחק משמרות קיימות
      const shiftsToDelete = allShifts.filter(s => s.date && s.date.startsWith(monthKey));
      if (shiftsToDelete.length > 0) {
        const batchSize = 2;
        for (let i = 0; i < shiftsToDelete.length; i += batchSize) {
          const batch = shiftsToDelete.slice(i, i + batchSize);
          await Promise.all(batch.map(shift => deleteShiftMutation.mutateAsync(shift.id)));
          await new Promise(resolve => setTimeout(resolve, 1000));
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
          weeklyShiftTypes: {}, // { weekNum: [shift_types] }
          assignedDates: new Set(), // תאריכים שבהם העובד כבר משובץ
          fridayCount: 0,
          fridayLongCount: 0, // ספירת שישי ארוך
          fridayShortCount: 0, // ספירת שישי קצר
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
        if (constraint?.unavailable) return false;
        
        // בדוק אילוצים חוזרים
        const date = new Date(dateStr);
        const dayOfWeek = getDay(date);
        const recurringConstraint = recurringConstraints.find(
          rc => rc.employee_id === empId && rc.day_of_week === dayOfWeek && rc.unavailable
        );
        if (recurringConstraint) return false;
        
        return true;
      };

      // פונקציה לבדוק אם עובד יכול לקבל משמרת
      const canAssignShift = (empId, date, shiftType) => {
        const stats = employeeStats[empId];
        const employee = stats.employee;
        const weekNum = getWeekNum(date);
        const dateStr = format(date, 'yyyy-MM-dd');
        const isFridayShift = shiftType.includes('שישי');

        // בדוק שהעובד לא כבר משובץ באותו יום
        if (stats.assignedDates.has(dateStr)) return false;

        // בדוק זמינות
        if (!isEmployeeAvailable(empId, dateStr)) return false;

        // בדוק אם המשמרת חסומה לעובד זה
        if (employee.blocked_shift_times && employee.blocked_shift_times.includes(shiftType)) {
          return false;
        }

        // בדוק מגבלת שבוע (מקסימום 2 משמרות)
        const weekShifts = stats.weeklyShifts[weekNum] || 0;
        if (weekShifts >= 2) return false;

        // בדוק מגבלת שישי (מקסימום 2 לחודש)
        if (isFridayShift && stats.fridayCount >= 2) return false;

        // חוק חשוב: אם עובד כבר עשה שישי אחד, השני חייב להיות מסוג שונה
        if (isFridayShift && stats.fridayCount === 1) {
          if (shiftType === 'שישי ארוך' && stats.fridayLongCount > 0) return false;
          if (shiftType === 'שישי קצר' && stats.fridayShortCount > 0) return false;
        }

        // בדוק חוק: משמרת שנייה בשבוע חייבת להיות מסוג שונה (לימים רגילים)
        if (!isFridayShift && weekShifts === 1) {
          const weekTypes = stats.weeklyShiftTypes[weekNum] || [];
          if (weekTypes.includes(shiftType)) {
            return false; // כבר יש לו משמרת מהסוג הזה השבוע
          }
        }

        return true;
      };

      // פונקציה לשבץ משמרת
      const assignShift = (empId, date, shiftType) => {
        const stats = employeeStats[empId];
        const weekNum = getWeekNum(date);
        const dateStr = format(date, 'yyyy-MM-dd');
        const isFridayShift = shiftType.includes('שישי');

        stats.assignedDates.add(dateStr);
        stats.weeklyShifts[weekNum] = (stats.weeklyShifts[weekNum] || 0) + 1;
        
        if (!stats.weeklyShiftTypes[weekNum]) {
          stats.weeklyShiftTypes[weekNum] = [];
        }
        stats.weeklyShiftTypes[weekNum].push(shiftType);
        
        stats.totalShifts += 1;
        if (isFridayShift) {
          stats.fridayCount += 1;
          if (shiftType === 'שישי ארוך') stats.fridayLongCount += 1;
          if (shiftType === 'שישי קצר') stats.fridayShortCount += 1;
        }
      };

      // פונקציה לבחור עובד למשמרת (בחירה הוגנת + אופטימיזציה)
      const selectEmployeeForShift = (date, shiftType, preferredType = null) => {
        const isFridayShift = shiftType.includes('שישי');
        
        // מיון לפי מספר משמרות (מי שיש לו פחות יקבל קודם)
        let sortedEmployees = activeEmployees
          .map(emp => ({ emp, stats: employeeStats[emp.id] }))
          .filter(({ emp }) => canAssignShift(emp.id, date, shiftType))
          .sort((a, b) => {
            // במשמרות שישי - עדיפות מוחלטת למי שעשה 0 משמרות שישי
            if (isFridayShift) {
              // קודם כל, מי שלא עשה שישי כלל
              if (a.stats.fridayCount === 0 && b.stats.fridayCount > 0) return -1;
              if (b.stats.fridayCount === 0 && a.stats.fridayCount > 0) return 1;
              
              // אם שניהם עשו 0 או שניהם עשו יותר מ-0, אז:
              // 1. תן עדיפות לעובדים שזו המשמרת המועדפת שלהם
              const aPreferred = a.emp.preferred_shift_times && a.emp.preferred_shift_times.includes(shiftType);
              const bPreferred = b.emp.preferred_shift_times && b.emp.preferred_shift_times.includes(shiftType);
              if (aPreferred !== bPreferred) return bPreferred ? 1 : -1;
              
              // 2. תן עדיפות למי שעשה פחות משמרות בסך הכל
              return a.stats.totalShifts - b.stats.totalShifts;
            }
            
            // משמרות רגילות (לא שישי)
            // 1. תן עדיפות לעובדים שזו המשמרת המועדפת שלהם
            const aPreferred = a.emp.preferred_shift_times && a.emp.preferred_shift_times.includes(shiftType);
            const bPreferred = b.emp.preferred_shift_times && b.emp.preferred_shift_times.includes(shiftType);
            if (aPreferred !== bPreferred) return bPreferred ? 1 : -1;
            
            // 2. מיון לפי מספר משמרות כולל (איזון עומס)
            return a.stats.totalShifts - b.stats.totalShifts;
          });

        if (sortedEmployees.length === 0) return null;

        // נסה למצוא עובד עם העדפה מתאימה מה-constraints
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

        // אחרת - תן למי שיש פחות משמרות (ראש הרשימה)
        return sortedEmployees[0].emp.id;
      };

      const newShifts = [];
      const unassignedShifts = [];
      const alerts = [];

      // צור משמרות לכל יום
      for (const day of days) {
        const dayOfWeek = getDay(day);
        if (dayOfWeek === 6) continue; // דלג על שבת

        const dateStr = format(day, 'yyyy-MM-dd');
        const isFriday = dayOfWeek === 5;

        const shiftTypes = isFriday
          ? ['שישי ארוך', 'שישי קצר'] // ארוך קודם - צריך מישהו קבוע בארוכה
          : ['מסיים ב-17:30', 'מסיים ב-19:00'];

        for (const shiftType of shiftTypes) {
          // בחר עובד למשמרת
          const preferredType = shiftType === 'מסיים ב-17:30' ? 'מעדיף מסיים ב-17:30' : 
                                shiftType === 'מסיים ב-19:00' ? 'מעדיף מסיים ב-19:00' : null;
          
          // לוגיקה מיוחדת לשישי - מוודא חלוקה הוגנת
          let empId;
          if (isFriday) {
            // קודם כל נסה למצוא מישהו שלא עשה שישי כלל
            const candidatesNoFriday = activeEmployees
              .filter(emp => {
                const stats = employeeStats[emp.id];
                return stats.fridayCount === 0 && canAssignShift(emp.id, day, shiftType);
              })
              .sort((a, b) => {
                // העדפה למשמרת
                const aPreferred = a.preferred_shift_times && a.preferred_shift_times.includes(shiftType);
                const bPreferred = b.preferred_shift_times && b.preferred_shift_times.includes(shiftType);
                if (aPreferred !== bPreferred) return bPreferred ? 1 : -1;
                
                // מספר משמרות כולל
                return employeeStats[a.id].totalShifts - employeeStats[b.id].totalShifts;
              });
            
            if (candidatesNoFriday.length > 0) {
              empId = candidatesNoFriday[0].id;
            } else {
              // אם לא נמצא מישהו שלא עשה שישי, נסה מישהו שעשה רק 1
              empId = selectEmployeeForShift(day, shiftType, preferredType);
            }
          } else {
            empId = selectEmployeeForShift(day, shiftType, preferredType);
          }

          if (empId) {
            const employee = activeEmployees.find(e => e.id === empId);
            const times = calculateShiftTimes(shiftType, employee.contract_type);
            
            // בדוק חריגות
            const constraint = constraints.find(c => c.employee_id === empId && c.date === dateStr);
            if (constraint && constraint.unavailable) {
              alerts.push({
                type: 'warning',
                employeeId: empId,
                employeeName: employee.full_name,
                date: dateStr,
                shiftType: shiftType,
                message: `${employee.full_name} שובץ למשמרת ${shiftType} ב-${dateStr} למרות שסומן כלא זמין`,
                reason: constraint.notes || 'לא זמין'
              });
            }

            // בדוק חופשות מאושרות
            const vacation = vacationRequests.find(v => 
              v.employee_id === empId && 
              v.status === 'אושר' &&
              dateStr >= v.start_date && 
              dateStr <= v.end_date
            );
            if (vacation) {
              alerts.push({
                type: 'error',
                employeeId: empId,
                employeeName: employee.full_name,
                date: dateStr,
                shiftType: shiftType,
                message: `${employee.full_name} שובץ למשמרת ${shiftType} ב-${dateStr} למרות שיש לו ${vacation.type} מאושרת`,
                reason: `${vacation.type} מאושרת`
              });
            }
            
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
      const createBatchSize = 5;
      for (let i = 0; i < newShifts.length; i += createBatchSize) {
        const batch = newShifts.slice(i, i + createBatchSize);
        await base44.entities.Shift.bulkCreate(batch);
        if (i + createBatchSize < newShifts.length) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      queryClient.invalidateQueries(['shifts']);

      // הצג סיכום פשוט
      const assignedCount = newShifts.filter(s => s.assigned_employee_id).length;
      toast({
        title: 'הסקיצה נוצרה',
        description: `${assignedCount} משמרות שובצו${alerts.length > 0 ? ` • ${alerts.length} התראות` : ''}`,
      });

      // עדכן התראות
      setScheduleAlerts(alerts);

      // הפעל AI לניתוח קונפליקטים אם יש בעיות משמעותיות
      if (unassignedShifts.length > 0 || alerts.length > 3) {
        toast({ 
          title: 'מנתח קונפליקטים עם AI...', 
          description: 'זה עשוי לקחת מספר שניות'
        });

        const approvedVacations = vacationRequests.filter(v => v.status === 'אושר');
        const aiAnalysis = await analyzeConflictsWithAI(unassignedShifts, alerts, employeeStats, {
          constraints,
          approvedVacations,
          employees: activeEmployees
        });

        if (aiAnalysis) {
          setAiSuggestions(aiAnalysis);
          setAiSuggestionsDialogOpen(true);
        }
      }

      // שלח מיילים לעובדים עם חריגות
      const uniqueEmployees = [...new Set(alerts.map(a => a.employeeId))];
      for (const empId of uniqueEmployees) {
        const employee = employees.find(e => e.id === empId);
        if (employee?.user_id) {
          const user = await base44.entities.User.list();
          const empUser = user.find(u => u.id === employee.user_id);
          if (empUser?.email) {
            const empAlerts = alerts.filter(a => a.employeeId === empId);
            const alertsText = empAlerts.map(a => `• ${a.message}`).join('\n');
            
            await base44.integrations.Core.SendEmail({
              to: empUser.email,
              subject: 'התראה: חריגה בסידור משמרות',
              body: `שלום ${employee.full_name},\n\nזוהו החריגות הבאות בסידור המשמרות החדש:\n\n${alertsText}\n\nאנא פנה למנהל לבירור.\n\nבברכה,\nמערכת ניהול משמרות`
            });
          }
        }
      }
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

    // מצא עובדים בחופש מאושר באותו יום
    const employeesOnVacation = employees.filter(emp => {
      return vacationRequests.some(v => {
        if (v.employee_id !== emp.id || v.status !== 'אושר') return false;
        // השווה תאריכים כ-strings
        return dateStr >= v.start_date && dateStr <= v.end_date;
      });
    });

    // בדוק אם יש הערת יום
    const dayNote = dayNotes.find(n => n.date === dateStr);

    // ספירת צפיפות - משמרות + חופשים
    const totalItems = dayShifts.length + employeesOnVacation.length;
    const isDense = totalItems > 3;
    const hasConflicts = dayShifts.some(shift => {
      const constraint = constraints.find(c => c.employee_id === shift.assigned_employee_id && c.date === dateStr);
      const vacation = vacationRequests.find(v => {
        if (v.employee_id !== shift.assigned_employee_id || v.status !== 'אושר') return false;
        return dateStr >= v.start_date && dateStr <= v.end_date;
      });
      return (constraint?.unavailable) || vacation;
    });

    return (
      <div
        key={date.toString()}
        onClick={() => { setSelectedDate(dateStr); setDialogOpen(true); }}
        className={`p-2 border-2 rounded-lg cursor-pointer hover:shadow-md min-h-[100px] relative ${
          hasConflicts ? 'ring-2 ring-red-500 ring-offset-1' :
          isDense ? 'ring-2 ring-amber-400 ring-offset-1' : ''
        } ${
          employeesOnVacation.length > 0 ? 'bg-green-50 border-green-300' : 
          isFriday ? 'bg-blue-50' : 'bg-white'
        }`}
      >
        {(isDense || hasConflicts || dayNote) && (
          <div className="absolute top-1 left-1 flex gap-1">
            {hasConflicts && (
              <div className="w-2 h-2 rounded-full bg-red-500" title="קונפליקטים"></div>
            )}
            {isDense && (
              <div className="w-2 h-2 rounded-full bg-amber-500" title="צפיפות גבוהה"></div>
            )}
            {dayNote && (
              <div className={`w-2 h-2 rounded-full ${
                dayNote.priority === 'דחוף' ? 'bg-red-600' :
                dayNote.priority === 'חשוב' ? 'bg-orange-500' :
                'bg-blue-500'
              }`} title="יש הערת יום"></div>
            )}
          </div>
        )}
        
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        
        {/* הצג הערת יום אם יש */}
        {dayNote && (
          <div className={`text-[10px] p-1 rounded mb-2 border ${
            dayNote.priority === 'דחוף' ? 'bg-red-100 border-red-400 text-red-800' :
            dayNote.priority === 'חשוב' ? 'bg-orange-100 border-orange-400 text-orange-800' :
            'bg-blue-100 border-blue-400 text-blue-800'
          }`}>
            <div className="font-bold">📌 {dayNote.note}</div>
          </div>
        )}
        
        {/* הצג עובדים בחופש בראש היום - מקוצר אם יש צפיפות */}
        {employeesOnVacation.length > 0 && (
          <div className="space-y-1 mb-2">
            {employeesOnVacation.slice(0, isDense ? 1 : 3).map(emp => {
              const vacation = vacationRequests.find(v => {
                if (v.employee_id !== emp.id || v.status !== 'אושר') return false;
                return dateStr >= v.start_date && dateStr <= v.end_date;
              });
              return (
                <div key={`vacation-${emp.id}`} className="text-xs p-1 rounded bg-green-200 border-2 border-green-600">
                  <div className="font-bold text-green-900 flex items-center gap-1">
                    🏖️ {emp.full_name}
                  </div>
                  <div className="text-green-800 text-[10px] font-bold">{vacation.type}</div>
                  {vacation.notes && (
                    <div className="text-[9px] text-green-700 mt-1">{vacation.notes}</div>
                  )}
                </div>
              );
            })}
            {employeesOnVacation.length > (isDense ? 1 : 3) && (
              <div className="text-[10px] text-center text-green-700 font-bold">
                +{employeesOnVacation.length - (isDense ? 1 : 3)} נוספים
              </div>
            )}
          </div>
        )}
        
        <div className="space-y-1">
          {expectedShiftTypes.slice(0, isDense ? 1 : 2).map(expectedType => {
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

            // בדוק קונפליקטים
            const constraint = constraints.find(c => c.employee_id === shift.assigned_employee_id && c.date === dateStr);
            const vacation = vacationRequests.find(v => {
              if (v.employee_id !== shift.assigned_employee_id || v.status !== 'אושר') return false;
              return dateStr >= v.start_date && dateStr <= v.end_date;
            });
            
            const hasConflict = (constraint?.unavailable) || vacation;

            return (
              <div
                key={shift.id}
                className={`text-xs p-1 rounded border-2 ${SHIFT_COLORS[shift.shift_type]} ${STATUS_COLORS[shift.status]} ${hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
              >
                <div className="font-medium flex items-center gap-1">
                  {hasConflict && <AlertCircle className="w-3 h-3 text-red-600" />}
                  <span className={hasConflict ? 'text-red-700' : ''}>{employee?.full_name || 'לא משובץ'}</span>
                </div>
                <div className="text-[10px]">{shift.shift_type}</div>
                {shift.start_time && shift.end_time && (
                  <div className="text-[9px] text-gray-600">{shift.start_time}–{shift.end_time}</div>
                )}
                {hasConflict && (
                  <div className="text-[9px] text-red-600 font-bold mt-1">
                    {vacation ? `חופש: ${vacation.type}` : constraint?.notes || 'לא זמין'}
                  </div>
                )}
              </div>
            );
          })}
          {isDense && expectedShiftTypes.length > 1 && (
            <div className="text-[10px] text-center text-gray-600 font-bold">
              +{expectedShiftTypes.length - 1} משמרות
            </div>
          )}
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
            <Link to={createPageUrl('VacationManagement')}>
              <Button variant="outline">
                <Briefcase className="w-4 h-4 ml-2" />
                בקשות חופשה {pendingVacations.length > 0 && `(${pendingVacations.length})`}
              </Button>
            </Link>
            <Button onClick={() => setRecurringDialogOpen(true)} variant="outline">
              <Plus className="w-4 h-4 ml-2" />
              משמרות חוזרות
            </Button>
            <Link to={createPageUrl('AllConstraints')}>
              <Button variant="outline">
                <AlertCircle className="w-4 h-4 ml-2" />
                כל האילוצים
              </Button>
            </Link>
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
            {pendingSwaps.length > 0 && (
              <Button 
                onClick={async () => {
                  const reason = prompt('הסבר (אופציונלי) לדחיית כל הבקשות:');
                  if (reason !== null) {
                    for (const req of pendingSwaps) {
                      await updateSwapMutation.mutateAsync({
                        id: req.id,
                        data: { status: 'נדחה', manager_notes: reason || 'כל הבקשות נדחו' }
                      });
                      const requestingEmployee = employees.find(e => e.id === req.requesting_employee_id);
                      if (requestingEmployee?.user_id) {
                        await base44.entities.Notification.create({
                          user_id: requestingEmployee.user_id,
                          employee_id: requestingEmployee.id,
                          type: 'swap_rejected',
                          title: 'בקשת החלפה נדחתה',
                          message: reason || 'בקשת ההחלפה שלך נדחתה על ידי המנהל',
                          swap_request_id: req.id,
                        });
                      }
                    }
                    toast({ title: `נדחו ${pendingSwaps.length} בקשות החלפה` });
                  }
                }}
                variant="destructive"
                size="sm"
              >
                דחה הכל
              </Button>
            )}
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
                    const batchSize = 2;
                    for (let i = 0; i < shiftsToDelete.length; i += batchSize) {
                      const batch = shiftsToDelete.slice(i, i + batchSize);
                      await Promise.all(batch.map(shift => deleteShiftMutation.mutateAsync(shift.id)));
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    toast({ title: 'כל המשמרות נמחקו' });
                  } catch (error) {
                    console.error('Error deleting shifts:', error);
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

        {scheduleAlerts.length > 0 && (
          <div className="bg-white rounded-lg shadow-md mb-4">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold">התראות סידור משמרות ({scheduleAlerts.length})</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setScheduleAlerts([])}>
                סגור
              </Button>
            </div>
            <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
              {scheduleAlerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-lg border-r-4 ${
                    alert.type === 'error' ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{alert.message}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        סיבה: {alert.reason}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(alert.date), 'dd/MM/yyyy')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 flex justify-end">
          <CalendarViewToggle view={calendarView} onViewChange={setCalendarView} />
        </div>

        {calendarView === 'month' && <MonthCalendar year={year} month={month} renderDay={renderDay} />}
        
        {calendarView === 'week' && (
          <WeekCalendar 
            currentDate={currentDate} 
            onDateChange={setCurrentDate}
            renderDay={renderDay}
          />
        )}
        
        {calendarView === 'agenda' && (
          <AgendaView
            currentDate={currentDate}
            items={shifts}
            getItemsForDate={(dateStr) => shifts.filter(s => s.date === dateStr)}
            renderItem={(shift, idx) => {
              const employee = employees.find(e => e.id === shift.assigned_employee_id);
              const hasConflict = constraints.find(c => c.employee_id === shift.assigned_employee_id && c.date === shift.date && c.unavailable);
              return (
                <div key={idx} className={`p-2 rounded-lg text-sm border-2 ${
                  SHIFT_COLORS[shift.shift_type]
                } ${STATUS_COLORS[shift.status]} ${
                  hasConflict ? 'ring-2 ring-red-500' : ''
                }`}>
                  <div className="font-bold">{shift.shift_type}</div>
                  <div className="text-gray-700">{employee?.full_name || 'לא משובץ'}</div>
                  {shift.start_time && shift.end_time && (
                    <div className="text-xs text-gray-600">{shift.start_time}–{shift.end_time}</div>
                  )}
                </div>
              );
            }}
          />
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>עריכת יום - {selectedDate}</DialogTitle>
            </DialogHeader>
            <DayNoteEditor
              selectedDate={selectedDate}
              dayNote={dayNotes.find(n => n.date === selectedDate)}
              onCreate={(data) => createDayNoteMutation.mutate(data)}
              onUpdate={(id, data) => updateDayNoteMutation.mutate({ id, data })}
              onDelete={(id) => deleteDayNoteMutation.mutate(id)}
            />
            <div className="border-t pt-4 mt-4">
              <h3 className="font-bold mb-3">משמרות</h3>
              <ShiftEditor
                selectedDate={selectedDate}
                shifts={allShifts.filter(s => s.date === selectedDate)}
                employees={employees}
                onDelete={(id) => deleteShiftMutation.mutate(id)}
                onUpdate={(id, data) => updateShiftMutation.mutate({ id, data })}
                onCreate={(data) => createShiftMutation.mutate(data)}
                onClose={() => setDialogOpen(false)}
              />
            </div>
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

        <Dialog open={aiSuggestionsDialogOpen} onOpenChange={setAiSuggestionsDialogOpen}>
          <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                ניתוח AI - פתרונות לקונפליקטים
              </DialogTitle>
            </DialogHeader>
            {aiSuggestions && <AISuggestionsView suggestions={aiSuggestions} />}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function AISuggestionsView({ suggestions }) {
  const severityColors = {
    'קריטי': 'bg-red-100 border-red-500 text-red-900',
    'בינוני': 'bg-orange-100 border-orange-500 text-orange-900',
    'נמוך': 'bg-yellow-100 border-yellow-500 text-yellow-900',
  };

  const difficultyIcons = {
    'קל': '✅',
    'בינוני': '⚠️',
    'קשה': '🔴',
  };

  return (
    <div className="space-y-6">
      {/* סיכום */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          📊 סיכום מצב
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">
              {suggestions.summary?.total_conflicts || 0}
            </div>
            <div className="text-xs text-gray-600">סה״כ קונפליקטים</div>
          </div>
          <div className="bg-red-100 rounded p-3 text-center">
            <div className="text-2xl font-bold text-red-700">
              {suggestions.summary?.critical_conflicts || 0}
            </div>
            <div className="text-xs text-red-700">קריטיים</div>
          </div>
          <div className="bg-green-100 rounded p-3 text-center">
            <div className="text-2xl font-bold text-green-700">
              {suggestions.summary?.resolvable_conflicts || 0}
            </div>
            <div className="text-xs text-green-700">ניתנים לפתרון</div>
          </div>
          <div className="bg-gray-100 rounded p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">
              {suggestions.summary?.unresolvable_conflicts || 0}
            </div>
            <div className="text-xs text-gray-700">לא ניתנים לפתרון</div>
          </div>
        </div>
        {suggestions.overall_assessment && (
          <div className="mt-4 p-3 bg-white rounded border border-purple-200">
            <p className="text-sm text-gray-700">{suggestions.overall_assessment}</p>
          </div>
        )}
      </div>

      {/* קונפליקטים בעדיפות */}
      {suggestions.priority_conflicts && suggestions.priority_conflicts.length > 0 && (
        <div>
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            🎯 קונפליקטים בעדיפות גבוהה
          </h3>
          <div className="space-y-3">
            {suggestions.priority_conflicts.map((conflict, idx) => (
              <div 
                key={idx} 
                className={`border-2 rounded-lg p-4 ${
                  severityColors[conflict.severity] || 'bg-gray-100'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold">{conflict.type}</div>
                    <Badge variant="outline" className="mt-1">{conflict.severity}</Badge>
                  </div>
                </div>
                <p className="text-sm mb-2">{conflict.description}</p>
                {conflict.affected_dates && conflict.affected_dates.length > 0 && (
                  <div className="text-xs mt-2">
                    <strong>תאריכים:</strong> {conflict.affected_dates.join(', ')}
                  </div>
                )}
                {conflict.affected_employees && conflict.affected_employees.length > 0 && (
                  <div className="text-xs mt-1">
                    <strong>עובדים:</strong> {conflict.affected_employees.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* פתרונות מוצעים */}
      {suggestions.suggested_solutions && suggestions.suggested_solutions.length > 0 && (
        <div>
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            💡 פתרונות מוצעים
          </h3>
          <div className="space-y-3">
            {suggestions.suggested_solutions.map((solution, idx) => (
              <div key={idx} className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">
                    {difficultyIcons[solution.difficulty] || '📌'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-blue-900 mb-1">
                      {solution.title}
                    </div>
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {solution.solution_type}
                    </Badge>
                    <p className="text-sm text-blue-800 mb-2">
                      {solution.description}
                    </p>
                    <div className="flex gap-4 text-xs">
                      <div>
                        <strong>השפעה צפויה:</strong> {solution.expected_impact}
                      </div>
                      <div>
                        <strong>רמת קושי:</strong> {solution.difficulty}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* בעיות שלא ניתן לפתור */}
      {suggestions.unresolvable_issues && suggestions.unresolvable_issues.length > 0 && (
        <div>
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            ⚠️ בעיות שדורשות התערבות ידנית
          </h3>
          <div className="space-y-3">
            {suggestions.unresolvable_issues.map((issue, idx) => (
              <div key={idx} className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
                <div className="font-bold text-amber-900 mb-2">{issue.issue}</div>
                <div className="text-sm text-amber-800 mb-2">
                  <strong>סיבה:</strong> {issue.reason}
                </div>
                <div className="text-sm text-amber-700 bg-white p-2 rounded">
                  <strong>המלצה:</strong> {issue.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-50 border rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600">
          💡 השתמש בפתרונות המוצעים כדי לשפר את הסידור. ניתן ליישם אותם ידנית או לשנות הגדרות ולהריץ שוב.
        </p>
      </div>
    </div>
  );
}

function DayNoteEditor({ selectedDate, dayNote, onCreate, onUpdate, onDelete }) {
  const [note, setNote] = useState(dayNote?.note || '');
  const [priority, setPriority] = useState(dayNote?.priority || 'רגיל');

  const handleSave = () => {
    if (!note.trim()) return;
    
    if (dayNote) {
      onUpdate(dayNote.id, { note, priority });
    } else {
      onCreate({ date: selectedDate, note, priority });
    }
    
    setNote('');
    setPriority('רגיל');
  };

  const handleDelete = () => {
    if (dayNote && confirm('האם למחוק את הערת היום?')) {
      onDelete(dayNote.id);
      setNote('');
      setPriority('רגיל');
    }
  };

  return (
    <div className="space-y-4 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
      <div className="flex items-center gap-2 text-blue-900">
        <span className="text-2xl">📌</span>
        <h3 className="font-bold text-lg">הערת יום למנהל</h3>
      </div>
      <p className="text-sm text-blue-700">
        הערה זו תוצג לכל העובדים ותעזור להם לדעת מתי לא לקחת חופש/אילוץ
      </p>
      
      <div>
        <Label>תוכן ההערה</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='לדוגמא: "שדרוג לקוח XYZ - נדרשים כל העובדים"'
          rows={3}
          className="bg-white"
        />
      </div>

      <div>
        <Label>רמת חשיבות</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="רגיל">רגיל</SelectItem>
            <SelectItem value="חשוב">חשוב 🟠</SelectItem>
            <SelectItem value="דחוף">דחוף 🔴</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 justify-end">
        {dayNote && (
          <Button variant="destructive" onClick={handleDelete}>
            מחק הערה
          </Button>
        )}
        <Button onClick={handleSave} disabled={!note.trim()}>
          {dayNote ? 'עדכן הערה' : 'שמור הערה'}
        </Button>
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