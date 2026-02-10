import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Sparkles, Users, LogOut, AlertCircle, ArrowLeftRight, Plus, Filter } from 'lucide-react';
import NotificationBell from '../components/notifications/NotificationBell';
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
  'קצרה': 'bg-blue-200',
  'ארוכה': 'bg-purple-200',
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
  
  if (shiftType === 'קצרה') {
    if (contractType === '08:00–17:00 / 10:00–19:00') return { start: '08:00', end: '17:00' };
    if (contractType === '08:00–16:30 / 10:30–19:00') return { start: '08:00', end: '16:30' };
  }
  
  if (shiftType === 'ארוכה') {
    if (contractType === '08:00–17:00 / 10:00–19:00') return { start: '10:00', end: '19:00' };
    if (contractType === '08:00–16:30 / 10:30–19:00') return { start: '10:30', end: '19:00' };
  }
  
  return { start: '', end: '' };
}

export default function ManagerDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
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

  const shifts = allShifts.filter(shift => {
    const employeeMatch = filterEmployee === 'all' || shift.assigned_employee_id === filterEmployee;
    const shiftTypeMatch = filterShiftType === 'all' || shift.shift_type === filterShiftType;
    return employeeMatch && shiftTypeMatch;
  });

  const createShiftMutation = useMutation({
    mutationFn: (data) => base44.entities.Shift.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
      toast({ title: 'משמרת נוצרה' });
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
  });

  const updateShiftMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Shift.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
      toast({ title: 'המשמרת עודכנה' });
    },
  });

  const updateSwapMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SwapRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['swapRequests']);
      toast({ title: 'בקשת החלפה עודכנה' });
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

    // Notify requesting employee
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

    // Notify target employee about shift change
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

    // Notify requesting employee
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

  const generateSchedule = async () => {
    setGenerating(true);
    try {
      for (const shift of shifts) {
        await deleteShiftMutation.mutateAsync(shift.id);
      }

      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      const newShifts = [];
      const activeEmployees = employees.filter(e => e.active);
      const employeeWeeklyShifts = {};
      const employeeMonthlyFridays = {};
      const employeeLastThursdayLong = {};
      const employeeLastFriday = {};

      for (const day of days) {
        const dayOfWeek = getDay(day);
        if (dayOfWeek === 6) continue;

        const dateStr = format(day, 'yyyy-MM-dd');
        const isFriday = dayOfWeek === 5;
        const isThursday = dayOfWeek === 4;

        if (isFriday) {
          // שישי - 2 עובדים
          const availableForFriday = activeEmployees.filter(emp => {
            const constraint = constraints.find(c => c.employee_id === emp.id && c.date === dateStr);
            if (constraint?.unavailable) return false;
            
            const monthlyFridays = employeeMonthlyFridays[emp.id] || 0;
            if (monthlyFridays >= 1) return false;
            
            const lastFriday = employeeLastFriday[emp.id];
            if (lastFriday) {
              const daysDiff = Math.floor((parseISO(dateStr) - parseISO(lastFriday)) / (1000 * 60 * 60 * 24));
              if (daysDiff === 7) return false;
            }
            
            const yesterdayLong = employeeLastThursdayLong[emp.id];
            if (yesterdayLong === format(new Date(day.getTime() - 86400000), 'yyyy-MM-dd')) return false;
            
            return true;
          });

          if (availableForFriday.length >= 2) {
            const shortEmp = availableForFriday[0];
            const longEmp = availableForFriday[1];

            const shortTimes = calculateShiftTimes('שישי קצר', shortEmp.contract_type);
            const longTimes = calculateShiftTimes('שישי ארוך', longEmp.contract_type);

            newShifts.push({
              date: dateStr,
              shift_type: 'שישי קצר',
              assigned_employee_id: shortEmp.id,
              start_time: shortTimes.start,
              end_time: shortTimes.end,
              status: 'תקין',
            });

            newShifts.push({
              date: dateStr,
              shift_type: 'שישי ארוך',
              assigned_employee_id: longEmp.id,
              start_time: longTimes.start,
              end_time: longTimes.end,
              status: 'תקין',
            });

            employeeMonthlyFridays[shortEmp.id] = (employeeMonthlyFridays[shortEmp.id] || 0) + 1;
            employeeMonthlyFridays[longEmp.id] = (employeeMonthlyFridays[longEmp.id] || 0) + 1;
            employeeLastFriday[shortEmp.id] = dateStr;
            employeeLastFriday[longEmp.id] = dateStr;
          } else {
            newShifts.push({
              date: dateStr,
              shift_type: 'שישי קצר',
              status: 'בעיה',
            });
            newShifts.push({
              date: dateStr,
              shift_type: 'שישי ארוך',
              status: 'בעיה',
            });
          }
        } else {
          // יום רגיל - קצרה וארוכה
          const weekStart = startOfWeek(parseISO(dateStr), { weekStartsOn: 0 });
          const weekKey = format(weekStart, 'yyyy-MM-dd');

          const getAvailableEmployees = (preferredType) => {
            return activeEmployees.filter(emp => {
              const constraint = constraints.find(c => c.employee_id === emp.id && c.date === dateStr);
              if (constraint?.unavailable) return false;
              
              const weekShifts = employeeWeeklyShifts[emp.id]?.[weekKey] || 0;
              if (weekShifts >= 2) return false;
              
              if (constraint?.preference === `מעדיף ${preferredType}`) return true;
              if (constraint?.preference && constraint.preference !== 'אין העדפה') return false;
              
              return true;
            });
          };

          const shortAvailable = getAvailableEmployees('קצרה');
          const longAvailable = getAvailableEmployees('ארוכה');

          if (shortAvailable.length > 0) {
            const emp = shortAvailable[0];
            const times = calculateShiftTimes('קצרה', emp.contract_type);
            newShifts.push({
              date: dateStr,
              shift_type: 'קצרה',
              assigned_employee_id: emp.id,
              start_time: times.start,
              end_time: times.end,
              status: 'תקין',
            });
            if (!employeeWeeklyShifts[emp.id]) employeeWeeklyShifts[emp.id] = {};
            employeeWeeklyShifts[emp.id][weekKey] = (employeeWeeklyShifts[emp.id][weekKey] || 0) + 1;
          } else {
            newShifts.push({ date: dateStr, shift_type: 'קצרה', status: 'בעיה' });
          }

          if (longAvailable.length > 0) {
            const emp = longAvailable[0];
            const times = calculateShiftTimes('ארוכה', emp.contract_type);
            newShifts.push({
              date: dateStr,
              shift_type: 'ארוכה',
              assigned_employee_id: emp.id,
              start_time: times.start,
              end_time: times.end,
              status: 'תקין',
            });
            if (!employeeWeeklyShifts[emp.id]) employeeWeeklyShifts[emp.id] = {};
            employeeWeeklyShifts[emp.id][weekKey] = (employeeWeeklyShifts[emp.id][weekKey] || 0) + 1;
            
            if (isThursday) {
              employeeLastThursdayLong[emp.id] = dateStr;
            }
          } else {
            newShifts.push({ date: dateStr, shift_type: 'ארוכה', status: 'בעיה' });
          }
        }
      }

      await base44.entities.Shift.bulkCreate(newShifts);
      queryClient.invalidateQueries(['shifts']);
      
      toast({ title: `נוצרו ${newShifts.length} משמרות` });
    } catch (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
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

      const dateStr = format(date, 'yyyy-MM-dd');
      const times = calculateShiftTimes(shiftType, employee.contract_type);
      
      newShifts.push({
        date: dateStr,
        shift_type: shiftType,
        assigned_employee_id: employeeId,
        start_time: times.start,
        end_time: times.end,
        status: 'תקין',
      });
    }

    await base44.entities.Shift.bulkCreate(newShifts);
    queryClient.invalidateQueries(['shifts']);
    setRecurringDialogOpen(false);
    toast({ title: `נוצרו ${newShifts.length} משמרות` });
  };

  const renderDay = (date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 6) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = allShifts.filter(s => s.date === dateStr);
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
            return (
              <div
                key={shift.id}
                className={`text-xs p-1 rounded border-2 ${SHIFT_COLORS[shift.shift_type]} ${STATUS_COLORS[shift.status]}`}
              >
                <div className="font-medium">{employee?.full_name || 'לא משובץ'}</div>
                <div>{shift.shift_type}</div>
                {shift.start_time && shift.end_time && (
                  <div className="text-[10px] text-gray-600">{shift.start_time}–{shift.end_time}</div>
                )}
                {shift.status === 'בעיה' && (
                  <div className="text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-[10px]">אין עובד זמין</span>
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
          
          <div className="flex gap-3 flex-wrap">
            {currentUser && <NotificationBell userId={currentUser.id} />}
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
            <Button onClick={generateSchedule} disabled={generating}>
              <Sparkles className="w-4 h-4 ml-2" />
              {generating ? 'יוצר...' : 'צור סקיצת משמרות'}
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
                    <SelectItem value="קצרה">קצרה</SelectItem>
                    <SelectItem value="ארוכה">ארוכה</SelectItem>
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
    });
    
    setNewShiftType('');
    setNewEmployeeId('');
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-bold mb-3">הוסף משמרת חדשה</h3>
        <div className="space-y-3">
          <Select value={newShiftType} onValueChange={setNewShiftType}>
            <SelectTrigger>
              <SelectValue placeholder="בחר סוג משמרת..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="קצרה">קצרה</SelectItem>
              <SelectItem value="ארוכה">ארוכה</SelectItem>
              <SelectItem value="שישי קצר">שישי קצר</SelectItem>
              <SelectItem value="שישי ארוך">שישי ארוך</SelectItem>
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
                    onValueChange={(value) => onUpdate(shift.id, { ...shift, assigned_employee_id: value })}
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
            <SelectItem value="קצרה">קצרה</SelectItem>
            <SelectItem value="ארוכה">ארוכה</SelectItem>
            <SelectItem value="שישי קצר">שישי קצר</SelectItem>
            <SelectItem value="שישי ארוך">שישי ארוך</SelectItem>
          </SelectContent>
        </Select>
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